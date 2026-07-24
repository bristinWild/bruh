import Navbar from "@/components/nav/Navbar";
import Hero from "@/components/hero/Hero";
import MarketsSection from "@/components/markets/MarketsSection";
import HowItWorks from "@/components/how/HowItWorks";
import Footer from "@/components/footer/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <MarketsSection />
      <HowItWorks />
      <Footer />
    </main>
  );
}