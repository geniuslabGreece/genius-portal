import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Είσαι ο AI βοηθός υποστήριξης της GeniusNet. Απαντάς πάντα στα Ελληνικά, με σαφή και επαγγελματικό τόνο.

Η GeniusNet προσφέρει υπηρεσίες σε 5 τομείς:
- Τεχνικό Τμήμα (technical): δικτύωση, υποδομές, ασφάλεια NIS2, on-site support
- Software: άδειες χρήσης, cloud subscriptions, security suites, Microsoft 365
- ERP / SoftOne (erp): SoftOne ERP, παραγωγή, CRM, e-Invoicing, MyData
- Hardware: Servers, firewalls (WatchGuard), δικτυακός εξοπλισμός
- Συσκευές (devices): Laptops, εκτυπωτές, φορητές συσκευές

Κανόνες:
1. Δίνεις σύντομες, στοχευμένες απαντήσεις (έως 4-5 προτάσεις).
2. Αν το πρόβλημα είναι σύνθετο ή χρειάζεται πρόσβαση σε λογαριασμό/υποδομή, προτείνεις να ανοίξει ticket στο σωστό τμήμα. Π.χ.: "Συνιστώ να ανοίξετε ticket στο τμήμα ERP."
2. Δεν υπόσχεσαι χρόνους απόκρισης ή SLA.
3. Δεν δίνεις τιμές — παραπέμπεις σε επικοινωνία με τον Account Manager.
4. Αν ο χρήστης ζητήσει να μιλήσει σε άνθρωπο ή να ανοίξει ticket, ενθάρρυνέ τον να χρησιμοποιήσει το κουμπί "Άνοιγμα Ticket".`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- Require an authenticated portal user ---
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

    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Provider resolution: (1) custom key από ai_assistant_settings, (2) OPENAI_API_KEY, (3) Lovable AI Gateway.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: settings } = await admin
      .from("ai_assistant_settings")
      .select("model, custom_api_key, custom_base_url")
      .eq("singleton", true)
      .maybeSingle();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? null;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? null;

    let model = settings?.model || "google/gemini-3-flash-preview";
    const openaiStyle = model.startsWith("openai/") || model.startsWith("gpt-");
    const customKey = settings?.custom_api_key ?? null;

    let apiKey: string | null = null;
    let baseURL = "https://ai.gateway.lovable.dev/v1";
    if (settings?.custom_base_url && (customKey || OPENAI_API_KEY)) {
      apiKey = customKey || OPENAI_API_KEY;
      baseURL = settings.custom_base_url;
    } else if (openaiStyle && (customKey || OPENAI_API_KEY)) {
      apiKey = customKey || OPENAI_API_KEY;
      baseURL = "https://api.openai.com/v1";
    } else {
      apiKey = customKey || LOVABLE_API_KEY;
    }
    if (!apiKey) throw new Error("Δεν έχει ρυθμιστεί AI provider (OPENAI_API_KEY ή LOVABLE_API_KEY)");

    if (baseURL.includes("api.openai.com") && model.startsWith("openai/")) {
      model = model.slice("openai/".length);
    }



    const response = await fetch(`${baseURL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });


    if (!response.ok) {
      const errText = await response.text();
      console.error("AI provider error:", baseURL, model, response.status, errText.slice(0, 500));
      if (response.status === 429) {
        const quota = errText.includes("insufficient_quota");
        return new Response(
          JSON.stringify({
            error: quota
              ? "Ο λογαριασμός OpenAI δεν έχει διαθέσιμο υπόλοιπο (insufficient_quota)."
              : "Πολλά αιτήματα — δοκιμάστε ξανά σε λίγο.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Εξαντλήθηκαν τα διαθέσιμα credits για AI." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("support-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});