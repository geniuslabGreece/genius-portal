
## Στόχος
Δύο νέα features στο portal, διαθέσιμα σε όλους τους χρήστες του πελάτη:
1. **AI Assistant (Gemini)** — chat σύμβουλος που απαντάει με γνώση των δεδομένων του πελάτη (συμβόλαια, devices, licenses, tickets).
2. **Microsoft 365 Copilot analytics** — νέο tab στο Azure AD panel με licenses & usage per user, μέσω Microsoft Graph.

---

## 1) AI Assistant με Gemini

**Στρατηγική:** Χρήση **Lovable AI Gateway** (`google/gemini-3-flash-preview`) αντί για Gemini Enterprise connector — ο gateway είναι ήδη ρυθμισμένος (`LOVABLE_API_KEY` υπάρχει), δουλεύει per-user χωρίς OAuth, και μας επιτρέπει να δώσουμε στο μοντέλο μόνο τα δεδομένα του συγκεκριμένου customer (data isolation μέσω RLS).

**UI:**
- Νέο route `/portal/assistant` και link στο sidebar (Sparkles icon → χρήση custom Bot icon για να μην είναι generic).
- AI Elements composition: `Conversation`, `Message`, `MessageResponse`, `PromptInput`, `Shimmer`, `Tool`.
- One conversation, localStorage persistence (απλό, δεν χρειάζεται DB τώρα).

**Backend:** Νέο edge function `ai-assistant` που:
- Επαληθεύει JWT, παίρνει `customer_id` του χρήστη.
- Streamάρει απάντηση με `streamText` + Lovable AI Gateway.
- Έχει tools (read-only) με `stopWhen: stepCountIs(50)`:
  - `getMyContracts` — συμβόλαια του πελάτη
  - `getMyDevices` — Azure AD devices  
  - `getMyLicenses` — Azure AD licenses
  - `getMyTickets` — open tickets
- Όλα τα tools εκτελούνται με service role + φίλτρο `customer_id = <από JWT>` ώστε ένας χρήστης να μη βλέπει δεδομένα άλλου πελάτη.

---

## 2) Microsoft 365 Copilot Analytics

**Δεδομένα:** Microsoft Graph API:
- `/subscribedSkus` → ήδη συγχρονίζεται· φιλτράρουμε για Copilot SKUs (`Microsoft_365_Copilot`, `Microsoft_Copilot_Business`, `Copilot_Pro_for_Business` κ.ά.).
- `/users?$select=...&$expand=assignedLicenses` → ποιοι χρήστες έχουν assigned το Copilot SKU.
- `/reports/getMicrosoft365CopilotUsageUserDetail(period='D30')` → usage per user (last activity date, apps used). **Απαιτεί επιπλέον Graph permission: `Reports.Read.All`**.

**Schema:** Νέος πίνακας `customer_copilot_usage` (customer_id, user_principal_name, display_name, assigned_sku, last_activity_date, apps_used, copilot_chat_last_activity, teams_copilot_last_activity, word/excel/powerpoint/outlook last_activity, period_days, last_synced_at). RLS ίδιο pattern με τους άλλους Azure πίνακες.

**Sync:** Το edge function `azure-ad-sync` επεκτείνεται:
- Νέο action `sync_copilot` που καλεί τα δύο Graph endpoints.
- Logged στο `customer_azure_ad_sync_logs` με νέα στήλη `copilot_synced`.

**UI:** Νέο tab "Copilot" στο `AzureAdPanel`:
- Card με σύνολο Copilot licenses (assigned/total).
- Table: χρήστες με Copilot, last activity per app (Chat/Teams/Word/Excel/PowerPoint/Outlook), badge "Active/Inactive (30d)".
- Κουμπί "Sync Copilot data" που τρέχει το νέο action.

---

## Τεχνικές αλλαγές

**Νέα/τροποποιημένα αρχεία:**
- `supabase/functions/ai-assistant/index.ts` (νέο)
- `supabase/functions/azure-ad-sync/index.ts` (επέκταση για Copilot)
- `src/portal/pages/Assistant.tsx` (νέο)
- `src/portal/components/ai/*` (AI Elements composition)
- `src/portal/components/CopilotUsageCard.tsx` (νέο)
- `src/portal/components/AzureAdPanel.tsx` (νέο tab)
- `src/portal/PortalLayout.tsx` (sidebar link)
- `src/App.tsx` (route)
- Migration για `customer_copilot_usage` table + `copilot_synced` column + GRANTs + RLS.

**AI Elements install:** `bun x ai-elements@latest add conversation message prompt-input shimmer tool`.

**Παρενέργειες/απαιτήσεις:**
- Ο admin κάθε πελάτη πρέπει να δώσει στο Azure AD App registration την επιπλέον permission `Reports.Read.All` (Application). Θα προστεθεί note στο Azure AD settings UI.
- Το Lovable AI Gateway χρεώνεται per request από το workspace — όχι από τον πελάτη.

---

## Εκτός scope (επόμενα βήματα αν χρειαστούν)
- Per-user OAuth Gemini Enterprise (αν θέλετε ACL-aware search στο Google Workspace του πελάτη).
- Multi-thread conversation history στη DB.
- Copilot adoption recommendations / proactive alerts.
