import { Eye, KeyRound } from "lucide-react";

const items = [
  {
    icon: Eye,
    badge: "WatchGuard ThreatSync",
    title: "eXtended Detection & Response",
    desc: "Το XDR συνδυάζει δεδομένα από πολλαπλά security components και ενισχύει την ανίχνευση με κεντρικούς μηχανισμούς απόκρισης. Ελαχιστοποιήστε τα κενά visibility, alert fatigue και βελτιώστε χρόνους ανίχνευσης.",
  },
  {
    icon: KeyRound,
    badge: "WatchGuard AuthPoint",
    title: "Multi-Factor Authentication",
    desc: "Το MFA παρέχει την ασφάλεια που χρειάζεστε για να προστατεύσετε ταυτότητες, assets, accounts και πληροφορίες — εύχρηστο, οικονομικό και πλήρες.",
  },
];

export const TechHighlights = () => {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 -z-10 bg-muted/40" />
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-red">Νέες τεχνολογίες</span>
          <h2 className="mt-3 font-display text-3xl font-bold text-foreground md:text-5xl text-balance">
            Ανακαλύψτε τις νεότερες τεχνολογίες σε Cybersecurity
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div key={it.title} className="group relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-soft transition-smooth hover:shadow-elegant md:p-10">
                <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full gradient-primary opacity-10 blur-3xl transition-smooth group-hover:opacity-20" />
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-glow">
                  <Icon className="h-7 w-7 text-primary-foreground" />
                </div>
                <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                  {it.badge}
                </span>
                <h3 className="mt-3 font-display text-2xl font-bold text-foreground md:text-3xl">{it.title}</h3>
                <p className="mt-4 text-muted-foreground">{it.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
