export function LogoBar() {
  return (
    <section className="border-y border-gray-100 bg-gray-50/50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="mb-8 text-center text-sm font-medium text-gray-400">
          Trusted by businesses across the UK
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex h-8 w-24 items-center justify-center rounded bg-gray-200/60 text-xs font-medium text-gray-400"
            >
              Logo {i + 1}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
