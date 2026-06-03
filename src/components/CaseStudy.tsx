import { Quote, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const CaseStudy = () => {
  return (
    <section
      id="case-study"
      className="relative overflow-hidden border-y border-border bg-muted/30 py-24 md:py-32"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_30%,hsl(var(--brand-red)/0.08),transparent_55%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_70%,hsl(var(--primary)/0.1),transparent_55%)]" />

      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-destructive">
              Case Study
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold text-foreground md:text-5xl text-balance">
              Ψηφιακός μετασχηματισμός για την{" "}
              <span className="bg-gradient-to-r from-primary to-brand-red bg-clip-text text-transparent">
                ΣΤΕΡΓΙΟΥ
              </span>
            </h2>
            <p className="mt-4 text-muted-foreground md:text-lg">
              Με τις πρωτοποριακές λύσεις του Ομίλου SoftOne και την υλοποίηση
              της GeniusNet, η εταιρεία ΣΤΕΡΓΙΟΥ αναβάθμισε πλήρως τη
              λειτουργία της — από την παραγωγή έως την τιμολόγηση επί
              αυτοκινήτου.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { k: "100%", v: "Ψηφιοποίηση" },
                { k: "−40%", v: "Χρόνος τιμολόγησης" },
                { k: "24/7", v: "Διαθεσιμότητα" },
              ].map((s) => (
                <div
                  key={s.v}
                  className="rounded-xl border border-border bg-card p-4 text-center shadow-soft"
                >
                  <div className="font-display text-2xl font-bold text-foreground md:text-3xl">
                    {s.k}
                  </div>
                  <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {s.v}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Button asChild>
                <a href="#contact">
                  Ζήτησε παρόμοια λύση
                  <ArrowRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-3xl gradient-primary opacity-15 blur-3xl" />
            <div className="rounded-3xl border border-border gradient-card p-8 shadow-elegant md:p-10">
              <Quote className="h-10 w-10 text-brand-red" />
              <p className="mt-4 font-display text-xl font-medium leading-relaxed text-foreground md:text-2xl">
                «Η συνεργασία μας με τη GeniusNet μετασχημάτισε ριζικά τη
                διαχείριση των δεδομένων και των διαδικασιών μας — μια
                ολοκληρωμένη λύση που λειτουργεί άψογα κάθε μέρα.»
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-border pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full gradient-primary text-lg font-bold text-primary-foreground">
                  Σ
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Όμιλος ΣΤΕΡΓΙΟΥ
                  </div>
                  <div className="text-xs text-muted-foreground">
                    SoftOne ERP · Mobile Invoicing
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
