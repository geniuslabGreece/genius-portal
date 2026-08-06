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
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Πολλά αιτήματα — δοκιμάστε ξανά σε λίγο." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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