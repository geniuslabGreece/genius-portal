import { supabaseForUser } from "../supabase";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";


export default defineTool({
  name: "get_my_devices",
  title: "Get my Azure AD devices",
  description:
    "List the signed-in customer's Azure AD synced devices with OS, compliance and last sign-in.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("customer_azure_ad_devices")
      .select(
        "display_name, operating_system, operating_system_version, join_type, is_compliant, approximate_last_sign_in, account_enabled",
      )
      .order("display_name")
      .limit(500);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify({ count: data?.length ?? 0, devices: data ?? [] }) }],
      structuredContent: { count: data?.length ?? 0, devices: data ?? [] },
    };
  },
});
