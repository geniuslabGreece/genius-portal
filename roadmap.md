# Docker self-host deployment
- [x] Add a staged installer that prepares both environment files without exposing secrets.
- [x] Wire OAuth and function secrets through a Compose override and run both migration directories.
- [x] Update the guide with data migration limitations, HTTPS startup and checks.
- [x] Test env generation and migration discovery locally; real containers/OAuth require the user's VM and credentials.

# Login and VM agent connections
- [x] Check Google/Microsoft login and registration return paths and fix identified defects.
- [x] Add separate VM MCP issuer configuration, staging instructions and automated checks.
- [ ] Verify agent connection on the real VM (blocked: API health and OAuth discovery return HTTP 502).