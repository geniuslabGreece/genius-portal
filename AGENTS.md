# Deployment rules
- Use a staged self-host installer: prepare configuration separately from starting services so real OAuth credentials and migration backups can be reviewed first.
- Keep self-host service additions in a Compose override rather than modifying the upstream stack; this preserves upstream environment defaults and service naming.
- Apply legacy SQL migrations before Drizzle custom SQL, recording each successful file in the self-host migration ledger to avoid replaying changes.
- Role/access RPCs permit only self-checks, server-side administrators and trusted database/service operations; guard SECURITY DEFINER reads before evaluating caller-chosen IDs to prevent cross-account probing.
- Support chat accepts bounded, alternating user/assistant text history only; server instructions never come from request message roles or metadata.