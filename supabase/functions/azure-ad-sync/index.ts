// Edge function: συγχρονισμός Azure AD users + devices ενός πελάτη.
// Action "test"  → επικύρωση credentials με client_credentials flow.
// Action "sync"  → φέρνει users + devices από Microsoft Graph και ενημερώνει cache.
// Πρόσβαση: μόνο admins (server-side έλεγχος μέσω is_admin).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  customer_id: string;
  action: "test" | "sync" | "save_credentials" | "sync_copilot";
  // Για "test" όταν δεν έχουν αποθηκευτεί ακόμη
  override?: { tenant_id: string; client_id: string; client_secret: string };
  // Για "save_credentials"
  credentials?: { tenant_id: string; client_id: string; client_secret: string; enabled: boolean };
}

// ─────────────────────────────────────────────────────────────
// AES-GCM helpers (server-side only, key from AZURE_AD_ENC_KEY env)
// ─────────────────────────────────────────────────────────────
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getEncKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("AZURE_AD_ENC_KEY");
  if (!raw) throw new Error("AZURE_AD_ENC_KEY δεν έχει οριστεί");
  let bytes: Uint8Array;
  try {
    bytes = b64ToBytes(raw);
  } catch {
    bytes = new TextEncoder().encode(raw);
  }
  if (bytes.length < 16) throw new Error("AZURE_AD_ENC_KEY πολύ μικρό (≥16 bytes)");
  // Use first 32 bytes (or hash to 32) — accept 16/24/32
  let keyBytes: Uint8Array;
  if (bytes.length === 16 || bytes.length === 24 || bytes.length === 32) {
    keyBytes = bytes;
  } else {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    keyBytes = new Uint8Array(digest);
  }
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptSecret(plain: string): Promise<Uint8Array> {
  const key = await getEncKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)),
  );
  // Layout: [12 bytes IV][ciphertext+tag]
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out;
}

async function decryptSecret(payload: Uint8Array): Promise<string> {
  const key = await getEncKey();
  const iv = payload.slice(0, 12);
  const ct = payload.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// Postgres bytea hex format → Uint8Array
function pgByteaToBytes(v: any): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (typeof v === "string" && v.startsWith("\\x")) {
    const hex = v.slice(2);
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }
  throw new Error("Μη αναγνωρίσιμη μορφή κρυπτογραφημένου secret");
}

// PostgREST writes bytea as hex string \x...
function bytesToPgHex(b: Uint8Array): string {
  let s = "\\x";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}

async function getGraphToken(tenant: string, clientId: string, clientSecret: string) {
  const body = new URLSearchParams({
    client_id: clientId,
    scope: "https://graph.microsoft.com/.default",
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });
  const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.error || `Token error ${r.status}`);
  return j.access_token as string;
}

