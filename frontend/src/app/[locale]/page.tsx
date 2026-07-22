import LandingNav from "@/components/LandingNav";
import HeroCarousel from "@/components/HeroCarousel";
import FeaturesSection from "@/components/FeaturesSection";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <LandingNav />

      <main className="flex-1">
        <HeroCarousel />
        <div id="features">
          <FeaturesSection />
        </div>
        <div id="pricing">
          <PricingSection />
        </div>
      </main>

      <Footer />
    </div>
  );
}
