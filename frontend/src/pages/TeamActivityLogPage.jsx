import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { teamAPI } from "../services/api"

// ─── Time helper (same as admin/AuditLogPage.jsx) ──────────────────────────

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

// ─── Action config ──────────────────────────────────────────────────────────
// Covers ActivityLog.ACTION_CHOICES (teams/models.py). role_created/updated/
// deleted and view_as_* fall back to DEFAULT_CONFIG below — nothing emits
// them yet (Phase C custom roles / Phase B.5 View As Member aren't built),
// they're just here so the page doesn't look broken once those ship.

const ACTION_CONFIG = {
  member_invited: {
    bg: 'bg-blue-50', color: 'text-blue-600',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>,
  },
  member_joined: {
    bg: 'bg-green-50', color: 'text-green-600',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>,
  },
  member_suspended: {
    bg: 'bg-orange-50', color: 'text-orange-600',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  },
  member_reactivated: {
    bg: 'bg-green-50', color: 'text-green-600',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
  },
  member_removed: {
    bg: 'bg-red-50', color: 'text-red-500',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M18 8l4 4m0-4l-4 4"/></svg>,
  },
  role_changed: {
    bg: 'bg-amber-50', color: 'text-amber-600',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>,
  },
  product_created: {
    bg: 'bg-blue-50', color: 'text-blue-600',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>,
  },
  product_updated: {
    bg: 'bg-blue-50', color: 'text-blue-600',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  },
  product_deleted: {
    bg: 'bg-red-50', color: 'text-red-500',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  },
  customer_created: {
    bg: 'bg-purple-50', color: 'text-purple-600',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>,
  },
  customer_updated: {
    bg: 'bg-purple-50', color: 'text-purple-600',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  customer_deleted: {
    bg: 'bg-red-50', color: 'text-red-500',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M18 8l4 4m0-4l-4 4"/></svg>,
  },
  invoice_status_changed: {
    bg: 'bg-green-50', color: 'text-green-600',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
  },
}

const DEFAULT_CONFIG = {
  bg: 'bg-gray-100', color: 'text-gray-500',
  icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
}

// ─── Detail pill ────────────────────────────────────────────────────────────
// Handles more detail shapes than admin/AuditLogPage's version: some
// invoice_status_changed events log {action: 'deleted'/'edited'} (no
// from/to) rather than a status transition — showing those correctly
// instead of "undefined → undefined".

function DetailPill({ details }) {
  if (!details || Object.keys(details).length === 0) return null
  let text = ''
  if (details.from && details.to) text = `${details.from} → ${details.to}`
  else if (details.action) text = details.action
  else if (details.role) text = details.role
  else if (details.sku) text = `SKU: ${details.sku}`
  if (!text) return null
  return (
    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
      {text}
    </span>
  )
}

function ActivitySkeleton() {
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

// ─── Main page ──────────────────────────────────────────────────────────────

const DATE_FILTERS = [
  { key: null, label: 'All time' },
  { key: 1,    label: 'Today' },
  { key: 7,    label: 'Last 7 days' },
  { key: 30,   label: 'Last 30 days' },
]

export default function TeamActivityLogPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [error, setError] = useState('')
  const [days, setDays] = useState(null)
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ count: 0, total_pages: 1 })

  const fetchLogs = async (currentPage = 1, currentDays = days) => {
    setLoading(true)
    setError('')
    try {
      const res = await teamAPI.getActivityLog({ days: currentDays, page: currentPage, pageSize: 50 })
      setLogs(res.data.results || [])
      setMeta({ count: res.data.count, total_pages: res.data.total_pages })
      setAccessDenied(false)
    } catch (err) {
      if (err?.response?.status === 403) {
        setAccessDenied(true)
      } else {
        setError(err?.response?.data?.error || 'Could not load activity log.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
    fetchLogs(1, days)
  }, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePageChange = (newPage) => {
    setPage(newPage)
    fetchLogs(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!loading && accessDenied) {
    return (
      <Layout>
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">You don't have access to the Activity Log</p>
          <p className="text-xs text-gray-400">Ask your business Owner if you need to see this.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">Activity Log</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {meta.count} total entries · Page {page} of {meta.total_pages}
            </p>
          </div>
          <a href="/team" className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition">
            ← Back to Team
          </a>
          <button onClick={() => fetchLogs(page)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition">
            ↻ Refresh
          </button>
        </div>

        {/* Date filter */}
        <div className="flex gap-1.5 flex-wrap">
          {DATE_FILTERS.map((d) => (
            <button key={String(d.key)}
              onClick={() => setDays(d.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                days === d.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <ActivitySkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button onClick={() => fetchLogs(page)}
              className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50">
              Try again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <p className="text-sm font-medium text-gray-900 mb-1">No activity yet</p>
            <p className="text-xs text-gray-400">Try changing the date filter, or check back after your team starts working.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
              {logs.map((log) => {
                const cfg = ACTION_CONFIG[log.action] || DEFAULT_CONFIG
                return (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50/60 transition">
                    <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg} ${cfg.color}`}>
                      {cfg.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-1">
                        <p className="text-sm font-medium text-gray-900">{log.action_label}</p>
                        {log.target_name && (
                          <span className="text-sm text-gray-500">— {log.target_name}</span>
                        )}
                        <DetailPill details={log.details} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{log.actor_email}</p>
                    </div>
                    <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">
                      {timeAgo(log.created_at)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {meta.total_pages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button onClick={() => handlePageChange(page - 1)} disabled={page === 1}
                  className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                  ← Previous
                </button>
                <span className="text-xs text-gray-500">Page {page} of {meta.total_pages}</span>
                <button onClick={() => handlePageChange(page + 1)} disabled={page === meta.total_pages}
                  className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
