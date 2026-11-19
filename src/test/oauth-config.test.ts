import { describe, expect, it } from "vitest";
import { isManagedAuthUrl, oauthReturnPath } from "../lib/oauth-return-path";
import { mcpIssuer } from "../lib/mcp/config";

describe("login and agent connection boundaries", () => {
  it("preserves consent through login and registration", () => {
    const path = "/.lovable/oauth/consent?authorization_id=test#account";
    expect(oauthReturnPath(path)).toBe(path);
  });
  it.each(["//outside.invalid", "/\\outside.invalid", "/\noutside", "https://outside.invalid"])("rejects unsafe return path %j", (path) => {
    expect(oauthReturnPath(path, "/portal")).toBe("/portal");
  });
  it("recognizes managed proxy URLs without treating the VM as Cloud", () => {
    expect(isManagedAuthUrl("https://example.lovable.cloud")).toBe(true);
    expect(isManagedAuthUrl("https://example.supabase.co")).toBe(true);
    expect(isManagedAuthUrl("https://api.geniusnetsoc.gr")).toBe(false);
  });
  it("uses the VM's own OAuth issuer", () => {
    expect(mcpIssuer("https://api.geniusnetsoc.gr/auth/v1", "selfhosted")).toBe("https://api.geniusnetsoc.gr/auth/v1");
  });
  it("refuses a selfhosted build without an explicit issuer", () => {
    expect(() => mcpIssuer(undefined, "selfhosted")).toThrow("VITE_MCP_OAUTH_ISSUER");
  });
  it("preserves the direct managed issuer", () => {
    expect(mcpIssuer(undefined, "example")).toBe("https://example.supabase.co/auth/v1");
  });
  it("rejects an insecure issuer", () => {
    expect(() => mcpIssuer("http://api.geniusnetsoc.gr/auth/v1", "selfhosted")).toThrow();
  });
});