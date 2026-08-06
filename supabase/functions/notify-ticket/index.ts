import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Department = "technical" | "software" | "erp" | "hardware" | "devices";
type Priority = "low" | "normal" | "high" | "urgent";

const DEPARTMENTS: Department[] = ["technical", "software", "erp", "hardware", "devices"];
const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];

/** Heuristic classifier as fallback when AI is unavailable. */
function heuristicClassify(text: string): { department: Department; priority: Priority } {
  const t = text.toLowerCase();
  let department: Department = "technical";
  if (/\b(softone|erp|τιμολογ|παραγγελ|πελατολ|αποθηκη|invoice|myf|mydata)\b/.test(t)) department = "erp";
  else if (/\b(office|microsoft|365|m365|adobe|αδεια|license|εφαρμογ|software|cloud|saas|outlook|teams)\b/.test(t)) department = "software";
  else if (/\b(server|firewall|switch|router|nas|raid|hardware|μηχανημα|ψυκτικ|ups)\b/.test(t)) department = "hardware";
  else if (/\b(laptop|φορητ|εκτυπωτ|printer|σαρωτ|scanner|tablet|κινητ|mobile|device|συσκευ)\b/.test(t)) department = "devices";
  else if (/\b(δικτυ|network|vpn|wifi|on[- ]?site|τεχνικ|σφαλμα|βλαβη|down|outage|crash)\b/.test(t)) department = "technical";

  let priority: Priority = "normal";
  if (/\b(επειγον|κρισιμ|down|outage|σταματησε|ολοι|production|παραγωγη εκτος)\b/.test(t)) priority = "urgent";
  else if (/\b(γρηγορ|αμεσ|σημαντικ|σοβαρο|asap|high)\b/.test(t)) priority = "high";
  else if (/\b(low|χαμηλ|οποτε|ευκαιρ)\b/.test(t)) priority = "low";
  return { department, priority };
}

/** Try Lovable AI gateway for smarter classification. */
async function aiClassify(subject: string, description: string): Promise<{ department: Department; priority: Priority } | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Classify the support ticket. Return STRICT JSON only: {\"department\":one of technical|software|erp|hardware|devices,\"priority\":one of low|normal|high|urgent}. " +
              "technical=δικτύωση/υποδομές/on-site/σφάλματα. software=άδειες/εφαρμογές/cloud/M365. erp=SoftOne/ERP/myDATA/τιμολόγηση. hardware=servers/firewalls/εξοπλισμός. devices=laptops/εκτυπωτές/φορητές συσκευές. " +
              "Priority urgent only αν production down. Default priority=normal.",
          },
          { role: "user", content: `Θέμα: ${subject}\n\nΠεριγραφή: ${description}` },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const j = await resp.json();
    const raw = j?.choices?.[0]?.message?.content ?? "";
    const m = String(raw).match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    const dept = DEPARTMENTS.includes(parsed.department) ? parsed.department : null;
    const prio = PRIORITIES.includes(parsed.priority) ? parsed.priority : "normal";
    if (!dept) return null;
    return { department: dept, priority: prio };
  } catch (err) {
    console.error("aiClassify error", err);
    return null;
  }
}

/**
 * Handles ticket lifecycle events:
 *  - "created": auto-routes ticket to the right department/priority via AI,
 *    then creates in-app notifications for the customer + admins.
 *  - "reply": creates in-app notification for the other party.
 * Body: { ticket_id: string, event: "created" | "reply" }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- Require an authenticated caller ---
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const { ticket_id, event } = await req.json();
    if (!ticket_id || !event || (event !== "created" && event !== "reply")) {
      return new Response(JSON.stringify({ error: "valid ticket_id and event required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(ticket_id))) {
      return new Response(JSON.stringify({ error: "invalid ticket_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: ticket, error: ticketErr } = await supabase
      .from("tickets")
      .select("id, ticket_number, subject, description, department, priority, customer_id, status, created_by")
      .eq("id", ticket_id)
      .single();
    if (ticketErr || !ticket) throw ticketErr ?? new Error("Ticket not found");

    // --- Authorize: caller must own the ticket or have access to its customer ---
    let allowed = ticket.created_by === callerId;
    if (!allowed) {
      const { data: hasAccess } = await supabase.rpc("user_has_customer_access", {
        _user_id: callerId,
        _customer_id: ticket.customer_id,
      });
      allowed = hasAccess === true;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-routing on creation
    if (event === "created") {
      const ai = await aiClassify(ticket.subject ?? "", ticket.description ?? "");
      const classified = ai ?? heuristicClassify(`${ticket.subject ?? ""} ${ticket.description ?? ""}`);
      const patch: Record<string, unknown> = {};
      if (classified.department && classified.department !== ticket.department) {
        patch.department = classified.department;
      }
      // Only escalate priority, never downgrade an explicit user choice
      const order = { low: 0, normal: 1, high: 2, urgent: 3 } as const;
      if (classified.priority && order[classified.priority] > order[ticket.priority as Priority]) {
        patch.priority = classified.priority;
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from("tickets").update(patch).eq("id", ticket.id);
        ticket.department = (patch.department as string) ?? ticket.department;
        ticket.priority = (patch.priority as string) ?? ticket.priority;
      }
    }

    const { data: dept } = await supabase
      .from("ticket_department_settings")
      .select("display_name, notify_email")
      .eq("department", ticket.department)
      .maybeSingle();

    const deptLabel = dept?.display_name ?? ticket.department;
    const isCreated = event === "created";
    const title = isCreated
      ? `Νέο ticket #${ticket.ticket_number} — ${deptLabel}`
      : `Νέο μήνυμα στο ticket #${ticket.ticket_number}`;
    const body = isCreated
      ? `${ticket.subject} — Δρομολογήθηκε στο τμήμα ${deptLabel}.`
      : `Υπάρχει νέα απάντηση στο ticket "${ticket.subject}".`;

    await supabase.from("notifications").insert({
      customer_id: ticket.customer_id,
      contract_id: null,
      type: "general",
      title,
      body,
    });

    console.log(`[notify-ticket] ${event} for ticket #${ticket.ticket_number} → dept email: ${dept?.notify_email ?? "none"}`);

    return new Response(
      JSON.stringify({ ok: true, dept_email: dept?.notify_email ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("notify-ticket error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});