ALTER TABLE public.ai_assistant_settings
  ADD COLUMN IF NOT EXISTS enabled_tools JSONB NOT NULL
    DEFAULT '["getMyContracts","getMyDevices","getMyLicenses","getCopilotUsage","getMyTickets"]'::jsonb,
  ADD COLUMN IF NOT EXISTS extra_context TEXT;