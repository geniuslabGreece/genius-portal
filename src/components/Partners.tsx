import softone from "@/assets/logos/softone.png";
import fortinet from "@/assets/logos/fortinet.png";
import watchguard from "@/assets/logos/watchguard.svg";
import microsoft from "@/assets/logos/microsoft.png";
import hp from "@/assets/logos/hp.png";
import veeam from "@/assets/logos/veeam.png";
import bitdefender from "@/assets/logos/bitdefender.png";
import entersoft from "@/assets/logos/entersoft.png";

const partners = [
  { name: "Entersoft", src: entersoft },
  { name: "SoftOne", src: softone },
  { name: "Microsoft", src: microsoft },
  { name: "HP", src: hp },
  { name: "Fortinet", src: fortinet },
  { name: "WatchGuard", src: watchguard },
  { name: "Bitdefender", src: bitdefender },
  { name: "Veeam", src: veeam },
];

export const Partners = () => {
  // Duplicate the list so the marquee loops seamlessly
  const loop = [...partners, ...partners];

  return (
    <section id="partners" className="border-y border-border bg-background py-16">
      <div className="container">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Trusted technology partners
        </p>

        <div
          className="group relative mt-10 overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          }}
        >
          <div className="flex w-max animate-marquee gap-12 group-hover:[animation-play-state:paused] sm:gap-16">
            {loop.map((p, i) => (
              <div
                key={`${p.name}-${i}`}
                className="flex h-24 w-40 shrink-0 items-center justify-center rounded-xl bg-card px-6 shadow-soft transition-smooth hover:shadow-elegant"
                aria-label={p.name}
              >
                <img
                  src={p.src}
                  alt={`${p.name} logo`}
                  loading="lazy"
                  width={512}
                  height={512}
                  className="max-h-16 w-auto object-contain opacity-80 transition-smooth hover:opacity-100"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