async function graphGetAll(url: string, token: string) {
  const out: any[] = [];
  let next: string | null = url;
  while (next) {
    const r: Response = await fetch(next, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `Graph error ${r.status}`);
    out.push(...(j.value ?? []));
    next = j["@odata.nextLink"] ?? null;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // user-scoped client to identify the caller
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // service client (bypasses RLS for admin check + writes)
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdminRpc, error: roleErr } = await admin.rpc("is_admin", { _user_id: user.id });
    if (roleErr) throw roleErr;

    const body = (await req.json()) as RequestBody;
    if (!body.customer_id || !body.action) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Allow either global admin, or a customer_admin for their OWN customer.
    if (!isAdminRpc) {
      const { data: ok } = await admin.rpc("is_customer_admin_for", {
        _user_id: user.id,
        _customer_id: body.customer_id,
      });
      if (!ok) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const startedAt = Date.now();

    // ─────────────────────────────────────────────────────────
    // SAVE CREDENTIALS (encrypted)
    // ─────────────────────────────────────────────────────────
    if (body.action === "save_credentials") {
      const c = body.credentials;
      if (!c) throw new Error("Λείπουν credentials");
      const tenant = (c.tenant_id ?? "").trim();
      const clientId = (c.client_id ?? "").trim();
      const guid = /^[0-9a-f-]{20,}$/i;
      if (!guid.test(tenant)) throw new Error("Tenant ID μη έγκυρο");
      if (!guid.test(clientId)) throw new Error("Client ID μη έγκυρο");

      const update: Record<string, any> = {
        customer_id: body.customer_id,
        tenant_id: tenant,
        client_id: clientId,
        enabled: !!c.enabled,
      };
      // Encrypt only if a new secret was provided (allow empty to keep existing)
      if (c.client_secret && c.client_secret.trim().length > 0) {
        const enc = await encryptSecret(c.client_secret.trim());
        update.client_secret_enc = bytesToPgHex(enc);
      }

      const { error } = await admin
        .from("customer_azure_ad_settings")
        .upsert(update, { onConflict: "customer_id" });
      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve credentials
    let tenant_id = body.override?.tenant_id ?? "";
    let client_id = body.override?.client_id ?? "";
    let client_secret = body.override?.client_secret ?? "";

    if (!body.override) {
      const { data: settings, error } = await admin
        .from("customer_azure_ad_settings")
        .select("tenant_id, client_id, client_secret_enc")
        .eq("customer_id", body.customer_id)
        .maybeSingle();
      if (error) throw error;
      if (!settings) throw new Error("Δεν υπάρχουν Azure AD ρυθμίσεις για τον πελάτη");
      tenant_id = settings.tenant_id;
      client_id = settings.client_id;
      if (!settings.client_secret_enc) throw new Error("Δεν υπάρχει αποθηκευμένο client secret");
      client_secret = await decryptSecret(pgByteaToBytes(settings.client_secret_enc));
    }

    if (!tenant_id || !client_id || !client_secret) {
      throw new Error("Λείπουν tenant_id / client_id / client_secret");
    }

    const token = await getGraphToken(tenant_id, client_id, client_secret);

    if (body.action === "test") {
      // Light call to verify scopes
      const r = await fetch("https://graph.microsoft.com/v1.0/organization?$select=id,displayName", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || `Graph error ${r.status}`);
      await admin.from("customer_azure_ad_sync_logs").insert({
        customer_id: body.customer_id,
        action: "test",
        status: "success",
        duration_ms: Date.now() - startedAt,
        triggered_by: user.id,
      });
      return new Response(JSON.stringify({ ok: true, organization: j.value?.[0] ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────
    // SYNC COPILOT (licenses + usage reports)
    // ─────────────────────────────────────────────────────────
    if (body.action === "sync_copilot") {
      const copilotSkuRegex = /COPILOT|MICROSOFT_365_COPILOT|M365_COPILOT|CPLT/i;

      // 1) Fetch users with assigned licenses to detect Copilot assignment
      const usersUrl = "https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,assignedLicenses&$top=200";
      const skusUrl = "https://graph.microsoft.com/v1.0/subscribedSkus";
      const [allUsers, allSkus] = await Promise.all([
        graphGetAll(usersUrl, token),
        graphGetAll(skusUrl, token),
      ]);

      const copilotSkuIds = new Set(
        allSkus
          .filter((s: any) => copilotSkuRegex.test(s.skuPartNumber ?? ""))
          .map((s: any) => s.skuId as string),
      );
      const copilotSkuLookup: Record<string, string> = {};
      for (const s of allSkus) {
        if (copilotSkuIds.has(s.skuId)) copilotSkuLookup[s.skuId] = s.skuPartNumber;
      }

      // 2) Fetch usage report (CSV) — Reports.Read.All permission required
      // Returns 30-day per-user activity for Copilot across M365 apps.
      const usageMap = new Map<string, any>();
      try {
        const reportRes = await fetch(
          "https://graph.microsoft.com/v1.0/reports/getMicrosoft365CopilotUsageUserDetail(period='D30')",
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (reportRes.ok) {
          const csvText = await reportRes.text();
          const lines = csvText.trim().split(/\r?\n/);
          if (lines.length > 1) {
            const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
            const idx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
            const iUpn = idx("User Principal Name");
            const iDn = idx("Display Name");
            const iLast = idx("Last activity date");
            const iChat = idx("Copilot chats");
            const iTeams = idx("Microsoft Teams Copilot last activity date");
            const iWord = idx("Word Copilot last activity date");
            const iExcel = idx("Excel Copilot last activity date");
            const iPpt = idx("PowerPoint Copilot last activity date");
            const iOutlook = idx("Outlook Copilot last activity date");
            const iOneNote = idx("OneNote Copilot last activity date");
            const iLoop = idx("Loop Copilot last activity date");
            const iCopilotChat = idx("Copilot chat last activity date");

            const safe = (row: string[], i: number) => (i >= 0 && row[i] ? row[i].replace(/^"|"$/g, "").trim() : null);
            const toDate = (v: string | null) => (v && v !== "" ? v : null);

            for (let li = 1; li < lines.length; li++) {
              // very small CSV parser (assumes no quoted commas, which Graph CSV typically doesn't have)
              const row = lines[li].split(",");
              const upn = safe(row, iUpn);
              if (!upn) continue;
              usageMap.set(upn.toLowerCase(), {
                display_name: safe(row, iDn),
                last_activity_date: toDate(safe(row, iLast)),
                copilot_chat_last_activity: toDate(safe(row, iCopilotChat >= 0 ? iCopilotChat : iChat)),
                microsoft_teams_copilot_last_activity: toDate(safe(row, iTeams)),
                word_copilot_last_activity: toDate(safe(row, iWord)),
                excel_copilot_last_activity: toDate(safe(row, iExcel)),
                powerpoint_copilot_last_activity: toDate(safe(row, iPpt)),
                outlook_copilot_last_activity: toDate(safe(row, iOutlook)),
                onenote_copilot_last_activity: toDate(safe(row, iOneNote)),
                loop_copilot_last_activity: toDate(safe(row, iLoop)),
              });
            }
          }
        } else {
          const errJ = await reportRes.json().catch(() => ({}));
          // Don't fail completely — usage report needs Reports.Read.All
          console.warn("Copilot usage report failed:", errJ?.error?.message ?? reportRes.status);
        }
      } catch (e) {
        console.warn("Copilot usage fetch error:", e);
      }

      // 3) Build rows: union of (users with Copilot license) and (users with usage activity)
      const rowsByUpn = new Map<string, any>();
      for (const u of allUsers) {
        const assigned = (u.assignedLicenses ?? []).find((al: any) => copilotSkuIds.has(al.skuId));
        if (assigned) {
          const upn = (u.userPrincipalName ?? u.mail ?? "").toLowerCase();
          if (!upn) continue;
          rowsByUpn.set(upn, {
            customer_id: body.customer_id,
            user_principal_name: u.userPrincipalName ?? u.mail,
            display_name: u.displayName,
            assigned_sku: copilotSkuLookup[assigned.skuId] ?? null,
            has_assigned_license: true,
            period_days: 30,
            last_synced_at: new Date().toISOString(),
          });
        }
      }
      for (const [upn, usage] of usageMap.entries()) {
        const existing = rowsByUpn.get(upn) ?? {
          customer_id: body.customer_id,
          user_principal_name: upn,
          display_name: usage.display_name,
          assigned_sku: null,
          has_assigned_license: false,
          period_days: 30,
          last_synced_at: new Date().toISOString(),
        };
        rowsByUpn.set(upn, { ...existing, ...usage, display_name: existing.display_name ?? usage.display_name });
      }

      await admin.from("customer_copilot_usage").delete().eq("customer_id", body.customer_id);
      const rows = Array.from(rowsByUpn.values());
      if (rows.length) {
        const { error } = await admin.from("customer_copilot_usage").insert(rows);
        if (error) throw error;
      }

      await admin.from("customer_azure_ad_sync_logs").insert({
        customer_id: body.customer_id,
        action: "sync_copilot",
        status: "success",
        copilot_synced: rows.length,
        duration_ms: Date.now() - startedAt,
        triggered_by: user.id,
      });

      return new Response(
        JSON.stringify({ ok: true, copilot_users: rows.length, with_license: Array.from(rowsByUpn.values()).filter((r) => r.has_assigned_license).length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // SYNC
    const usersUrl = "https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,jobTitle,accountEnabled&$top=200";
    const devicesUrl = "https://graph.microsoft.com/v1.0/devices?$select=id,displayName,operatingSystem,operatingSystemVersion,trustType,registrationDateTime,approximateLastSignInDateTime,isCompliant,isManaged,accountEnabled&$top=200";
    const skusUrl = "https://graph.microsoft.com/v1.0/subscribedSkus";
    const groupsUrl = "https://graph.microsoft.com/v1.0/groups?$select=id,displayName,description,securityEnabled,mailEnabled&$top=200";

    const [users, devices, skus, groups] = await Promise.all([
      graphGetAll(usersUrl, token),
      graphGetAll(devicesUrl, token),
      graphGetAll(skusUrl, token),
      graphGetAll(groupsUrl, token),
    ]);

    // Group memberships: map[azureUserId] → groupIds[]
    const userGroupMap = new Map<string, string[]>();
    const groupMemberCount = new Map<string, number>();
    for (let i = 0; i < groups.length; i += 10) {
      const slice = groups.slice(i, i + 10);
      await Promise.all(slice.map(async (g: any) => {
        try {
          const members = await graphGetAll(
            `https://graph.microsoft.com/v1.0/groups/${g.id}/members/microsoft.graph.user?$select=id&$top=999`,
            token,
          );
          groupMemberCount.set(g.id, members.length);
          for (const m of members) {
            const arr = userGroupMap.get(m.id) ?? [];
            arr.push(g.id);
            userGroupMap.set(m.id, arr);
          }
        } catch (e) {
          console.warn(`Group ${g.id} members fetch failed:`, e);
        }
      }));
    }

    const now = new Date().toISOString();

    // Replace cache for this customer
    await admin.from("customer_azure_ad_users").delete().eq("customer_id", body.customer_id);
    if (users.length) {
      const rows = users.map((u: any) => ({
        customer_id: body.customer_id,
        azure_object_id: u.id,
        display_name: u.displayName,
        mail: u.mail,
        user_principal_name: u.userPrincipalName,
        job_title: u.jobTitle,
        account_enabled: u.accountEnabled,
        azure_group_ids: userGroupMap.get(u.id) ?? [],
        last_synced_at: now,
      }));
      const { error } = await admin.from("customer_azure_ad_users").insert(rows);
      if (error) throw error;
    }

    // Replace groups cache
    await admin.from("customer_azure_ad_groups").delete().eq("customer_id", body.customer_id);
    if (groups.length) {
      const grows = groups.map((g: any) => ({
        customer_id: body.customer_id,
        azure_group_id: g.id,
        display_name: g.displayName,
        description: g.description,
        mail_enabled: !!g.mailEnabled,
        security_enabled: !!g.securityEnabled,
        member_count: groupMemberCount.get(g.id) ?? 0,
        last_synced_at: now,
      }));
      const { error } = await admin.from("customer_azure_ad_groups").insert(grows);
      if (error) throw error;
    }

    await admin.from("customer_azure_ad_devices").delete().eq("customer_id", body.customer_id);
    if (devices.length) {
      const rows = devices.map((d: any) => {
        const trust = d.trustType ?? null; // "AzureAd" | "ServerAd" | "Workplace"
        const join_type =
          trust === "AzureAd" ? "joined" :
          trust === "Workplace" ? "registered" :
          trust ?? null;
        return {
          customer_id: body.customer_id,
          azure_device_id: d.id,
          display_name: d.displayName,
          operating_system: d.operatingSystem,
          operating_system_version: d.operatingSystemVersion,
          trust_type: trust,
          join_type,
          registration_datetime: d.registrationDateTime ?? null,
          approximate_last_sign_in: d.approximateLastSignInDateTime ?? null,
          is_compliant: d.isCompliant ?? null,
          is_managed: d.isManaged ?? null,
          account_enabled: d.accountEnabled ?? null,
          last_synced_at: now,
        };
      });
      const { error } = await admin.from("customer_azure_ad_devices").insert(rows);
      if (error) throw error;
    }

    // LICENSES (Microsoft 365 / Windows / EMS κ.λπ.)
    await admin.from("customer_azure_ad_licenses").delete().eq("customer_id", body.customer_id);
    if (skus.length) {
      const friendly: Record<string, string> = {
        ENTERPRISEPACK: "Microsoft 365 E3",
        ENTERPRISEPREMIUM: "Microsoft 365 E5",
        SPE_E3: "Microsoft 365 E3",
        SPE_E5: "Microsoft 365 E5",
        SPB: "Microsoft 365 Business Premium",
        O365_BUSINESS_ESSENTIALS: "Microsoft 365 Business Basic",
        O365_BUSINESS_PREMIUM: "Microsoft 365 Business Standard",
        STANDARDPACK: "Office 365 E1",
        EXCHANGESTANDARD: "Exchange Online (Plan 1)",
        EXCHANGEENTERPRISE: "Exchange Online (Plan 2)",
        WIN_DEF_ATP: "Microsoft Defender for Endpoint",
        WINDOWS_STORE: "Windows Store for Business",
        WIN10_PRO_ENT_SUB: "Windows 10/11 Enterprise E3",
        WIN10_VDA_E5: "Windows 10/11 Enterprise E5",
        EMS: "Enterprise Mobility + Security E3",
        EMSPREMIUM: "Enterprise Mobility + Security E5",
        FLOW_FREE: "Power Automate Free",
        POWER_BI_STANDARD: "Power BI (free)",
        POWER_BI_PRO: "Power BI Pro",
      };
      const rows = skus.map((s: any) => ({
        customer_id: body.customer_id,
        sku_id: s.skuId,
        sku_part_number: s.skuPartNumber ?? null,
        display_name: friendly[s.skuPartNumber] ?? s.skuPartNumber ?? null,
        applies_to: s.appliesTo ?? null,
        capability_status: s.capabilityStatus ?? null,
        prepaid_enabled: s.prepaidUnits?.enabled ?? null,
        prepaid_suspended: s.prepaidUnits?.suspended ?? null,
        prepaid_warning: s.prepaidUnits?.warning ?? null,
        consumed_units: s.consumedUnits ?? null,
        last_synced_at: now,
      }));
      const { error } = await admin.from("customer_azure_ad_licenses").insert(rows);
      if (error) throw error;
    }

    await admin
      .from("customer_azure_ad_settings")
      .update({ last_sync_at: now, last_sync_error: null })
      .eq("customer_id", body.customer_id);

    await admin.from("customer_azure_ad_sync_logs").insert({
      customer_id: body.customer_id,
      action: "sync",
      status: "success",
      users_synced: users.length,
      devices_synced: devices.length,
      licenses_synced: skus.length,
      duration_ms: Date.now() - startedAt,
      triggered_by: user.id,
    });

    return new Response(JSON.stringify({ ok: true, users: users.length, devices: devices.length, licenses: skus.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    // try persist error message
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey);
      const body = await req.clone().json().catch(() => null) as any;
      if (body?.customer_id) {
        if (body?.action === "sync") {
          await admin.from("customer_azure_ad_settings").update({ last_sync_error: msg }).eq("customer_id", body.customer_id);
        }
        await admin.from("customer_azure_ad_sync_logs").insert({
          customer_id: body.customer_id,
          action: body.action ?? "unknown",
          status: "error",
          error_message: msg,
        });
      }
    } catch { /* noop */ }
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});