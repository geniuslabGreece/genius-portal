# Deployment rules
- Use a staged self-host installer: prepare configuration separately from starting services so real OAuth credentials and migration backups can be reviewed first.
- Keep self-host service additions in a Compose override rather than modifying the upstream stack; this preserves upstream environment defaults and service naming.
- Apply legacy SQL migrations before Drizzle custom SQL, recording each successful file in the self-host migration ledger to avoid replaying changes.