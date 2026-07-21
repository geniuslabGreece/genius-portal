// Syncs engineer worklogs from SharePoint "Καταχώρηση Εργασιών" list into
// public.ticket_worklogs, linking each entry to a customer (by lookup id)
// and, when possible, to a ticket (by referencing "#<ticket_number>" in the
// title / description / tech notes for the same customer).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/microsoft_sharepoint";
const SITE_ID =
  "geniusnet.sharepoint.com,ff4640a2-f471-4b81-ba61-a0a62b88f6cb,03dd8b7c-5171-4ed5-a8f8-de0f680af736";
const WORKLOGS_LIST_ID = "10e40751-c27d-4bea-a05e-f96ed8cce2e8";

const F = {
  lookupId: "_x03a0__x03b5__x03bb__x03ac__x030LookupId",
  method: "_x039c__x03ad__x03b8__x03bf__x03",
  start: "_x038f__x03c1__x03b1__x0020__x03",
  end: "_x038f__x03c1__x03b1__x0020__x030",
  hours: "_x038f__x03c1__x03b5__x03c2__x00",
  duration: "_x0394__x03b9__x03ac__x03c1__x03",
  description: "_x0395__x03c1__x03b3__x03b1__x03",
  techNotes: "_x03a3__x03c7__x03cc__x03bb__x03",
  signature: "_x03a5__x03c0__x03bf__x03b3__x03",
};

function extractTicketNumbers(...texts: (string | null | undefined)[]): number[] {
  const nums = new Set<number>();
  const re = /#\s*(\d{1,7})|\bT-?(\d{1,7})\b|\bticket\s*#?\s*(\d{1,7})/gi;
  for (const t of texts) {
    if (!t) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const n = Number(m[1] ?? m[2] ?? m[3]);
      if (Number.isFinite(n) && n > 0) nums.add(n);
    }
  }
  return [...nums];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userData.user.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Build sharepoint_customer_id -> customer_id map
    const { data: customers } = await admin
      .from("customers")
      .select("id, sharepoint_customer_id")
      .not("sharepoint_customer_id", "is", null);
    const custMap = new Map<number, string>();
    for (const c of customers ?? []) {
      if (c.sharepoint_customer_id != null) custMap.set(Number(c.sharepoint_customer_id), c.id);
    }

    // Fetch all worklogs (paged) — rewrite nextLink through gateway
    let url =
      `${GATEWAY}/sites/${SITE_ID}/lists/${WORKLOGS_LIST_ID}/items?$expand=fields&$top=200&$orderby=fields/Created desc`;
    const items: any[] = [];
    let page = 0;
    while (url) {
      page++;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          "X-Connection-Api-Key": Deno.env.get("MICROSOFT_SHAREPOINT_API_KEY") ?? "",
          Accept: "application/json",
        },
      });
      const body = await res.text();
      console.log(`page ${page}: ${res.status}`);
      if (!res.ok) throw new Error(`SharePoint ${res.status}: ${body.slice(0, 400)}`);
      const json = JSON.parse(body);
      items.push(...(json.value ?? []));
      const next = json["@odata.nextLink"] as string | undefined;
      url = next ? next.replace("https://graph.microsoft.com/v1.0", GATEWAY) : "";
    }

    let upserted = 0, linked = 0, unlinked = 0;

    for (const it of items) {
      const fields = it.fields ?? {};
      const spCustId = fields[F.lookupId] != null ? Number(fields[F.lookupId]) : null;
      const customerId = spCustId != null ? custMap.get(spCustId) ?? null : null;

      const title = fields.Title ?? null;
      const description = fields[F.description] ?? null;
      const techNotes = fields[F.techNotes] ?? null;

      let ticketId: string | null = null;
      if (customerId) {
        const nums = extractTicketNumbers(title, description, techNotes);
        if (nums.length) {
          const { data: t } = await admin
            .from("tickets")
            .select("id")
            .eq("customer_id", customerId)
            .in("ticket_number", nums)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (t?.id) ticketId = t.id;
        }
      }

      const row = {
        sharepoint_item_id: String(it.id),
        customer_id: customerId,
        ticket_id: ticketId,
        sharepoint_customer_id: spCustId,
        engineer: it.createdBy?.user?.displayName ?? null,
        engineer_email: it.createdBy?.user?.email ?? null,
        start_at: fields[F.start] ?? null,
        end_at: fields[F.end] ?? null,
        hours: fields[F.hours] ?? null,
        duration: fields[F.duration] ?? null,
        method: fields[F.method] ?? null,
        description,
        tech_notes: techNotes,
        signature: fields[F.signature] ?? null,
        title,
        web_url: it.webUrl ?? null,
        raw: it,
        synced_at: new Date().toISOString(),
      };

      const { error } = await admin
        .from("ticket_worklogs")
        .upsert(row, { onConflict: "sharepoint_item_id" });
      if (!error) {
        upserted++;
        if (ticketId) linked++; else unlinked++;
      } else {
        console.error("upsert err", error.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, total: items.length, upserted, linked, unlinked }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sharepoint-sync-worklogs error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
