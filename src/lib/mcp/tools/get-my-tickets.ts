import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_my_tickets",
  title: "Get my support tickets",
  description: "List the signed-in customer's support tickets. Optionally filter to open (non-resolved) tickets.",
  inputSchema: {
    status: z.enum(["all", "open"]).optional().describe("'all' returns every ticket; 'open' excludes resolved."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("tickets")
      .select("ticket_number, subject, status, priority, department, created_at, resolved_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status === "open") q = q.neq("status", "resolved");
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify({ count: data?.length ?? 0, tickets: data ?? [] }) }],
      structuredContent: { count: data?.length ?? 0, tickets: data ?? [] },
    };
  },
});
