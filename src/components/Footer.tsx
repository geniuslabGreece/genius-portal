import { Facebook, Linkedin, Instagram, Youtube, Mail, Phone } from "lucide-react";
import logo from "@/assets/geniusnet-logo.png";

const socials = [
  { icon: Facebook, href: "https://www.facebook.com/geniusnet.gr", label: "Facebook" },
  { icon: Linkedin, href: "https://www.linkedin.com/company/geniusnet", label: "LinkedIn" },
  { icon: Instagram, href: "https://www.instagram.com/geniusnet.gr", label: "Instagram" },
  { icon: Youtube, href: "https://www.youtube.com/@geniusnet", label: "YouTube" },
];

const linkGroups = [
  {
    title: "Υπηρεσίες",
    links: [
      { href: "#services", label: "IT Services" },
      { href: "#services", label: "Cybersecurity" },
      { href: "#services", label: "Infrastructure" },
      { href: "#services", label: "Entersoft ONE" },
    ],
  },
  {
    title: "Εταιρεία",
    links: [
      { href: "#cycle", label: "Διαδικασία" },
      { href: "#nis2", label: "NIS 2" },
      { href: "#partners", label: "Συνεργάτες" },
      { href: "#contact", label: "Επικοινωνία" },
    ],
  },
];

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-2">
            <a href="#home" className="flex items-center gap-3">
              <img
                src={logo}
                alt="GeniusNet logo"
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg object-contain"
              />
              <div className="flex flex-col leading-none">
                <span className="font-display text-lg font-bold text-foreground">GeniusNet</span>
                <span className="text-[10px] font-medium uppercase tracking-widest text-brand-red">
                  20 years
                </span>
              </div>
            </a>

            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              IT Services · Cybersecurity · Infrastructure · Entersoft ERP.
              Ολοκληρωμένες λύσεις για κάθε επιχείρηση, με 20+ χρόνια εμπειρίας.
            </p>

            <div className="mt-5 space-y-2 text-sm text-muted-foreground">
              <a
                href="mailto:info@geniusnet.gr"
                className="flex items-center gap-2 transition-smooth hover:text-foreground"
              >
                <Mail className="h-4 w-4 text-brand-red" />
                info@geniusnet.gr
              </a>
              <a
                href="tel:+302100000000"
                className="flex items-center gap-2 transition-smooth hover:text-foreground"
              >
                <Phone className="h-4 w-4 text-brand-red" />
                +30 210 0000000
              </a>
            </div>

            {/* Socials */}
            <div className="mt-6 flex items-center gap-3">
              {socials.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-smooth hover:-translate-y-0.5 hover:border-brand-red hover:text-brand-red hover:shadow-soft"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link groups */}
          {linkGroups.map((g) => (
            <div key={g.title}>
              <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-foreground">
                {g.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {g.links.map((l, i) => (
                  <li key={`${l.label}-${i}`}>
                    <a
                      href={l.href}
                      className="text-sm text-muted-foreground transition-smooth hover:text-foreground"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 md:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} GeniusNet. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Designed & built with care in Athens, Greece.
          </p>
        </div>
      </div>
    </footer>
  );
};
