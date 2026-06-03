import { PenTool, ShoppingCart, Wrench, Settings, LifeBuoy } from "lucide-react";

const steps = [
  { icon: PenTool, title: "Design", desc: "Σχεδιασμός λύσης βάσει αναγκών." },
  { icon: ShoppingCart, title: "Procure", desc: "Προμήθεια εξοπλισμού & licensing." },
  { icon: Wrench, title: "Install", desc: "Εγκατάσταση από έμπειρους μηχανικούς." },
  { icon: Settings, title: "Configure", desc: "Παραμετροποίηση & βελτιστοποίηση." },
  { icon: LifeBuoy, title: "Support", desc: "24/7 τεχνική υποστήριξη." },
];

export const ServiceCycle = () => {
  return (
    <section id="cycle" className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 -z-10 gradient-dark" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary-glow)/0.18),transparent_50%)]" />

      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-red">Η διαδικασία μας</span>
          <h2 className="mt-3 font-display text-3xl font-bold text-primary-foreground md:text-5xl text-balance">
            GeniusNet Integrated Services Cycle
          </h2>
          <p className="mt-4 text-primary-foreground/70 md:text-lg">
            Ένας κύκλος υπηρεσιών που καλύπτει το έργο σας από την πρώτη ιδέα 
            έως τη συνεχή λειτουργία του.
          </p>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-5">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="relative">
                <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-6 backdrop-blur transition-smooth hover:-translate-y-1 hover:border-primary-foreground/20 hover:bg-primary-foreground/10">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-glow">
                    <Icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-brand-red">
                    Step {i + 1}
                  </div>
                  <h3 className="mt-1 font-display text-xl font-bold text-primary-foreground">{s.title}</h3>
                  <p className="mt-2 text-sm text-primary-foreground/65">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-12 max-w-3xl text-center text-primary-foreground/70">
          Όποιες κι αν είναι οι ανάγκες της εταιρείας σας, η ομάδα ειδικών μας
          μπορεί να διαχειριστεί ολόκληρη τη διαδικασία υλοποίησης ενός έργου.
        </p>
      </div>
    </section>
  );
};
