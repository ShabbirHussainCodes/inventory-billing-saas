// Reusable KPI stat card — har tile ke liye ek component
// Props:
//   title    -> card ka label (e.g. "Total businesses")
//   value    -> bada number ya text (e.g. 142, "+23", "31 paid · 95 free")
//   sub      -> chhoti line neeche (optional, e.g. "this month")
//   variant  -> 'default' | 'success' | 'danger' — value ka color
//   locked   -> true => MRR/Revenue jaise future tiles, grayed out with lock icon
//   compact  -> true => value chhote font mein (plan mix jaisi long strings ke liye)

export default function StatCard({
  title,
  value,
  sub,
  variant = 'default',
  locked = false,
  compact = false,
}) {
  const valueColor = {
    default: 'text-gray-900',
    success: 'text-green-600',
    danger: 'text-red-500',
  }[variant] || 'text-gray-900'

  // Locked tile — future feature placeholder
  if (locked) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 opacity-55">
        <div className="flex items-center gap-1.5 mb-2">
          {/* Inline lock SVG — icons.jsx mein add karne ki zaroorat nahi */}
          <svg
            className="h-3.5 w-3.5 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="text-sm text-gray-400">{title}</p>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          {sub || 'Available with subscriptions module'}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500 mb-1.5">{title}</p>
      <p
        className={`font-semibold leading-tight ${valueColor} ${
          compact ? 'text-sm' : 'text-2xl'
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs text-gray-400 mt-1">{sub}</p>
      )}
    </div>
  )
}