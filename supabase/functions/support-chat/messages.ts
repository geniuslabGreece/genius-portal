export type SupportMessage = { role: "user" | "assistant"; content: string };

/** Conversation history is untrusted; only the server may add instruction roles. */
export function validateSupportMessages(input: unknown): SupportMessage[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 50) return null;
  let total = 0;
  const messages: SupportMessage[] = [];
  for (const value of input) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const { role, content } = value;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || !content.trim() || content.length > 8000) return null;
    // Preserve the UI's user/assistant history, not caller-supplied metadata or tool calls.
    if (role !== (messages.length % 2 === 0 ? "user" : "assistant")) return null;
    total += content.length;
    if (total > 40000) return null;
    messages.push({ role, content });
  }
  return messages[messages.length - 1].role === "user" ? messages : null;
}