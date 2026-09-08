import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ShieldCheck, Lock, Loader2, Mail, Apple, Globe, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/geniusnet-logo-wide.jpg";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/portal/auth/AuthContext";
import { Helmet } from "react-helmet-async";

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
    <path
      fill="#EA4335"
      d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.84 3.41 14.66 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12S6.76 21.5 12 21.5c6.93 0 9.5-4.86 9.5-9.34 0-.63-.07-1.11-.16-1.59z"
    />
  </svg>
);

const MicrosoftIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
    <rect x="2" y="2" width="9" height="9" fill="#F25022" />
    <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
    <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
    <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
  </svg>
);

type Mode = "signin" | "signup";

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState<"google" | "apple" | "azure" | "email" | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  const POST_LOGIN_KEY = "post_login_target";
  const getTarget = () => sessionStorage.getItem(POST_LOGIN_KEY) || "/portal";
  const setTarget = (path: string) => sessionStorage.setItem(POST_LOGIN_KEY, path);

  // Prefer ?next=<relative path> (e.g. OAuth consent), otherwise default to /portal
  useEffect(() => {
    const url = new URL(window.location.href);
    const next = url.searchParams.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      setTarget(next);
    } else if (!sessionStorage.getItem(POST_LOGIN_KEY)) {
      setTarget("/portal");
    }
  }, []);


  // Auto-redirect αν ο χρήστης είναι ήδη συνδεδεμένος
  useEffect(() => {
    if (!authLoading && user) {
      const target = getTarget();
      sessionStorage.removeItem(POST_LOGIN_KEY);
      navigate(target, { replace: true });
    }
  }, [authLoading, user, navigate]);

  const providerLabel: Record<OAuthProvider, string> = {
    google: "Google",
    apple: "Apple",
    azure: "Microsoft",
  };

  const startOAuth = async (provider: OAuthProvider) => {
    setBusy(provider);
    const result = await signInWithProvider(provider, `${window.location.origin}/login`);
    if (result.error) {
      toast.error(`Αποτυχία σύνδεσης με ${providerLabel[provider]}`, {
        description: result.error.message,
      });
      setBusy(null);
      return;
    }
    if (result.redirected) return;
    navigate(getTarget());
  };

  const handleGoogle = () => startOAuth("google");
  const handleApple = () => startOAuth("apple");
  const handleMicrosoft = () => startOAuth("azure");

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("email");

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${getTarget()}`,
          data: { full_name: fullName },
        },
      });

      if (error) {
        toast.error("Αποτυχία εγγραφής", { description: error.message });
        setBusy(null);
        return;
      }
      toast.success("Λογαριασμός δημιουργήθηκε", {
        description: "Συνδεθείτε για να συνεχίσετε.",
      });
      setMode("signin");
      setBusy(null);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error("Αποτυχία σύνδεσης", { description: error.message });
      setBusy(null);
      return;
    }
    const target = getTarget();
    sessionStorage.removeItem(POST_LOGIN_KEY);
    navigate(target);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("Αποτυχία αποστολής", { description: error.message });
      setForgotBusy(false);
      return;
    }
    toast.success("Email στάλθηκε", {
      description: "Ελέγξτε το inbox σας για τον σύνδεσμο επαναφοράς κωδικού.",
    });
    setForgotBusy(false);
    setShowForgot(false);
    setForgotEmail("");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[hsl(220,85%,8%)] text-white">
      <Helmet>
        <title>Σύνδεση — GeniusNet Customer Portal</title>
        <meta name="description" content="Συνδεθείτε στο GeniusNet Customer Portal για να διαχειριστείτε συμβόλαια, άδειες, συσκευές και υποστήριξη." />
        <link rel="canonical" href="https://geniusnetsoc.lovable.app/login" />
        <meta property="og:title" content="GeniusNet Customer Portal — Σύνδεση" />
        <meta property="og:description" content="Είσοδος για πελάτες της GeniusNet: συμβόλαια, άδειες Microsoft 365, συσκευές και υποστήριξη." />
        <meta property="og:url" content="https://geniusnetsoc.lovable.app/login" />
      </Helmet>
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

      <main className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-full border border-white/15 bg-white/[0.04] p-1 backdrop-blur-md shadow-elegant w-fit">
            <button
              type="button"
              onClick={() => setTarget("/portal")}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground shadow-md"
              aria-current="page"
            >
              <UserCircle2 className="h-4 w-4" />
              Customer Portal
            </button>
            <button
              type="button"
              onClick={() => { setTarget("/site"); navigate("/site"); }}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <Globe className="h-4 w-4" />
              Εταιρικό Site
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Lock className="h-3.5 w-3.5" />
            Ασφαλής σύνδεση μέσω OAuth 2.0
          </div>
        </div>

        <div className="my-auto grid items-center gap-16 py-10 lg:grid-cols-2">
          <div className="space-y-6">
            <img src={logo} alt="GeniusNet" className="h-12 w-auto rounded bg-white/95 p-2 shadow-elegant" />
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Customer Portal</p>
              <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
                Όλα τα συμβόλαιά σας,{" "}
                <span className="bg-gradient-to-r from-accent to-primary-glow bg-clip-text text-transparent">
                  σε ένα μέρος.
                </span>
              </h1>
              <p className="max-w-md text-base leading-relaxed text-white/70">
                Παρακολουθήστε software, hardware, ERP και devices σε πραγματικό χρόνο.
                Λάβετε αυτόματες ειδοποιήσεις πριν λήξει οποιοδήποτε συμβόλαιο.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              {[
                { k: "500+", v: "ενεργοί πελάτες" },
                { k: "24/7", v: "παρακολούθηση" },
                { k: "60·30·7", v: "ημέρες ειδοποιήσεις" },
                { k: "ISO 27001", v: "ασφάλεια δεδομένων" },
              ].map((s) => (
                <div key={s.v} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="font-display text-2xl font-bold text-white">{s.k}</p>
                  <p className="text-xs text-white/60">{s.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sign-in card */}
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-elegant backdrop-blur-xl">
              <div className="mb-6">
                <h2 className="font-display text-2xl font-bold">
                  {mode === "signin" ? "Σύνδεση" : "Εγγραφή"}
                </h2>
                <p className="mt-1.5 text-sm text-white/60">
                  Χρησιμοποιήστε τον επαγγελματικό σας λογαριασμό.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-12 w-full justify-center gap-3 bg-white text-foreground hover:bg-white/90"
                  onClick={handleGoogle}
                  disabled={busy !== null}
                >
                  {busy === "google" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GoogleIcon />
                  )}
                  Σύνδεση με Google
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-12 w-full justify-center gap-3 bg-black text-white hover:bg-black/90"
                  onClick={handleApple}
                  disabled={busy !== null}
                >
                  {busy === "apple" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Apple className="h-5 w-5" />
                  )}
                  Σύνδεση με Apple
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-12 w-full justify-center gap-3 bg-white/40 text-foreground/70 hover:bg-white/40 cursor-not-allowed"
                  disabled
                  title="Διαθέσιμο σύντομα μέσω SAML SSO"
                >
                  <MicrosoftIcon />
                  Microsoft (σύντομα)
                </Button>
              </div>

              <div className="my-5 flex items-center gap-3 text-xs text-white/40">
                <div className="h-px flex-1 bg-white/10" />
                <span>ή με email</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-white/80">Ονοματεπώνυμο</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="π.χ. Γιώργος Δημητρίου"
                      className="bg-white/5 text-white placeholder:text-white/30 border-white/10"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-white/80">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    className="bg-white/5 text-white placeholder:text-white/30 border-white/10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-white/80">Κωδικός</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email);
                          setShowForgot(true);
                        }}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        Ξεχάσατε τον κωδικό;
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Τουλάχιστον 6 χαρακτήρες"
                    className="bg-white/5 text-white placeholder:text-white/30 border-white/10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={busy !== null}
                >
                  {busy === "email" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  {mode === "signin" ? "Σύνδεση" : "Δημιουργία λογαριασμού"}
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-white/55">
                {mode === "signin" ? "Δεν έχετε λογαριασμό; " : "Έχετε ήδη λογαριασμό; "}
                <button
                  type="button"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                  className="font-medium text-accent hover:underline"
                >
                  {mode === "signin" ? "Εγγραφή" : "Σύνδεση"}
                </button>
              </p>

              <div className="mt-5 space-y-2 text-xs text-white/55">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  <p>Δεν αποθηκεύουμε κωδικούς πάροχων. Η ταυτοποίηση γίνεται απευθείας από τον πάροχό σας.</p>
                </div>
                <p>
                  Χρειάζεστε βοήθεια;{" "}
                  <a href="mailto:support@geniusnet.gr" className="font-medium text-accent hover:underline">
                    support@geniusnet.gr
                  </a>
                </p>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] text-white/40">
              Με τη σύνδεση αποδέχεστε τους Όρους Χρήσης & την Πολιτική Απορρήτου.
            </p>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-6 text-xs text-white/40">
          <p>© {new Date().getFullYear()} GeniusNet — Όλα τα δικαιώματα διατηρούνται.</p>
          <p>v3.0 · Customer Portal</p>
        </div>
      </main>

      {showForgot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => !forgotBusy && setShowForgot(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[hsl(220,85%,10%)] p-6 shadow-elegant"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl font-bold text-white">Επαναφορά κωδικού</h3>
            <p className="mt-1.5 text-sm text-white/60">
              Δώστε το email σας και θα σας στείλουμε σύνδεσμο για να ορίσετε νέο κωδικό.
            </p>
            <form onSubmit={handleForgotPassword} className="mt-5 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-white/80">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@company.com"
                  className="bg-white/5 text-white placeholder:text-white/30 border-white/10"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 bg-white/10 text-white hover:bg-white/15"
                  onClick={() => setShowForgot(false)}
                  disabled={forgotBusy}
                >
                  Ακύρωση
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={forgotBusy}
                >
                  {forgotBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Αποστολή
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
