// SoftOne ERP read-only sync edge function
// Συνδέεται στο SoftOne Web Services, διαβάζει customers + contracts
// και τα εισάγει/ενημερώνει στη βάση. Μόνο admins μπορούν να καλέσουν.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SoftOneLoginResponse {
  success: boolean;
  clientID?: string;
  objs?: Array<{ COMPANY: string; BRANCH: string; MODULE: string; REFID: string }>;
  error?: string;
}

interface SoftOneSqlResponse {
  success: boolean;
  totalcount?: number;
  rows?: any[];
  error?: string;
}

const ok = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Auth + admin check
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return ok({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) return ok({ error: "Forbidden — admins only" }, 403);

    const startedAt = Date.now();
    let customersSynced = 0;
    let productsSynced = 0;
    let contractsSynced = 0;
    let errorsCount = 0;
    const errors: string[] = [];

    // Load settings
    const { data: settings, error: setErr } = await admin
      .from("softone_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (setErr || !settings) return ok({ error: "SoftOne settings not configured" }, 400);
    if (!settings.enabled) return ok({ error: "SoftOne sync is disabled" }, 400);
    if (!settings.service_url || !settings.username || !settings.password) {
      return ok({ error: "Λείπουν credentials (URL/username/password)" }, 400);
    }

    const baseUrl = settings.service_url.replace(/\/$/, "");

    // 1. Login
    const loginRes = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: "login",
        username: settings.username,
        password: settings.password,
        appId: settings.app_id ?? "703",
      }),
    });
    const loginData = (await loginRes.json()) as SoftOneLoginResponse;
    if (!loginData.success || !loginData.clientID) {
      throw new Error(`SoftOne login failed: ${loginData.error ?? "unknown"}`);
    }
    const clientID = loginData.clientID;

    // 2. Authenticate (select company/branch/module)
    const authRes = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: "authenticate",
        clientID,
        COMPANY: settings.company,
        BRANCH: settings.branch,
        MODULE: settings.module,
        REFID: settings.refid,
      }),
    });
    const authData = await authRes.json();
    if (!authData.success) throw new Error(`SoftOne authenticate failed: ${authData.error ?? ""}`);

    // 3. Customers SqlData
    if (settings.customers_sql) {
      const custRes = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "SqlData",
          clientID,
          SqlName: "",
          Sql: settings.customers_sql,
        }),
      });
      const custData = (await custRes.json()) as SoftOneSqlResponse;
      if (custData.success && Array.isArray(custData.rows)) {
        for (const row of custData.rows) {
          try {
            const softoneId = String(row.id ?? row.TRDR ?? row.ID ?? "");
            if (!softoneId) continue;
            const payload = {
              softone_id: softoneId,
              name: String(row.name ?? row.NAME ?? "Άγνωστος"),
              vat_number: row.vat ? String(row.vat) : null,
              email: row.email ? String(row.email) : null,
              phone: row.phone ? String(row.phone) : null,
              address: row.address ? String(row.address) : null,
            };
            // Try match by softone_id first, then by VAT
            const { data: existing } = await admin
              .from("customers")
              .select("id, vat_number, softone_id")
              .or(`softone_id.eq.${softoneId}${payload.vat_number ? `,vat_number.eq.${payload.vat_number}` : ""}`)
              .maybeSingle();
            if (existing) {
              await admin.from("customers").update(payload).eq("id", existing.id);
            } else {
              await admin.from("customers").insert(payload);
            }
            customersSynced++;
          } catch (e) {
            errorsCount++;
            errors.push(`customer row: ${(e as Error).message}`);
          }
        }
      } else if (!custData.success) {
        errors.push(`customers SQL: ${custData.error ?? "unknown"}`);
        errorsCount++;
      }
    }

    // 4. Contracts SqlData
    // 3b. Products SqlData (κατάλογος προϊόντων από SoftOne)
    if (settings.products_sql) {
      const prodRes = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "SqlData",
          clientID,
          SqlName: "",
          Sql: settings.products_sql,
        }),
      });
      const prodData = (await prodRes.json()) as SoftOneSqlResponse;
      if (prodData.success && Array.isArray(prodData.rows)) {
        for (const row of prodData.rows) {
          try {
            const code = String(row.code ?? row.CODE ?? row.id ?? row.MTRL ?? "");
            const name = String(row.name ?? row.NAME ?? "");
            if (!code || !name) continue;
            const payload = {
              name,
              category: "software" as const,
              softone_code: code,
              vendor: row.vendor ? String(row.vendor) : row.MANFCTR ? String(row.MANFCTR) : null,
              sku: row.sku ? String(row.sku) : null,
              description: row.description ? String(row.description) : null,
            };
            const { data: existing } = await admin
              .from("products")
              .select("id")
              .eq("softone_code", code)
              .maybeSingle();
            if (existing) {
              await admin.from("products").update(payload).eq("id", existing.id);
            } else {
              await admin.from("products").insert(payload);
            }
            productsSynced++;
          } catch (e) {
            errorsCount++;
            errors.push(`product row: ${(e as Error).message}`);
          }
        }
      } else if (!prodData.success) {
        errors.push(`products SQL: ${prodData.error ?? "unknown"}`);
        errorsCount++;
      }
    }

    // 4. Contracts SqlData
    if (settings.contracts_sql) {
      const conRes = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "SqlData",
          clientID,
          SqlName: "",
          Sql: settings.contracts_sql,
        }),
      });
      const conData = (await conRes.json()) as SoftOneSqlResponse;
      if (conData.success && Array.isArray(conData.rows)) {
        for (const row of conData.rows) {
          try {
            const customerSoftoneId = String(row.customer_id ?? row.TRDR ?? "");
            const productCode = String(row.product_code ?? row.MTRL ?? "");
            const productName = String(row.product_name ?? row.ITEM ?? row.NAME ?? "");
            const contractNumber = String(row.contract_number ?? row.FINCODE ?? row.id ?? `S1-${productCode}-${Date.now()}`);
            if (!customerSoftoneId || !productName) continue;

            const { data: cust } = await admin
              .from("customers")
              .select("id")
              .eq("softone_id", customerSoftoneId)
              .maybeSingle();
            if (!cust) {
              errors.push(`contract: customer ${customerSoftoneId} not found`);
              errorsCount++;
              continue;
            }

            // Find or create product
            let productId: string | null = null;
            if (productCode) {
              const { data: p } = await admin
                .from("products")
                .select("id")
                .eq("softone_code", productCode)
                .maybeSingle();
              if (p) productId = p.id;
            }
            if (!productId) {
              const { data: newP } = await admin
                .from("products")
                .insert({
                  name: productName,
                  category: "software",
                  softone_code: productCode || null,
                })
                .select("id")
                .single();
              productId = newP?.id ?? null;
            }
            if (!productId) continue;

            const payload = {
              customer_id: cust.id,
              product_id: productId,
              contract_number: contractNumber,
              quantity: Number(row.quantity ?? row.QTY1 ?? 1) || 1,
              start_date: String(row.start_date ?? row.FROMDATE ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
              end_date: String(row.end_date ?? row.TODATE ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
              notes: row.notes ? String(row.notes) : null,
              source: "softone_sync" as const,
              locked_from_sync: true,
            };

            const { data: existing } = await admin
              .from("contracts")
              .select("id")
              .eq("contract_number", contractNumber)
              .eq("customer_id", cust.id)
              .maybeSingle();
            if (existing) {
              await admin.from("contracts").update(payload).eq("id", existing.id);
            } else {
              await admin.from("contracts").insert(payload);
            }
            contractsSynced++;
          } catch (e) {
            errorsCount++;
            errors.push(`contract row: ${(e as Error).message}`);
          }
        }
      } else if (!conData.success) {
        errors.push(`contracts SQL: ${conData.error ?? "unknown"}`);
        errorsCount++;
      }
    }

    const duration = Date.now() - startedAt;
    const total = customersSynced + productsSynced + contractsSynced;
    const status = errorsCount > 0 && total === 0 ? "failed" : errorsCount > 0 ? "partial" : "success";
    const message = errors.slice(0, 5).join(" | ") || `OK — ${customersSynced} customers, ${productsSynced} products, ${contractsSynced} contracts`;

    await admin.from("softone_sync_logs").insert({
      status,
      customers_synced: customersSynced,
      products_synced: productsSynced,
      contracts_synced: contractsSynced,
      errors_count: errorsCount,
      duration_ms: duration,
      message,
      triggered_by: user.id,
    });

    await admin
      .from("softone_settings")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: status,
        last_sync_message: message,
      })
      .eq("id", settings.id);

    return ok({ success: true, status, customersSynced, productsSynced, contractsSynced, errorsCount, durationMs: duration, message });
  } catch (e) {
    console.error("softone-sync error", e);
    return ok({ success: false, error: (e as Error).message }, 500);
  }
});
