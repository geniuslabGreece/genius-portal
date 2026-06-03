import { ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";

export const Hero = () => {
  return (
    <section id="home" className="relative isolate overflow-hidden pt-16">
      <img
        src={heroBg}
        alt=""
        width={1920}
        height={1080}
        className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60"
      />
      <div className="absolute inset-0 -z-10 gradient-hero opacity-90" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary-glow)/0.25),transparent_60%)]" />

      <div className="container relative py-24 md:py-36 lg:py-44">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-4 py-1.5 text-xs font-medium text-primary-foreground backdrop-blur animate-fade-in">
            <Shield className="h-3.5 w-3.5 text-brand-red" />
            <span>20+ years of IT excellence</span>
          </div>

          <h1 className="font-display text-4xl font-bold leading-[1.05] text-primary-foreground text-balance md:text-6xl lg:text-7xl animate-fade-up">
            Ολοκληρωμένες λύσεις{" "}
            <span className="bg-gradient-to-r from-primary-glow to-brand-red bg-clip-text text-transparent">
              IT & Cybersecurity
            </span>{" "}
            για κάθε επιχείρηση
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/75 md:text-xl animate-fade-up [animation-delay:120ms]">
            Από το design και την προμήθεια, έως την υποστήριξη — η GeniusNet
            υλοποιεί έργα IT, Infrastructure, Cybersecurity και Entersoft ERP
            με τεχνογνωσία 20 ετών.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-up [animation-delay:240ms]">
            <Button size="lg" variant="hero" asChild>
              <a href="#services">
                Δες τις υπηρεσίες
                <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outlineHero" asChild>
              <a href="#contact">Επικοινωνία</a>
            </Button>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-6 border-t border-primary-foreground/10 pt-10 text-primary-foreground/80 animate-fade-in [animation-delay:400ms]">
            {[
              { k: "20+", v: "Χρόνια εμπειρίας" },
              { k: "500+", v: "Ολοκληρωμένα έργα" },
              { k: "24/7", v: "Υποστήριξη" },
            ].map((s) => (
              <div key={s.v}>
                <div className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">{s.k}</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-primary-foreground/60 md:text-sm">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
