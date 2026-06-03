import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { PillarsCollage } from "@/components/PillarsCollage";
import { Services } from "@/components/Services";
import { ServiceCycle } from "@/components/ServiceCycle";
import { Solutions } from "@/components/Solutions";
import { CaseStudy } from "@/components/CaseStudy";
import { Nis2 } from "@/components/Nis2";
import { TechHighlights } from "@/components/TechHighlights";
import { Partners } from "@/components/Partners";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";
import { Helmet } from "react-helmet-async";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>GeniusNet — IT Services, Cybersecurity & ERP Solutions</title>
        <meta name="description" content="GeniusNet: ολοκληρωμένες λύσεις IT, Cybersecurity, Infrastructure και Entersoft ERP. 20+ χρόνια εμπειρίας στον ψηφιακό μετασχηματισμό επιχειρήσεων." />
        <link rel="canonical" href="https://geniusnetsoc.lovable.app/site" />
        <meta property="og:title" content="GeniusNet — IT Services, Cybersecurity & ERP Solutions" />
        <meta property="og:description" content="Ολοκληρωμένες λύσεις IT, Cybersecurity, Infrastructure και Entersoft ERP από τη GeniusNet." />
        <meta property="og:url" content="https://geniusnetsoc.lovable.app/site" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          "name": "GeniusNet IT Services",
          "provider": { "@type": "Organization", "name": "GeniusNet" },
          "areaServed": "GR",
          "serviceType": ["IT Services", "Cybersecurity", "Infrastructure", "Entersoft ERP"],
        })}</script>
      </Helmet>
      <Header />
      <main>
        <Hero />
        <PillarsCollage />
        <Services />
        <ServiceCycle />
        <Solutions />
        <CaseStudy />
        <Nis2 />
        <TechHighlights />
        <Partners />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
