export function oauthReturnPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const target = new URL(value, "https://app.invalid");
    if (target.origin !== "https://app.invalid" || target.pathname.startsWith("//")) return fallback;
    return target.pathname + target.search + target.hash;
  } catch { return fallback; }
}

export function isManagedAuthUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return hostname.endsWith(".supabase.co") || hostname.endsWith(".lovable.cloud");
  } catch { return false; }
}