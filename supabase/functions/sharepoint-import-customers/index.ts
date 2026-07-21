// Imports customers from SharePoint list "Πελάτες" (List1) into the
// local customers table. Uses AFM_ATL as the primary key for upsert
// and stores SharePoint list item id in sharepoint_customer_id so
// worklogs can be resolved without any manual mapping.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/microsoft_sharepoint";
const SITE_ID =
  "geniusnet.sharepoint.com,ff4640a2-f471-4b81-ba61-a0a62b88f6cb,03dd8b7c-5171-4ed5-a8f8-de0f680af736";
const LIST1_CUSTOMERS = "279a2094-aca7-479a-b6fb-8480ab3d14b4"; // "Πελάτες" — linked from worklogs

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
  if (!res.ok) throw new Error(`SharePoint ${res.status}: ${body.slice(0, 400)}`);
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

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin only
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // DEBUG: test simple call
    const testUrl = `${GATEWAY}/sites/root`;
    const testRes = await fetch(testUrl, {
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "X-Connection-Api-Key": Deno.env.get("MICROSOFT_SHAREPOINT_API_KEY") ?? "",
        Accept: "application/json",
      },
    });
    console.log("test /sites/root:", testRes.status, (await testRes.text()).slice(0, 200));

    // Fetch all customers from List1 (paged). Rewrite nextLink to go through gateway.
    let url =
      `${GATEWAY}/sites/${SITE_ID}/lists/${LIST1_CUSTOMERS}/items?$expand=fields&$top=200`;
    let fetched: any[] = [];
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
      console.log(`page ${page}: ${res.status} url=${url.slice(0, 120)}`);
      if (!res.ok) throw new Error(`SharePoint ${res.status}: ${body.slice(0, 400)}`);
      const json = JSON.parse(body);
      fetched.push(...(json.value ?? []));
      const next = json["@odata.nextLink"] as string | undefined;
      url = next
        ? next.replace("https://graph.microsoft.com/v1.0", GATEWAY)
        : "";
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const it of fetched) {
      const name = (it.fields?.Title ?? "").toString().trim();
      const vat = (it.fields?.AFM_ATL ?? "").toString().trim() || null;
      const spId = Number(it.id);
      if (!name) {
        skipped++;
        continue;
      }

      // Try to find existing customer by sharepoint_customer_id or vat_number or name
      const { data: existing } = await admin
        .from("customers")
        .select("id")
        .or(
          [
            `sharepoint_customer_id.eq.${spId}`,
            vat ? `vat_number.eq.${vat}` : "",
            `name.eq.${name.replace(/,/g, "")}`,
          ].filter(Boolean).join(","),
        )
        .maybeSingle();

      if (existing?.id) {
        const { error } = await admin
          .from("customers")
          .update({
            name,
            vat_number: vat,
            sharepoint_customer_id: spId,
          })
          .eq("id", existing.id);
        if (!error) updated++;
      } else {
        const { error } = await admin.from("customers").insert({
          name,
          vat_number: vat,
          sharepoint_customer_id: spId,
        });
        if (!error) inserted++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: fetched.length,
        inserted,
        updated,
        skipped,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sharepoint-import-customers error:", e);
    return new Response(
      JSON.stringify({ error: String((e as Error).message) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
