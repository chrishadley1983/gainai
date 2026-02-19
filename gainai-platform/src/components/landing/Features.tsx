import {
  Sparkles,
  MessageSquareText,
  BarChart3,
  ShieldCheck,
  Layers,
  Users,
} from "lucide-react"

const features = [
  {
    icon: Sparkles,
    title: "AI Post Generation",
    description: "Create engaging Google Business posts in seconds with AI that understands your brand voice.",
  },
  {
    icon: MessageSquareText,
    title: "Smart Review Responses",
    description: "AI-drafted replies to every review — professional, on-brand, and ready in moments.",
  },
  {
    icon: BarChart3,
    title: "Performance Analytics",
    description: "Track views, searches, and customer actions with clear, actionable dashboards.",
  },
  {
    icon: ShieldCheck,
    title: "Profile Audits",
    description: "Automated health checks that flag issues and boost your listing's visibility.",
  },
  {
    icon: Layers,
    title: "Bulk Operations",
    description: "Manage multiple locations at once — upload posts, update info, and sync changes in bulk.",
  },
  {
    icon: Users,
    title: "Client Portal",
    description: "Give each client their own branded dashboard to view performance and approve content.",
  },
]

export function Features() {
  return (
    <section id="features" className="bg-white px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Everything you need to grow locally
          </h2>
          <p className="mt-3 text-gray-500">
            One platform to manage your Google Business Profile from end to end.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-gray-100 bg-white p-6 transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600 transition-colors group-hover:bg-green-100">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-gray-900">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-gray-500">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
