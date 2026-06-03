import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/geniusnet-logo.png";

const links = [
  { href: "#home", label: "Αρχική" },
  { href: "#services", label: "Υπηρεσίες" },
  { href: "#solutions", label: "Λύσεις" },
  { href: "#cycle", label: "Διαδικασία" },
  { href: "#nis2", label: "NIS 2" },
  { href: "#partners", label: "Συνεργάτες" },
  { href: "#contact", label: "Επικοινωνία" },
];

const scrollToHash = (hash: string) => {
  const id = hash.replace("#", "");
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", hash);
  }
};

export const Header = () => {
  const [open, setOpen] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setOpen(false);
    scrollToHash(href);
  };

  return (
    <header className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <a
          href="#home"
          onClick={(e) => handleClick(e, "#home")}
          className="flex items-center gap-3"
        >
          <img
            src={logo}
            alt="GeniusNet logo"
            width={40}
            height={40}
            className="h-10 w-10 rounded-lg object-contain"
          />
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg font-bold text-foreground">GeniusNet</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-brand-red">20 years</span>
          </div>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={(e) => handleClick(e, l.href)}
              className="text-sm font-medium text-muted-foreground transition-smooth hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="outline" size="sm" asChild>
            <a href="/login">Customer Portal</a>
          </Button>
          <Button variant="default" size="sm" asChild>
            <a href="#contact" onClick={(e) => handleClick(e, "#contact")}>
              Get in touch
            </a>
          </Button>
        </div>

        <button
          className="md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="container flex flex-col gap-1 py-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => handleClick(e, l.href)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
            <Button variant="outline" className="mt-2" asChild>
              <a href="/login">Customer Portal</a>
            </Button>
            <Button className="mt-2" asChild>
              <a href="#contact" onClick={(e) => handleClick(e, "#contact")}>
                Get in touch
              </a>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
};
