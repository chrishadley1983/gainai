import { Navbar } from "@/components/landing/Navbar"
import { Hero } from "@/components/landing/Hero"
import { LogoBar } from "@/components/landing/LogoBar"
import { Features } from "@/components/landing/Features"
import { AIShowcase } from "@/components/landing/AIShowcase"
import { CTABanner } from "@/components/landing/CTABanner"
import { Footer } from "@/components/landing/Footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <LogoBar />
      <Features />
      <AIShowcase />
      <CTABanner />
      <Footer />
    </div>
  )
}
