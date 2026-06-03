import { ArrowUpRight } from "lucide-react";
import itImg from "@/assets/pillars/it-services.jpg";
import erpImg from "@/assets/pillars/entersoft.jpg";
import cyberImg from "@/assets/pillars/cybersecurity.jpg";
import infraImg from "@/assets/pillars/infrastructure.jpg";

const pillars = [
  { title: "IT Services", img: itImg, color: "primary", href: "#services" },
  { title: "Entersoftone", img: erpImg, color: "red", badge: "Premium Partner", href: "#services" },
  { title: "Cybersecurity", img: cyberImg, color: "primary", href: "#services" },
  { title: "Infrastructure", img: infraImg, color: "primary", href: "#services" },
];

export const PillarsCollage = () => {
  return (
    <section
      aria-label="Πυλώνες υπηρεσιών"
      className="relative bg-background"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {pillars.map((p) => {
          const isRed = p.color === "red";
          return (
            <a
              key={p.title}
              href={p.href}
              className="group relative block aspect-[4/5] overflow-hidden lg:aspect-[3/4]"
            >
              <img
                src={p.img}
                alt={`${p.title} — GeniusNet`}
                loading="lazy"
                width={1024}
                height={1024}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              {/* Dark overlay for legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10 transition-smooth group-hover:from-black/95" />
              {/* Color tint per pillar */}
              <div
                className={`absolute inset-0 mix-blend-multiply opacity-0 transition-smooth group-hover:opacity-60 ${
                  isRed ? "gradient-red" : "gradient-primary"
                }`}
              />

              <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
                {p.badge && (
                  <span className="mb-3 inline-flex w-fit rounded-full bg-brand-red px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                    {p.badge}
                  </span>
                )}
                <h3
                  className={`font-display text-2xl font-bold uppercase tracking-tight text-primary-foreground md:text-3xl lg:text-4xl ${
                    isRed ? "text-brand-red group-hover:text-primary-foreground" : ""
                  } transition-smooth`}
                >
                  {p.title}
                </h3>
                <div className="mt-3 flex items-center gap-2 text-sm font-medium text-primary-foreground/0 transition-smooth group-hover:text-primary-foreground">
                  <span>Μάθε περισσότερα</span>
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
};
