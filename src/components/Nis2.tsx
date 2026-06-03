import { ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Nis2 = () => {
  return (
    <section id="nis2" className="py-24 md:py-32">
      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-destructive">
              <ShieldCheck className="h-3.5 w-3.5" />
              EU Directive
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold text-foreground md:text-5xl text-balance">
              NIS 2: Η πιο εκτεταμένη ευρωπαϊκή οδηγία cybersecurity
            </h2>
            <p className="mt-5 text-muted-foreground md:text-lg">
              Η Οδηγία NIS 2 απαιτεί από τα κράτη-μέλη της ΕΕ να διασφαλίζουν ότι 
              οι φορείς κρίσιμων υποδομών και βασικών υπηρεσιών εφαρμόζουν 
              κατάλληλα μέτρα ασφαλείας, προσαρμοσμένα στους ξεχωριστούς κινδύνους 
              των δικτύων και των πληροφοριακών τους συστημάτων.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <a href="#contact">
                  Συμβουλευτική NIS 2
                  <ArrowRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="https://digital-strategy.ec.europa.eu/el/faqs/directive-measures-high-common-level-cybersecurity-across-union-nis2-directive-faqs" target="_blank" rel="noreferrer">
                  Compliance NIS 2 FAQs
                </a>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-3xl gradient-primary opacity-20 blur-2xl" />
            <div className="rounded-3xl border border-border gradient-card p-8 shadow-elegant md:p-10">
              <div className="grid grid-cols-2 gap-4">
                {[
                  "Risk management",
                  "Incident reporting",
                  "Business continuity",
                  "Supply chain security",
                  "Network security",
                  "Access control",
                ].map((it) => (
                  <div key={it} className="flex items-start gap-3 rounded-xl bg-muted/50 p-4">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full gradient-red">
                      <ShieldCheck className="h-3 w-3 text-primary-foreground" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{it}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                Η GeniusNet, σε συνεργασία με την WatchGuard, σας βοηθά να
                συμμορφωθείτε με την Οδηγία NIS 2.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
