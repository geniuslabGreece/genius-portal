import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export const Contact = () => {
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Το μήνυμά σου στάλθηκε",
      description: "Θα επικοινωνήσουμε μαζί σου σύντομα.",
    });
    (e.target as HTMLFormElement).reset();
  };

  return (
    <section id="contact" className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 -z-10 gradient-dark" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_70%_30%,hsl(var(--brand-red)/0.18),transparent_55%)]" />

      <div className="container">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-red">Επικοινωνία</span>
            <h2 className="mt-3 font-display text-3xl font-bold text-primary-foreground md:text-5xl text-balance">
              Ας μιλήσουμε για το επόμενο IT project σου
            </h2>
            <p className="mt-4 max-w-md text-primary-foreground/70 md:text-lg">
              Στείλε μας τις λεπτομέρειες και η ομάδα μας θα σχεδιάσει 
              μια εξατομικευμένη πρόταση.
            </p>

            <div className="mt-10 space-y-5">
              {[
                { icon: Mail, label: "Email", value: "info@geniusnet.gr" },
                { icon: Phone, label: "Τηλέφωνο", value: "+30 210 0000000" },
                { icon: MapPin, label: "Διεύθυνση", value: "Αθήνα, Ελλάδα" },
              ].map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.label} className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/10 backdrop-blur">
                      <Icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-primary-foreground/50">{c.label}</div>
                      <div className="text-sm font-medium text-primary-foreground">{c.value}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-primary-foreground/10 bg-primary-foreground/5 p-6 backdrop-blur md:p-8"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-primary-foreground/70">Όνομα</label>
                <Input required className="bg-background/90" placeholder="Το όνομά σου" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-primary-foreground/70">Εταιρεία</label>
                <Input className="bg-background/90" placeholder="Επωνυμία" />
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-primary-foreground/70">Email</label>
              <Input type="email" required className="bg-background/90" placeholder="you@example.com" />
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-primary-foreground/70">Μήνυμα</label>
              <Textarea required rows={5} className="bg-background/90" placeholder="Πες μας για το έργο σου..." />
            </div>
            <Button type="submit" size="lg" variant="hero" className="mt-6 w-full">
              Αποστολή μηνύματος
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};
