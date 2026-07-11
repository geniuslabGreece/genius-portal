import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyContracts from "./tools/get-my-contracts";
import getMyDevices from "./tools/get-my-devices";
import getMyLicenses from "./tools/get-my-licenses";
import getMyTickets from "./tools/get-my-tickets";
import getCopilotUsage from "./tools/get-copilot-usage";
import createTicket from "./tools/create-ticket";
import addTicketMessage from "./tools/add-ticket-message";

// OAuth issuer must be the direct Supabase host (never .lovable.cloud proxy).
// Build it from VITE_SUPABASE_PROJECT_ID which Vite inlines at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "geniusnet-portal-mcp",
  title: "GeniusNet Customer Portal",
  version: "0.1.0",
  instructions:
    "Access to the signed-in customer's GeniusNet portal data: contracts, Azure AD devices, Microsoft 365 licenses, Microsoft 365 Copilot usage and support tickets. Also supports creating new support tickets and posting replies. All tools run as the signed-in user under Row Level Security, so results and writes are always scoped to that user's company.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getMyContracts,
    getMyDevices,
    getMyLicenses,
    getCopilotUsage,
    getMyTickets,
    createTicket,
    addTicketMessage,
  ],
});
