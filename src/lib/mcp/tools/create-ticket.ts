import { supabaseForUser } from "../supabase";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";


export default defineTool({
  name: "create_ticket",
  title: "Create support ticket",
  description:
    "Create a new support ticket for the signed-in user's company. Runs under RLS, so the ticket is always attached to that company and to this user as creator.",
  inputSchema: {
    subject: z.string().trim().min(3).max(200).describe("Short subject line for the ticket."),
    description: z.string().trim().min(5).describe("Detailed description of the issue or request."),
    department: z
      .enum(["technical", "software", "erp", "hardware", "devices"])
      .describe("Target department."),
    priority: z
      .enum(["low", "normal", "high", "urgent"])
      .optional()
      .describe("Ticket priority. Defaults to 'normal'."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ subject, description, department, priority }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("customer_id")
      .eq("id", userId)
      .maybeSingle();
    if (profErr) return { content: [{ type: "text", text: profErr.message }], isError: true };
    if (!profile?.customer_id) {
      return {
        content: [{ type: "text", text: "Your account is not linked to a customer company; cannot create tickets." }],
        isError: true,
      };
    }

    const { data, error } = await supabase
      .from("tickets")
      .insert({
        customer_id: profile.customer_id,
        created_by: userId,
        subject,
        description,
        department,
        priority: priority ?? "normal",
      })
      .select("id, ticket_number, subject, status, priority, department, created_at")
      .single();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify({ ticket: data }) }],
      structuredContent: { ticket: data },
    };
  },
});
