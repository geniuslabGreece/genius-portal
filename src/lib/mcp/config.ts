export function mcpIssuer(explicit: string | undefined, projectRef: string | undefined): string {
  if (explicit?.trim()) {
    const url = new URL(explicit.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      throw new Error("MCP issuer must be an HTTPS issuer URL without credentials, query or fragment.");
    }
    return url.href.replace(/\/$/, "");
  }
  if (projectRef === "selfhosted") throw new Error("Set VITE_MCP_OAUTH_ISSUER for the VM before building.");
  return `https://${projectRef || "project-ref-unset"}.supabase.co/auth/v1`;
}