# Deployment rules
- Use a staged self-host installer: prepare configuration separately from starting services so real OAuth credentials and migration backups can be reviewed first.
- Keep self-host service additions in a Compose override rather than modifying the upstream stack; this preserves upstream environment defaults and service naming.
- Apply legacy SQL migrations before Drizzle custom SQL, recording each successful file in the self-host migration ledger to avoid replaying changes.
- Role/access RPCs permit only self-checks, server-side administrators and trusted database/service operations; guard SECURITY DEFINER reads before evaluating caller-chosen IDs to prevent cross-account probing.
- Support chat accepts bounded, alternating user/assistant text history only; server instructions never come from request message roles or metadata.
- Resolve MCP issuers at build time separately from runtime database URLs; export VM functions from that same build to prevent Cloud/VM issuer mixing.
- Use a shared lazy caller-scoped MCP database factory with public-key fallbacks; this preserves RLS in both Cloud and self-hosted runtimes.
- Canonicalize local authentication return paths once and wait for session hydration before navigation; this preserves consent across login and registration without external redirects.