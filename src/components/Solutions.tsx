import { BarChart3, Cloud, Receipt, ShieldCheck, Truck } from "lucide-react";

const solutions = [
  {
    icon: BarChart3,
    title: "GeniusNet Basic Intelligence",
    tag: "Power BI",
    desc: "Άντλησε raw data από το ERP σου και μετάτρεψέ τα σε διαδραστικά dashboards, πίνακες και αναφορές.",
  },
  {
    icon: Cloud,
    title: "Microsoft 365",
    tag: "Productivity",
    desc: "Ασφαλής παραγωγικότητα σε hybrid κόσμο, με managed deployment και υποστήριξη.",
  },
  {
    icon: Receipt,
    title: "Cloud e-Invoicing",
    tag: "AADE compliant",
    desc: "Τιμολόγηση μέσω πιστοποιημένου παρόχου: μείωση κόστους, μηδενική αρχική επένδυση, φορολογικές εκπτώσεις.",
  },
  {
    icon: ShieldCheck,
    title: "Veeam Backup & Replication",
    tag: "Data protection",
    desc: "Ransomware protection, cloud acceleration και backup modernization για επιχειρηματική ανθεκτικότητα.",
  },
  {
    icon: Truck,
    title: "Regate Mobile Suite",
    tag: "Field operations",
    desc: "Sales force, merchandising, field service automation, portable invoicing & asset tracking.",
  },
];

export const Solutions = () => {
  return (
    <section id="solutions" className="py-24 md:py-32">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-red">
            Λύσεις
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold text-foreground md:text-5xl text-balance">
            Έτοιμες λύσεις για κάθε επιχειρηματική ανάγκη
          </h2>
          <p className="mt-4 text-muted-foreground md:text-lg">
            Από business intelligence και cloud productivity, έως e-invoicing,
            backup και mobile field automation.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {solutions.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="group relative overflow-hidden rounded-2xl border border-border gradient-card p-6 shadow-soft transition-smooth hover:-translate-y-1 hover:shadow-elegant"
              >
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full gradient-primary opacity-0 blur-3xl transition-smooth group-hover:opacity-30" />

                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-glow">
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>

                <span className="inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                  {s.tag}
                </span>

                <h3 className="mt-2 font-display text-xl font-bold text-foreground">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {s.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
