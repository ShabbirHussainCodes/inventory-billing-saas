// Activity Feed — derived from existing timestamps
// Props: data = [{ type, description, timestamp }]
// Types: 'business_registered' | 'user_joined' | 'invoice_created'

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(isoString).toLocaleDateString()
}

// Per-type icon + color config
const TYPE_CONFIG = {
  business_registered: {
    bg: 'bg-green-50',
    color: 'text-green-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
      </svg>
    ),
  },
  user_joined: {
    bg: 'bg-purple-50',
    color: 'text-purple-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6M22 11h-6" />
      </svg>
    ),
  },
  invoice_created: {
    bg: 'bg-blue-50',
    color: 'text-blue-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
  },
}

export default function ActivityFeed({ data = [] }) {
  if (!data.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className="text-sm font-medium text-gray-900 mb-3">Recent activity</p>
        <p className="text-sm text-gray-400">No activity yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-900 mb-1">Recent activity</p>
      <p className="text-xs text-gray-400 mb-4">
        Derived from business registrations, user signups, and invoices
      </p>

      <div className="divide-y divide-gray-100">
        {data.map((item, i) => {
          const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.invoice_created
          return (
            <div key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${config.bg} ${config.color}`}
              >
                {config.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800 truncate">{item.description}</p>
              </div>
              <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">
                {timeAgo(item.timestamp)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}