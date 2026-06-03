import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Lock, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/geniusnet-logo-wide.jpg";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [validSession, setValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Supabase auto-handles the recovery token in the URL hash and creates a session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session);
      if (!session) {
        toast.error("Μη έγκυρος σύνδεσμος", {
          description: "Ο σύνδεσμος επαναφοράς έληξε ή είναι άκυρος.",
        });
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setValidSession(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Οι κωδικοί δεν ταιριάζουν");
      return;
    }
    if (password.length < 6) {
      toast.error("Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error("Αποτυχία ενημέρωσης κωδικού", { description: error.message });
      setBusy(false);
      return;
    }
    toast.success("Ο κωδικός ενημερώθηκε", {
      description: "Μπορείτε τώρα να συνδεθείτε με τον νέο σας κωδικό.",
    });
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[hsl(220,85%,8%)] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(215 90% 70% / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(215 90% 70% / 0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-brand-red/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-2 text-sm text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Πίσω στη σύνδεση
          </button>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Lock className="h-3.5 w-3.5" />
            Ασφαλής επαναφορά κωδικού
          </div>
        </div>

        <div className="my-auto flex flex-col items-center justify-center py-10">
          <div className="w-full max-w-md">
            <img src={logo} alt="GeniusNet" className="mx-auto mb-6 h-12 w-auto rounded bg-white/95 p-2 shadow-elegant" />

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-elegant backdrop-blur-xl">
              <div className="mb-6">
                <h1 className="font-display text-2xl font-bold">Νέος κωδικός πρόσβασης</h1>
                <p className="mt-1.5 text-sm text-white/60">
                  Επιλέξτε έναν ισχυρό κωδικό για τον λογαριασμό σας.
                </p>
              </div>

              {validSession === false ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white/80">
                    Ο σύνδεσμος επαναφοράς έληξε ή είναι άκυρος. Ζητήστε νέο σύνδεσμο.
                  </div>
                  <Button
                    onClick={() => navigate("/login")}
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    Επιστροφή στη σύνδεση
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-white/80">Νέος κωδικός</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Τουλάχιστον 6 χαρακτήρες"
                      className="bg-white/5 text-white placeholder:text-white/30 border-white/10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="text-white/80">Επιβεβαίωση κωδικού</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Επαναλάβετε τον κωδικό"
                      className="bg-white/5 text-white placeholder:text-white/30 border-white/10"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    disabled={busy || validSession === null}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    Ενημέρωση κωδικού
                  </Button>
                </form>
              )}

              <div className="mt-5 flex items-start gap-2 text-xs text-white/55">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                <p>Ο κωδικός σας κρυπτογραφείται και αποθηκεύεται με ασφάλεια. Δεν τον βλέπει ποτέ κανείς.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-6 text-xs text-white/40">
          <p>© {new Date().getFullYear()} GeniusNet — Όλα τα δικαιώματα διατηρούνται.</p>
          <p>v3.0 · Customer Portal</p>
        </div>
      </div>
    </div>
  );
}
