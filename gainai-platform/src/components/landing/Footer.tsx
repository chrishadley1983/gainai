import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
        <Link href="/" className="text-lg font-bold tracking-tight text-gray-900">
          GainAI
        </Link>

        <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500">
          <a href="#features" className="hover:text-gray-700">Features</a>
          <a href="#pricing" className="hover:text-gray-700">Pricing</a>
          <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-700">Terms</Link>
        </div>

        <p className="text-xs text-gray-400">
          &copy; {new Date().getFullYear()} GainAI. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
