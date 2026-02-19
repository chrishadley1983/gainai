"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/cn"

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-gray-900">
          GainAI
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-gray-600 hover:text-gray-900">
            Features
          </a>
          <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900">
            How It Works
          </a>
          <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900">
            Pricing
          </a>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/auth/login"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Login
          </Link>
          <Link
            href="/auth/login"
            className="rounded-lg bg-accent-green px-4 py-2 text-sm font-medium text-white hover:bg-accent-green/90"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "overflow-hidden border-t border-gray-100 bg-white transition-all md:hidden",
          mobileOpen ? "max-h-64" : "max-h-0 border-t-0"
        )}
      >
        <div className="flex flex-col gap-3 px-6 py-4">
          <a href="#features" className="text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
            Features
          </a>
          <a href="#how-it-works" className="text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
            How It Works
          </a>
          <a href="#pricing" className="text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
            Pricing
          </a>
          <hr className="border-gray-100" />
          <Link href="/auth/login" className="text-sm font-medium text-gray-700">
            Login
          </Link>
          <Link
            href="/auth/login"
            className="rounded-lg bg-accent-green px-4 py-2 text-center text-sm font-medium text-white"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  )
}
