import { Server, ShieldCheck, Database, Network, ArrowUpRight } from "lucide-react";

const services = [
  {
    icon: Server,
    title: "IT Services",
    color: "primary",
    items: ["Business continuity", "Cloud services", "Security", "Backup as a service", "Wi-Fi services"],
  },
  {
    icon: Database,
    title: "Entersoft ONE",
    badge: "Premium Partner",
    color: "red",
    items: ["Cloud", "Enterprise mobility", "Artificial intelligence", "Social media", "Big data"],
  },
  {
    icon: ShieldCheck,
    title: "Cybersecurity",
    color: "primary",
    items: ["Firewall", "Endpoint protection", "Anti-hacking", "Intrusion prevention", "Anti-ransomware"],
  },
  {
    icon: Network,
    title: "Infrastructure",
    color: "primary",
    items: ["Server", "Networking", "Backup", "Virtualization", "Wi-Fi"],
  },
];

export const Services = () => {
  return (
    <section id="services" className="py-24 md:py-32">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-red">Τι κάνουμε</span>
          <h2 className="mt-3 font-display text-3xl font-bold text-foreground md:text-5xl text-balance">
            Τέσσερις πυλώνες, μία ολοκληρωμένη λύση
          </h2>
          <p className="mt-4 text-muted-foreground md:text-lg">
            Σχεδιάζουμε, υλοποιούμε και υποστηρίζουμε IT projects κάθε κλίμακας — 
            με συνεργασίες κορυφαίων κατασκευαστών.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {services.map((s, i) => {
            const Icon = s.icon;
            const isRed = s.color === "red";
            return (
              <div
                key={s.title}
                className="group relative overflow-hidden rounded-2xl border border-border gradient-card p-6 shadow-soft transition-smooth hover:-translate-y-1 hover:shadow-elegant"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ${isRed ? "gradient-red shadow-red-glow" : "gradient-primary shadow-glow"}`}>
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>

                <div className="flex items-start justify-between">
                  <h3 className="font-display text-xl font-bold text-foreground">{s.title}</h3>
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-0 transition-smooth group-hover:opacity-100" />
                </div>

                {s.badge && (
                  <span className="mt-1 inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                    {s.badge}
                  </span>
                )}

                <ul className="mt-5 space-y-2">
                  {s.items.map((it) => (
                    <li key={it} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className={`h-1.5 w-1.5 rounded-full ${isRed ? "bg-brand-red" : "bg-primary"}`} />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
