import { supabaseForUser } from "../supabase";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";


export default defineTool({
  name: "get_my_contracts",
  title: "Get my contracts",
  description:
    "List the signed-in customer's contracts (software, hardware, ERP, devices). Optionally filter to those expiring within the next 60 days.",
  inputSchema: {
    status: z
      .enum(["all", "expiring_soon"])
      .optional()
      .describe("'all' returns every contract; 'expiring_soon' returns contracts ending within 60 days."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("contracts")
      .select(
        "id, contract_number, quantity, unit, start_date, end_date, notes, product:products(name, category, vendor)",
      )
      .order("end_date", { ascending: true })
      .limit(200);
    if (status === "expiring_soon") {
      const today = new Date().toISOString().slice(0, 10);
      const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      q = q.gte("end_date", today).lte("end_date", in60);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify({ count: data?.length ?? 0, contracts: data ?? [] }) }],
      structuredContent: { count: data?.length ?? 0, contracts: data ?? [] },
    };
  },
});
