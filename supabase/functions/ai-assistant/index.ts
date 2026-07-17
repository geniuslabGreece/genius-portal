// AI Assistant edge function — Lovable AI Gateway (Gemini) με data scoping ανά πελάτη.
// Streams UI messages back via the AI SDK. Tools είναι read-only και πάντα φιλτράρονται
// με customer_id του logged-in χρήστη — αδύνατο να δει δεδομένα άλλου πελάτη.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "npm:ai@6.0.194";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@1.0.31";
import { z } from "npm:zod@4.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};

function makeGateway(apiKey: string, baseURL?: string) {
  const isLovable = !baseURL || baseURL.includes("gateway.lovable.dev");
  return createOpenAICompatible({
    name: "lovable",
    baseURL: baseURL || "https://ai.gateway.lovable.dev/v1",
    headers: isLovable
      ? {
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "vercel-ai-sdk",
        }
      : {
          Authorization: `Bearer ${apiKey}`,
        },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY δεν έχει οριστεί" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve customer_id for the user (from profile)
    const { data: profile } = await admin
      .from("profiles")
      .select("customer_id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();
    const customerId = profile?.customer_id as string | null;
    if (!customerId) {
      return new Response(
        JSON.stringify({ error: "Δεν έχετε ανατεθεί σε εταιρεία. Επικοινωνήστε με τον διαχειριστή." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: customer } = await admin
      .from("customers")
      .select("name")
      .eq("id", customerId)
      .maybeSingle();

    // Read admin-managed AI settings (model, custom key/base URL, system prompt override, temperature, tools).
    const { data: settings } = await admin
      .from("ai_assistant_settings")
      .select("model, system_prompt, custom_api_key, custom_base_url, temperature, enabled_tools, extra_context")
      .eq("singleton", true)
      .maybeSingle();

    const modelId: string = settings?.model || "google/gemini-3-flash-preview";
    const effectiveKey: string = settings?.custom_api_key || lovableKey;
    const effectiveBaseURL: string | undefined = settings?.custom_base_url || undefined;
    const customSystem: string | null = settings?.system_prompt || null;
    const temperature: number | null = typeof settings?.temperature === "number" ? settings.temperature : null;

    const body = (await req.json()) as { messages: UIMessage[] };
    if (!Array.isArray(body.messages)) {
      return new Response("Messages required", { status: 400, headers: corsHeaders });
    }

    const tools = {
      getMyContracts: tool({
        description: "Επιστρέφει τα ενεργά συμβόλαια (software/hardware/erp/devices/άλλα) του πελάτη μαζί με ημερομηνίες έναρξης/λήξης, ποσότητα και προϊόν.",
        inputSchema: z.object({
          status: z.enum(["all", "expiring_soon"]).optional().describe("Φιλτράρισμα: όλα ή όσα λήγουν εντός 60 ημερών"),
        }),
        execute: async ({ status }) => {
          let q = admin
            .from("contracts")
            .select("id, contract_number, quantity, unit, start_date, end_date, notes, product:products(name, category, vendor)")
            .eq("customer_id", customerId)
            .order("end_date", { ascending: true })
            .limit(200);
          if (status === "expiring_soon") {
            const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
            const today = new Date().toISOString().slice(0, 10);
            q = q.gte("end_date", today).lte("end_date", in60);
          }
          const { data, error } = await q;
          if (error) return { error: error.message };
          return { count: data?.length ?? 0, contracts: data ?? [] };
        },
      }),
      getMyDevices: tool({
        description: "Επιστρέφει τις συγχρονισμένες συσκευές από το Azure AD του πελάτη (όνομα, OS, συμμόρφωση, τελευταία σύνδεση).",
        inputSchema: z.object({}),
        execute: async () => {
          const { data, error } = await admin
            .from("customer_azure_ad_devices")
            .select("display_name, operating_system, operating_system_version, join_type, is_compliant, approximate_last_sign_in, account_enabled")
            .eq("customer_id", customerId)
            .order("display_name")
            .limit(500);
          if (error) return { error: error.message };
          return { count: data?.length ?? 0, devices: data ?? [] };
        },
      }),
      getMyLicenses: tool({
        description: "Επιστρέφει τις Microsoft 365 / Office / Windows / EMS άδειες του πελάτη με σύνολο & σε χρήση.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data, error } = await admin
            .from("customer_azure_ad_licenses")
            .select("display_name, sku_part_number, prepaid_enabled, consumed_units, capability_status")
            .eq("customer_id", customerId)
            .order("display_name")
            .limit(200);
          if (error) return { error: error.message };
          return { count: data?.length ?? 0, licenses: data ?? [] };
        },
      }),
      getCopilotUsage: tool({
        description: "Επιστρέφει στοιχεία χρήσης Microsoft 365 Copilot ανά χρήστη (assigned license + last activity).",
        inputSchema: z.object({}),
        execute: async () => {
          const { data, error } = await admin
            .from("customer_copilot_usage")
            .select("user_principal_name, display_name, assigned_sku, has_assigned_license, last_activity_date, copilot_chat_last_activity, microsoft_teams_copilot_last_activity, word_copilot_last_activity, excel_copilot_last_activity, powerpoint_copilot_last_activity, outlook_copilot_last_activity")
            .eq("customer_id", customerId)
            .order("user_principal_name")
            .limit(500);
          if (error) return { error: error.message };
          return { count: data?.length ?? 0, copilot: data ?? [] };
        },
      }),
      getMyTickets: tool({
        description: "Επιστρέφει τα tickets υποστήριξης του πελάτη (subject, κατάσταση, τμήμα, ημερομηνία).",
        inputSchema: z.object({
          status: z.enum(["all", "open"]).optional(),
        }),
        execute: async ({ status }) => {
          let q = admin
            .from("tickets")
            .select("ticket_number, subject, status, priority, department, created_at, resolved_at")
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false })
            .limit(100);
          if (status === "open") q = q.neq("status", "resolved");
          const { data, error } = await q;
          if (error) return { error: error.message };
          return { count: data?.length ?? 0, tickets: data ?? [] };
        },
      }),
    };

    const gateway = makeGateway(effectiveKey, effectiveBaseURL);
    const model = gateway(modelId);

    const defaultSystem = [
      `Είσαι ο AI Σύμβουλος του Customer Portal για την εταιρεία "${customer?.name ?? "Άγνωστη"}".`,
      `Ο χρήστης που σου μιλάει είναι: ${profile?.full_name ?? profile?.email}.`,
      `Απαντάς ΠΑΝΤΑ στα ελληνικά εκτός αν ο χρήστης γράψει σε άλλη γλώσσα.`,
      `Χρησιμοποίησε τα διαθέσιμα tools για να φέρεις πραγματικά δεδομένα της εταιρείας του χρήστη — μη μαντεύεις.`,
      `Όταν παρουσιάζεις πίνακες ή λίστες, χρησιμοποίησε markdown.`,
      `Είσαι περιεκτικός, επαγγελματικός και προτείνεις ενέργειες όταν εντοπίζεις πρόβλημα (π.χ. συμβόλαια που λήγουν, μη συμμορφούμενες συσκευές, αχρησιμοποίητες Copilot άδειες).`,
    ].join("\n");

    const system = customSystem
      ? `${customSystem}\n\n(Context: εταιρεία "${customer?.name ?? "—"}", χρήστης ${profile?.full_name ?? profile?.email}.)`
      : defaultSystem;

    const result = streamText({
      model,
      system,
      tools,
      stopWhen: stepCountIs(50),
      messages: await convertToModelMessages(body.messages),
      ...(temperature !== null ? { temperature } : {}),
    });

    return result.toUIMessageStreamResponse({
      headers: corsHeaders,
      originalMessages: body.messages,
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    console.error("ai-assistant error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});