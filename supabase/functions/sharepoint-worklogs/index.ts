// Fetches engineer worklogs ("Καταχώρηση Εργασιών") from SharePoint
// for a given portal customer. Matches by customers.sharepoint_customer_id,
// or falls back to matching by ΑΦΜ (customers.vat_number → List1.AFM_ATL).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/microsoft_sharepoint";
const SITE_ID =
  "geniusnet.sharepoint.com,ff4640a2-f471-4b81-ba61-a0a62b88f6cb,03dd8b7c-5171-4ed5-a8f8-de0f680af736";
const CUSTOMERS_LIST_ID = "279a2094-aca7-479a-b6fb-8480ab3d14b4"; // List1 - Πελάτες
const WORKLOGS_LIST_ID = "10e40751-c27d-4bea-a05e-f96ed8cce2e8"; // List - Καταχώρηση Εργασιών

// Encoded internal field names (Greek → hex)
const F = {
  lookupId: "_x03a0__x03b5__x03bb__x03ac__x030LookupId", // SpPelatisID (lookup to List1 id)
  method: "_x039c__x03ad__x03b8__x03bf__x03",
  start: "_x038f__x03c1__x03b1__x0020__x03",
  end: "_x038f__x03c1__x03b1__x0020__x030",
  hours: "_x038f__x03c1__x03b5__x03c2__x00",
  duration: "_x0394__x03b9__x03ac__x03c1__x03",
  description: "_x0395__x03c1__x03b3__x03b1__x03",
  techNotes: "_x03a3__x03c7__x03cc__x03bb__x03",
  signature: "_x03a5__x03c0__x03bf__x03b3__x03",
};

async function sp(path: string, qs: Record<string, string> = {}) {
  const url = new URL(GATEWAY + path);
  for (const [k, v] of Object.entries(qs)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "X-Connection-Api-Key": Deno.env.get("MICROSOFT_SHAREPOINT_API_KEY") ?? "",
      Accept: "application/json",
    },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`SharePoint ${res.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { customer_id, limit = 50 } = await req.json();
    if (!customer_id) throw new Error("customer_id required");

    // RLS-scoped read: user only sees customers they have access to
    const { data: cust, error: cErr } = await supabase
      .from("customers")
      .select("id, name, vat_number, sharepoint_customer_id")
      .eq("id", customer_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!cust) {
      return new Response(JSON.stringify({ error: "customer_not_found_or_forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve SharePoint customer id
    let spId = cust.sharepoint_customer_id as number | null;
    let matchedBy: string | null = spId ? "explicit_mapping" : null;

    if (!spId && cust.vat_number) {
      const afm = String(cust.vat_number).trim();
      const q = await sp(
        `/sites/${SITE_ID}/lists/${CUSTOMERS_LIST_ID}/items`,
        {
          $expand: "fields($select=Title,AFM_ATL,CODE_ATL)",
          $filter: `fields/AFM_ATL eq '${afm}'`,
          $top: "1",
        },
      );
      const hit = q?.value?.[0];
      if (hit?.id) {
        spId = Number(hit.id);
        matchedBy = "afm";
      }
    }

    if (!spId) {
      return new Response(
        JSON.stringify({
          customer: cust,
          matched_by: null,
          worklogs: [],
          message: "Δεν βρέθηκε αντιστοίχιση με SharePoint. Ορίστε ΑΦΜ ή SharePoint Customer ID.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch worklogs where lookup id equals spId
    const items = await sp(
      `/sites/${SITE_ID}/lists/${WORKLOGS_LIST_ID}/items`,
      {
        $expand: "fields",
        $filter: `fields/${F.lookupId} eq ${spId}`,
        $orderby: "fields/Created desc",
        $top: String(Math.min(Number(limit) || 50, 200)),
      },
    );

    const worklogs = (items?.value ?? []).map((it: any) => ({
      id: it.id,
      web_url: it.webUrl,
      created: it.createdDateTime,
      modified: it.lastModifiedDateTime,
      engineer: it.createdBy?.user?.displayName ?? null,
      engineer_email: it.createdBy?.user?.email ?? null,
      start: it.fields?.[F.start] ?? null,
      end: it.fields?.[F.end] ?? null,
      hours: it.fields?.[F.hours] ?? null,
      duration: it.fields?.[F.duration] ?? null,
      method: it.fields?.[F.method] ?? null,
      description: it.fields?.[F.description] ?? null,
      tech_notes: it.fields?.[F.techNotes] ?? null,
      signature: it.fields?.[F.signature] ?? null,
      title: it.fields?.Title ?? null,
    }));

    return new Response(
      JSON.stringify({
        customer: { id: cust.id, name: cust.name, sharepoint_id: spId },
        matched_by: matchedBy,
        count: worklogs.length,
        worklogs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sharepoint-worklogs error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
