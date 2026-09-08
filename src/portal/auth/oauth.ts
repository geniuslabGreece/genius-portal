import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export type OAuthProvider = "google" | "azure" | "apple";

const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? "";

/**
 * Το Lovable Cloud auth helper (popup / web_message) δουλεύει μόνο όταν το backend
 * είναι το managed *.supabase.co. Σε self-hosted VM (π.χ. https://api.geniusnetsoc.gr)
 * πρέπει να πάμε απευθείας από τον supabase-js client στο GoTrue του VM.
 */
export const isManagedCloud = (() => {
  try {
    return new URL(SUPABASE_URL).hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
})();

interface Result {
  error?: { message: string } | null;
  redirected?: boolean;
}

/** Ξεκινά OAuth login και επιστρέφει σφάλμα ή ένδειξη redirect. */
export async function signInWithProvider(
  provider: OAuthProvider,
  redirectTo: string,
): Promise<Result> {
  if (isManagedCloud && (provider === "google" || provider === "apple")) {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: redirectTo });
    return result as Result;
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      scopes: provider === "azure" ? "openid profile email offline_access" : undefined,
    },
  });

  if (error) return { error };
  // Ο browser φεύγει προς τον provider.
  return { redirected: true };
}
