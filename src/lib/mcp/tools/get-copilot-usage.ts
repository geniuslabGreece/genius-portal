import { supabaseForUser } from "../supabase";
import { defineTool } from "@lovable.dev/mcp-js";


export default defineTool({
  name: "get_copilot_usage",
  title: "Get Microsoft 365 Copilot usage",
  description:
    "List the signed-in customer's Microsoft 365 Copilot usage per user (assigned license and last activity across Chat/Teams/Word/Excel/PowerPoint/Outlook).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("customer_copilot_usage")
      .select(
        "user_principal_name, display_name, assigned_sku, has_assigned_license, last_activity_date, copilot_chat_last_activity, microsoft_teams_copilot_last_activity, word_copilot_last_activity, excel_copilot_last_activity, powerpoint_copilot_last_activity, outlook_copilot_last_activity",
      )
      .order("user_principal_name")
      .limit(500);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify({ count: data?.length ?? 0, copilot: data ?? [] }) }],
      structuredContent: { count: data?.length ?? 0, copilot: data ?? [] },
    };
  },
});
