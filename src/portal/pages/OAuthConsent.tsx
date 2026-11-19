import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Loader2, ExternalLink } from "lucide-react";
import { oauthReturnPath } from "@/lib/oauth-return-path";

// Typed shim for the beta supabase.auth.oauth namespace.
type OAuthDetails = {
  redirect_url?: string;
  redirect_to?: string;
  client?: { name?: string; client_uri?: string; logo_uri?: string; redirect_uris?: string[] };
  scope?: string;
  scopes?: string[];
  requested_scopes?: string[];
};
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
};
const oauthApi = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

function isSafeRelative(p: string) { return oauthReturnPath(p, "") !== ""; }

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
      if (!authorizationId) {
        setError("Λείπει το authorization_id.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search + window.location.hash;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error: err } = await oauthApi.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (err) {
        setError(err.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      if (!data) { setError("Το αίτημα σύνδεσης δεν είναι διαθέσιμο ή έχει λήξει."); return; }
      setDetails(data);
      } catch {
        if (active) setError("Δεν ήταν δυνατή η επικοινωνία με την υπηρεσία σύνδεσης. Δοκιμάστε ξανά.");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    try {
    const { data, error: err } = approve
      ? await oauthApi.approveAuthorization(authorizationId)
      : await oauthApi.denyAuthorization(authorizationId);
    if (err) {
      setBusy(null);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(null);
      setError("Ο authorization server δεν επέστρεψε redirect URL.");
      return;
    }
    window.location.href = target;
    } catch {
      setBusy(null);
      setError("Η απόφαση δεν ολοκληρώθηκε. Ξεκινήστε ξανά τη σύνδεση από την εφαρμογή σας.");
    }
  }

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30 p-6">
        <Card className="max-w-md space-y-4 p-6">
          <h1 className="font-display text-xl font-semibold">Αδυναμία σύνδεσης εφαρμογής</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => (window.location.href = "/portal")}>Επιστροφή στο portal</Button>
        </Card>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Φόρτωση αιτήματος σύνδεσης…
        </div>
      </div>
    );
  }

  const clientName = details.client?.name ?? "Εξωτερική εφαρμογή";
  const clientUri = details.client?.client_uri;
  const scopes = details.scopes ?? details.requested_scopes ?? (details.scope ? details.scope.split(" ") : []);

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <Card className="w-full max-w-md space-y-5 p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold">Σύνδεση {clientName} με GeniusNet Portal</h1>
            <p className="text-xs text-muted-foreground">Η εφαρμογή θα ενεργεί εκ μέρους σας.</p>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-background p-4 text-sm">
          <p className="font-medium">Τι θα μπορεί να κάνει η {clientName}:</p>
          <ul className="ml-4 list-disc text-muted-foreground">
            <li>Να καλεί τα διαθέσιμα MCP tools του portal εκ μέρους σας, με βάση τα δικαιώματα που ήδη έχετε.</li>
            <li>Να διαβάζει τα δεδομένα που επιτρέπονται ήδη στον λογαριασμό σας, μαζί με την πρόσβαση διαχειριστή αν υπάρχει.</li>
          </ul>
          {scopes.length > 0 && (
            <p className="pt-2 text-xs text-muted-foreground">
              Ζητούμενα scopes: <code className="rounded bg-muted px-1">{scopes.join(" ")}</code>
            </p>
          )}
          {clientUri && (
            <a
              href={clientUri}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> {clientUri}
            </a>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Αυτή η σύνδεση δεν παρακάμπτει τις πολιτικές πρόσβασης του portal. Μπορείτε να την ανακαλέσετε ανά πάσα στιγμή.
        </p>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={!!busy} onClick={() => decide(false)}>
            {busy === "deny" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Άρνηση"}
          </Button>
          <Button className="flex-1" disabled={!!busy} onClick={() => decide(true)}>
            {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Έγκριση"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Re-export type guard used above (kept unused to satisfy linter if imported)
export { isSafeRelative };
