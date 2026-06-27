// Needs Attention panel — 3 actionable buckets
// Props: data = { dormant, upsell, suspended }

const BUCKETS = [
  {
    key: 'dormant',
    label: 'Dormant',
    sub: '30d+ idle · churn risk',
    bg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    // Zzz icon inline
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <path d="M2 12a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V7H2Z" />
        <path d="M6 11h4l-4 4h4" />
        <path d="M14 11h4l-4 4h4" />
      </svg>
    ),
  },
  {
    key: 'upsell',
    label: 'Upsell candidates',
    sub: 'Free plan · 3+ invoices',
    bg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <path d="M3 3v18h18" />
        <path d="m7 14 3-3 3 3 5-5" />
      </svg>
    ),
  },
  {
    key: 'suspended',
    label: 'Suspended',
    sub: 'Currently inactive',
    bg: 'bg-red-50',
    iconColor: 'text-red-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M4.9 4.9 19.1 19.1" />
      </svg>
    ),
  },
]

export default function NeedsAttention({ data }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 h-full">
      <p className="text-sm font-medium text-gray-900 mb-4">Needs attention</p>
      <div className="grid grid-cols-3 gap-3">
        {BUCKETS.map((b) => (
          <div
            key={b.key}
            className={`${b.bg} rounded-xl p-4 flex flex-col gap-2`}
          >
            <span className={b.iconColor}>{b.icon}</span>
            <p className="text-2xl font-semibold text-gray-900">
              {data[b.key] ?? '—'}
            </p>
            <div>
              <p className="text-xs font-medium text-gray-700">{b.label}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{b.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}