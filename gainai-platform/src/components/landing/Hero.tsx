import Link from "next/link"
import { BarChart3, MessageSquare, Star } from "lucide-react"

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white px-6 pb-20 pt-16 md:pb-28 md:pt-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Copy */}
          <div className="max-w-xl">
            <div className="mb-4 inline-block rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              AI-powered GBP management
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
              AI-powered Google Business Profile management
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-gray-500">
              Automate posts, respond to reviews, and grow your local presence — all
              powered by AI. Built for UK small businesses.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/auth/login"
                className="rounded-lg bg-accent-green px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent-green/90"
              >
                Get Started
              </Link>
              <a
                href="#how-it-works"
                className="rounded-lg border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                See How It Works
              </a>
            </div>
          </div>

          {/* Product mockup */}
          <div className="relative hidden lg:block">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-lg">
              {/* Fake browser chrome */}
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-300" />
                <div className="h-3 w-3 rounded-full bg-yellow-300" />
                <div className="h-3 w-3 rounded-full bg-green-300" />
                <div className="ml-3 h-5 flex-1 rounded-md bg-gray-200" />
              </div>

              {/* Dashboard mockup content */}
              <div className="space-y-4">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Views", value: "12.4k", change: "+18%" },
                    { label: "Searches", value: "8.2k", change: "+12%" },
                    { label: "Actions", value: "1.8k", change: "+24%" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg bg-white p-3 shadow-sm">
                      <p className="text-xs text-gray-400">{stat.label}</p>
                      <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                      <p className="text-xs font-medium text-green-600">{stat.change}</p>
                    </div>
                  ))}
                </div>

                {/* Fake cards */}
                <div className="flex gap-3">
                  <div className="flex flex-1 items-center gap-3 rounded-lg bg-white p-3 shadow-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                      <MessageSquare className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900">AI Post Draft</p>
                      <p className="text-xs text-gray-400">Ready to publish</p>
                    </div>
                  </div>
                  <div className="flex flex-1 items-center gap-3 rounded-lg bg-white p-3 shadow-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-100">
                      <Star className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900">New Review</p>
                      <p className="text-xs text-gray-400">AI reply suggested</p>
                    </div>
                  </div>
                </div>

                {/* Fake chart */}
                <div className="rounded-lg bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-900">Performance</p>
                    <BarChart3 className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="flex items-end gap-1">
                    {[40, 55, 35, 65, 50, 75, 60, 80, 70, 90, 85, 95].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-green-400/70"
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
