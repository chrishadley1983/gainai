import { Sparkles, MessageSquareText, FileText } from "lucide-react"

const showcases = [
  {
    icon: Sparkles,
    label: "AI Post Draft",
    title: "Writing a post for your business",
    lines: [
      { type: "prompt" as const, text: "Promote our weekend brunch menu..." },
      {
        type: "response" as const,
        text: "Start your weekend right! Join us for our new brunch menu featuring fresh, locally-sourced ingredients. Book your table today and enjoy 10% off your first visit.",
      },
    ],
  },
  {
    icon: MessageSquareText,
    label: "Review Response",
    title: "Replying to a customer review",
    lines: [
      { type: "prompt" as const, text: '"Great food but slow service" — 3 stars' },
      {
        type: "response" as const,
        text: "Thank you for your honest feedback! We're glad you enjoyed the food. We've taken steps to improve our service speed and hope to welcome you back soon for an even better experience.",
      },
    ],
  },
  {
    icon: FileText,
    label: "Performance Report",
    title: "Generating a monthly summary",
    lines: [
      { type: "prompt" as const, text: "Summarise January 2026 performance..." },
      {
        type: "response" as const,
        text: "Profile views up 23% month-over-month. Direct searches increased by 18%. Top performing post drove 142 website clicks. Recommendation: increase posting frequency to 3x/week.",
      },
    ],
  },
]

export function AIShowcase() {
  return (
    <section id="how-it-works" className="bg-gray-50 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            AI doing the heavy lifting
          </h2>
          <p className="mt-3 text-gray-500">
            See how GainAI handles the work that used to take hours.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {showcases.map((s) => (
            <div
              key={s.label}
              className="flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm"
            >
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600">
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                  <p className="text-xs text-gray-400">{s.title}</p>
                </div>
              </div>

              {/* Chat-style content */}
              <div className="flex flex-1 flex-col gap-3 p-5">
                {s.lines.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.type === "prompt"
                        ? "self-end rounded-xl rounded-br-sm bg-gray-100 px-4 py-2.5 text-sm text-gray-600"
                        : "self-start rounded-xl rounded-bl-sm bg-green-50 px-4 py-2.5 text-sm text-gray-700"
                    }
                  >
                    {line.text}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
