import { useState, useEffect } from "react"
import { superAdminAPI } from "../../services/api"

// ─── Time helper ──────────────────────────────────────────────────────────────

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (mins  <  1) return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  <  7) return `${days}d ago`
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

// ─── Action config — icon + color per action type ────────────────────────────

const ACTION_CONFIG = {
  workspace_entered: {
    bg: 'bg-green-50', color: 'text-green-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <path d="M10 17l5-5-5-5" /><path d="M15 12H3" />
      </svg>
    ),
  },
  workspace_exited: {
    bg: 'bg-gray-100', color: 'text-gray-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
      </svg>
    ),
  },
  mode_switched: {
    bg: 'bg-amber-50', color: 'text-amber-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    ),
  },
  product_created: {
    bg: 'bg-blue-50', color: 'text-blue-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  product_updated: {
    bg: 'bg-blue-50', color: 'text-blue-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  product_deleted: {
    bg: 'bg-red-50', color: 'text-red-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
      </svg>
    ),
  },
  customer_created: {
    bg: 'bg-purple-50', color: 'text-purple-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" />
      </svg>
    ),
  },
  customer_updated: {
    bg: 'bg-purple-50', color: 'text-purple-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  customer_deleted: {
    bg: 'bg-red-50', color: 'text-red-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" /><path d="M18 8l4 4m0-4l-4 4" />
      </svg>
    ),
  },
  invoice_status_changed: {
    bg: 'bg-green-50', color: 'text-green-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" /><line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
  },
}

const DEFAULT_CONFIG = {
  bg: 'bg-gray-100', color: 'text-gray-500',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
}

// ─── Detail pill — shows JSON details nicely ──────────────────────────────────

function DetailPill({ action, details }) {
  if (!details || Object.keys(details).length === 0) return null

  let text = ''
  if (action === 'mode_switched') {
    text = `${details.from} → ${details.to}`
  } else if (action === 'invoice_status_changed') {
    text = `${details.from} → ${details.to}`
  } else if (action === 'workspace_entered') {
    text = details.mode === 'edit' ? 'Edit mode' : 'View only'
  } else if (details.sku) {
    text = `SKU: ${details.sku}`
  }

  if (!text) return null
  return (
    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
      {text}
    </span>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function AuditSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-4 animate-pulse">
          <div className="h-7 w-7 rounded-lg bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-48 rounded bg-gray-100" />
            <div className="h-3 w-32 rounded bg-gray-100" />
          </div>
          <div className="h-3 w-16 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  )
}

// ─── Main AuditLogPage ────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'session' | 'product' | 'customer' | 'invoice'

  const fetchLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await superAdminAPI.getAuditLogs()
      setLogs(res.data)
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load audit logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [])

  // Filter logs
  const filtered = logs.filter((log) => {
    if (filter === 'all') return true
    if (filter === 'session')  return log.target_type === 'session'
    if (filter === 'product')  return log.target_type === 'product'
    if (filter === 'customer') return log.target_type === 'customer'
    if (filter === 'invoice')  return log.target_type === 'invoice'
    return true
  })

  const FILTERS = [
    { key: 'all',      label: 'All' },
    { key: 'session',  label: 'Sessions' },
    { key: 'product',  label: 'Products' },
    { key: 'customer', label: 'Customers' },
    { key: 'invoice',  label: 'Invoices' },
  ]

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">Audit Log</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            All founder support actions — last 200 entries
          </p>
        </div>
        <button onClick={fetchLogs}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition">
          ↻ Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === f.key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">
          {filtered.length} entries
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <AuditSkeleton />
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button onClick={fetchLogs}
            className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50">
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">No audit logs yet</p>
          <p className="text-xs text-gray-400">
            Enter a client workspace and perform actions — they will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {filtered.map((log) => {
            const cfg = ACTION_CONFIG[log.action] || DEFAULT_CONFIG
            return (
              <div key={log.id}
                className="flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50/60 transition">

                {/* Icon */}
                <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg} ${cfg.color}`}>
                  {cfg.icon}
                </span>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-1">
                    <p className="text-sm font-medium text-gray-900">
                      {log.action_label}
                    </p>
                    {log.target_name && (
                      <span className="text-sm text-gray-500">
                        — {log.target_name}
                      </span>
                    )}
                    <DetailPill action={log.action} details={log.details} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <span className="font-medium text-gray-600">{log.tenant_name}</span>
                    {' · '}
                    {log.actor_email}
                  </p>
                </div>

                {/* Time */}
                <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">
                  {timeAgo(log.created_at)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}