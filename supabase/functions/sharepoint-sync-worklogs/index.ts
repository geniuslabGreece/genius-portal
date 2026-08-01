// Resumable sync of engineer worklogs from the SharePoint "Καταχώρηση Εργασιών"
// list into public.ticket_worklogs.
//
// The list holds 50k+ items, so a single invocation cannot process everything.
// The client calls this function repeatedly, passing back `nextLink` until
// `done` is true. Each call processes at most `maxPages` pages (200 items each)
// and batch-upserts them.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/microsoft_sharepoint";
const GRAPH = "https://graph.microsoft.com/v1.0";
const SITE_ID =
  "geniusnet.sharepoint.com,ff4640a2-f471-4b81-ba61-a0a62b88f6cb,03dd8b7c-5171-4ed5-a8f8-de0f680af736";
const WORKLOGS_LIST_ID = "10e40751-c27d-4bea-a05e-f96ed8cce2e8";

const F = {
  lookupId: "_x03a0__x03b5__x03bb__x03ac__x030LookupId",
  lookupIdAlt: "_x03a0__x03b5__x03bb__x03ac__x03LookupId",
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

const toGateway = (u: string) => u.replace(GRAPH, GATEWAY);

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

    const body = await req.json().catch(() => ({}));
    const maxPages: number = Math.min(Number(body?.maxPages ?? 5) || 5, 10);
    const sinceDays: number | null =
      body?.sinceDays === null || body?.sinceDays === undefined ? 365 : Number(body.sinceDays);
    const cutoff = sinceDays && sinceDays > 0
      ? new Date(Date.now() - sinceDays * 86400000)
      : null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // sharepoint_customer_id -> customer_id
    const custMap = new Map<number, string>();
    for (let from = 0; ; from += 1000) {
      const { data } = await admin
        .from("customers")
        .select("id, sharepoint_customer_id")
        .not("sharepoint_customer_id", "is", null)
        .range(from, from + 999);
      for (const c of data ?? []) custMap.set(Number(c.sharepoint_customer_id), c.id);
      if (!data || data.length < 1000) break;
    }

    // customer_id|ticket_number -> ticket id (loaded once)
    const ticketMap = new Map<string, string>();
    for (let from = 0; ; from += 1000) {
      const { data } = await admin
        .from("tickets")
        .select("id, ticket_number, customer_id")
        .range(from, from + 999);
      for (const t of data ?? []) ticketMap.set(`${t.customer_id}|${t.ticket_number}`, t.id);
      if (!data || data.length < 1000) break;
    }

    let url: string = body?.nextLink
      ? toGateway(String(body.nextLink))
      : `${GATEWAY}/sites/${SITE_ID}/lists/${WORKLOGS_LIST_ID}/items?$expand=fields&$top=200&$orderby=fields/Modified desc`;

    let processed = 0, upserted = 0, linked = 0, unlinked = 0;
    let pages = 0;
    let reachedCutoff = false;
    let nextLink: string | null = null;
    const syncedAt = new Date().toISOString();

    while (url && pages < maxPages) {
      pages++;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          "X-Connection-Api-Key": Deno.env.get("MICROSOFT_SHAREPOINT_API_KEY") ?? "",
          Accept: "application/json",
        },
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`SharePoint ${res.status}: ${text.slice(0, 400)}`);
        return new Response(
          JSON.stringify({ error: `SharePoint ${res.status}: ${text.slice(0, 300)}` }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const json = JSON.parse(text);
      const items: any[] = json.value ?? [];
      const rows: any[] = [];

      for (const it of items) {
        const fields = it.fields ?? {};
        const modified = fields.Modified ? new Date(fields.Modified) : null;
        if (cutoff && modified && modified < cutoff) { reachedCutoff = true; break; }

        const rawLookup = fields[F.lookupId] ?? fields[F.lookupIdAlt];
        const spCustId = rawLookup != null ? Number(rawLookup) : null;
        const customerId = spCustId != null ? custMap.get(spCustId) ?? null : null;

        const title = fields.Title ?? null;
        const description = fields[F.description] ?? null;
        const techNotes = fields[F.techNotes] ?? null;

        let ticketId: string | null = null;
        if (customerId) {
          for (const n of extractTicketNumbers(title, description, techNotes)) {
            const hit = ticketMap.get(`${customerId}|${n}`);
            if (hit) { ticketId = hit; break; }
          }
        }

        rows.push({
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
          synced_at: syncedAt,
        });
        processed++;
        if (ticketId) linked++; else unlinked++;
      }

      if (rows.length) {
        const { error } = await admin
          .from("ticket_worklogs")
          .upsert(rows, { onConflict: "sharepoint_item_id" });
        if (error) {
          console.error("upsert error", error.message);
          return new Response(JSON.stringify({ error: `DB: ${error.message}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        upserted += rows.length;
      }

      const next = json["@odata.nextLink"] as string | undefined;
      if (reachedCutoff || !next) { nextLink = null; url = ""; break; }
      nextLink = next;
      url = toGateway(next);
    }

    return new Response(
      JSON.stringify({
        success: true,
        done: !nextLink,
        nextLink,
        pages,
        processed,
        upserted,
        linked,
        unlinked,
        reachedCutoff,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sharepoint-sync-worklogs error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
