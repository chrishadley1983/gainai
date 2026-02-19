import Link from "next/link"

export function CTABanner() {
  return (
    <section className="bg-white px-6 py-20 md:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
          Ready to grow your business?
        </h2>
        <p className="mt-3 text-gray-500">
          Join businesses across the UK already using GainAI to manage their Google presence.
        </p>
        <Link
          href="/auth/login"
          className="mt-8 inline-block rounded-lg bg-accent-green px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-green/90"
        >
          Get Started — it&apos;s free
        </Link>
      </div>
    </section>
  )
}
