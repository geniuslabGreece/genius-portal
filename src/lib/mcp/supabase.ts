import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

type Runtime = typeof globalThis & {
  Deno?: { env?: { get: (key: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};
function env(key: string) {
  const runtime = globalThis as Runtime;
  return runtime.Deno?.env?.get(key) ?? runtime.process?.env?.[key];
}
function publicKey() {
  const direct = env("SUPABASE_PUBLISHABLE_KEY");
  if (direct) return direct;
  try {
    const keys: unknown = JSON.parse(env("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    if (keys && typeof keys === "object") {
      const key = Object.values(keys).find((value): value is string => typeof value === "string" && value.startsWith("sb_publishable_"));
      if (key) return key;
    }
  } catch { /* Retain legacy public-key fallback. */ }
  const legacy = env("SUPABASE_ANON_KEY");
  if (!legacy) throw new Error("MCP public database key is not configured.");
  return legacy;
}
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("A verified OAuth token is required.");
  const url = env("SUPABASE_URL");
  if (!url) throw new Error("MCP database URL is not configured.");
  return createClient(url, publicKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}