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
  name: "add_ticket_message",
  title: "Add reply to a ticket",
  description:
    "Post a customer reply on one of the signed-in user's tickets. Accepts the ticket id (UUID) or the numeric ticket_number. RLS ensures the ticket belongs to the user's company. Internal/admin messages are not supported.",
  inputSchema: {
    ticket_id: z.string().uuid().optional().describe("Ticket UUID."),
    ticket_number: z.number().int().positive().optional().describe("Numeric ticket number as shown in the portal."),
    body: z.string().trim().min(1).max(10_000).describe("Message body."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ ticket_id, ticket_number, body }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    if (!ticket_id && !ticket_number) {
      return { content: [{ type: "text", text: "Provide ticket_id or ticket_number." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    let resolvedId = ticket_id;
    if (!resolvedId) {
      const { data: t, error: tErr } = await supabase
        .from("tickets")
        .select("id")
        .eq("ticket_number", ticket_number!)
        .maybeSingle();
      if (tErr) return { content: [{ type: "text", text: tErr.message }], isError: true };
      if (!t) return { content: [{ type: "text", text: "Ticket not found or not accessible." }], isError: true };
      resolvedId = t.id;
    }

    const { data, error } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: resolvedId,
        author_user_id: ctx.getUserId(),
        author_type: "customer",
        is_internal: false,
        body,
      })
      .select("id, ticket_id, body, created_at")
      .single();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify({ message: data }) }],
      structuredContent: { message: data },
    };
  },
});
