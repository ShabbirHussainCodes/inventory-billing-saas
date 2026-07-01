import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { superAdminAPI } from "../../services/api"

// ─── Helpers ────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS = {
  INR: '₹', USD: '$', AED: 'AED ', GBP: '£', EUR: '€',
}

function formatRevenue(amount, currency) {
  const sym = CURRENCY_SYMBOLS[currency] || `${currency} `
  if (amount >= 100000) return `${sym}${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `${sym}${(amount / 1000).toFixed(1)}k`
  return `${sym}${amount.toFixed(0)}`
}

function lastActiveLabel(isoString) {
  if (!isoString) return null
  const diff = Date.now() - new Date(isoString).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(h / 24)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(isoString).toLocaleDateString()
}

// ─── Small presentational pieces ────────────────────────────────────────────

function PlanBadge({ type }) {
  const cfg = {
    free:         { label: 'Free',       cls: 'bg-gray-100 text-gray-600' },
    pro:          { label: 'Pro',         cls: 'bg-blue-50 text-blue-600' },
    enterprise:   { label: 'Enterprise', cls: 'bg-purple-50 text-purple-600' },
    admin_grant:  { label: 'Granted',    cls: 'bg-green-50 text-green-600' },
  }[type] || { label: type, cls: 'bg-gray-100 text-gray-500' }

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// Dots icon (reused in ActionMenu)
function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="5" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  )
}

// ─── Action dropdown menu ────────────────────────────────────────────────────

function ActionMenu({ business, onAction }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef(null)
  const dropRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (
        dropRef.current && !dropRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // position: fixed — table/stacking context se bahar render hoga
  // getBoundingClientRect() se button ki exact screen position milti hai
  const toggle = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen((o) => !o)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 transition"
        aria-label="More actions"
      >
        <DotsIcon />
      </button>

      {open && (
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {business.is_active ? (
            <button
              onClick={() => { onAction('suspend', business); setOpen(false) }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition"
            >
              Suspend business
            </button>
          ) : (
            <button
              onClick={() => { onAction('activate', business); setOpen(false) }}
              className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50 transition"
            >
              Activate business
            </button>
          )}
          {business.access_type !== 'admin_grant' && (
            <button
              onClick={() => { onAction('grant', business); setOpen(false) }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              Grant free access
            </button>
          )}
          <button
            onClick={() => { onAction('upgrade', business); setOpen(false) }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            Change Plan
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={() => { onAction('permanent-delete', business); setOpen(false) }}
            className="w-full px-4 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50 transition"
          >
            Delete Permanently
          </button>
        </div>
      )}
    </>
  )
}

// ─── Confirmation modal ──────────────────────────────────────────────────────
// Destructive actions (suspend) ke liye — accidental click se bachao

function ConfirmModal({ confirm, onConfirm, onCancel, loading }) {
  if (!confirm) return null

  const isSuspend = confirm.action === 'suspend'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">
          {isSuspend ? 'Suspend business?' : 'Activate business?'}
        </h3>
        <p className="mt-1.5 text-sm text-gray-500">
          {isSuspend
            ? `"${confirm.business.name}" ke saare users ka access band ho jaayega. Baad mein activate kar sakte ho.`
            : `"${confirm.business.name}" wapas active ho jaayegi.`}
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium text-white transition disabled:opacity-50 ${
              isSuspend ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {loading ? 'Working…' : isSuspend ? 'Suspend' : 'Activate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Permanent Delete modal ──────────────────────────────────────────────────
// GitHub-style — exact business name type karna zaroori hai, warna delete
// disabled rehta hai. Yeh irreversible action hai, isliye extra friction OK hai.

function DeleteTenantModal({ business, onClose, onDeleted }) {
  const [typedName, setTypedName] = useState("")
  const [reason, setReason] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  if (!business) return null

  const isMatch = typedName.trim() === business.name
  const hasActivity = (business.invoice_count || 0) > 0

  const handleDelete = async () => {
    if (!isMatch) return
    setDeleting(true)
    setError("")
    try {
      const res = await superAdminAPI.permanentDeleteTenant(business.id, {
        confirm_name: typedName.trim(),
        reason: reason.trim(),
      })
      onDeleted(res.data.message)
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to delete. Please try again.")
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">

        {/* Header — clearly dangerous */}
        <div className="border-b border-red-100 bg-red-50 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-red-600" aria-hidden="true">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h3 className="text-base font-semibold text-red-700">Delete Permanently</h3>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            This will permanently delete <strong className="text-gray-900">"{business.name}"</strong> and
            ALL its data — products, invoices, customers, and users. This action{" "}
            <strong className="text-red-600">cannot be undone</strong>.
          </p>

          {hasActivity && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-700">
                ⚠ This business has <strong>{business.invoice_count} invoice{business.invoice_count !== 1 ? 's' : ''}</strong>{" "}
                — it looks active, not a test account. Double-check before deleting.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Type <strong className="text-gray-800">{business.name}</strong> to confirm
            </label>
            <input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={business.name}
              autoFocus
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Reason (optional, for your records)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. fake signup, test account"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} disabled={deleting}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={!isMatch || deleting}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {deleting ? "Deleting…" : "Delete Permanently"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton loading ────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3 animate-pulse">
        <div className="h-9 flex-1 rounded-lg bg-gray-100" />
        <div className="h-9 w-28 rounded-lg bg-gray-100" />
        <div className="h-9 w-28 rounded-lg bg-gray-100" />
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-gray-100 last:border-0 animate-pulse">
            <div className="h-2 w-2 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-36 rounded bg-gray-200" />
              <div className="h-3 w-48 rounded bg-gray-100" />
            </div>
            <div className="h-5 w-14 rounded-full bg-gray-100" />
            <div className="h-3 w-20 rounded bg-gray-100" />
            <div className="h-3 w-16 rounded bg-gray-100" />
            <div className="h-7 w-16 rounded-lg bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message }) {
  if (!message) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
      {message}
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ filtered }) {
  return (
    <tr>
      <td colSpan={5} className="py-16 text-center text-sm text-gray-400">
        {filtered ? 'No businesses match your filters.' : 'No businesses registered yet.'}
      </td>
    </tr>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AdminBusinesses() {
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [planFilter, setPlanFilter] = useState("all")
  const [confirm, setConfirm] = useState(null)   // { action, business }
  const [deleteTarget, setDeleteTarget] = useState(null)  // business being permanently deleted
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState("")

  // ── Fetch ──
  const fetchBusinesses = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await superAdminAPI.getTenants()
      // Pagination response — results array lo
      setBusinesses(res.data.results || res.data)
    } catch (err) {
      setError(err?.response?.data?.error || "Could not load businesses.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBusinesses() }, [])

  // ── Client-side filter ──
  const filtered = businesses.filter((b) => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      b.name.toLowerCase().includes(q) ||
      b.owner_email.toLowerCase().includes(q)
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' ? b.is_active : !b.is_active)
    const matchPlan = planFilter === 'all' || b.access_type === planFilter
    return matchSearch && matchStatus && matchPlan
  })

  // ── Quick action handler ──
  const handleAction = (action, business) => {
    // Suspend/Activate = destructive → confirmation required
    if (action === 'suspend' || action === 'activate') {
      setConfirm({ action, business })
    } else if (action === 'permanent-delete') {
      setDeleteTarget(business)
    } else {
      performAction(action, business)
    }
  }

  const performAction = async (action, business) => {
    setActionLoading(true)
    try {
      if (action === 'suspend' || action === 'activate') {
        await superAdminAPI.toggleTenant(business.id)
        setToast(`${business.name} ${action === 'suspend' ? 'suspended' : 'activated'} ✓`)
      } else if (action === 'grant') {
        await superAdminAPI.grantAccess(business.id)
        setToast(`Free access granted to ${business.name} ✓`)
      } else if (action === 'upgrade') {
        const plan = window.prompt(
          `Change plan for "${business.name}":\n\nEnter: free / pro / enterprise / admin_grant`,
          business.access_type || 'pro'
        )
        if (!plan) return
        await superAdminAPI.upgradeTenant(business.id, { plan })
        setToast(`${business.name} plan updated to ${plan} ✓`)
      }
      fetchBusinesses()
    } catch {
      setToast("Action failed. Please try again.")
    } finally {
      setActionLoading(false)
      setConfirm(null)
      setTimeout(() => setToast(""), 3000)
    }
  }

  // ── Render ──
  if (loading) return <TableSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] rounded-2xl border border-red-100 bg-red-50 text-center p-8">
        <p className="text-sm font-medium text-red-600 mb-1">Failed to load businesses</p>
        <p className="text-xs text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchBusinesses}
          className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50"
        >
          Try again
        </button>
      </div>
    )
  }

  const isFiltered = search || statusFilter !== 'all' || planFilter !== 'all'

  return (
    <>
      {/* Search + Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>

        {/* Plan filter */}
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="all">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
          <option value="admin_grant">Granted</option>
          <option value="paid">Paid</option>
          <option value="free_tier">Free</option>
          <option value="admin_grant">Granted</option>
        </select>

        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} of {businesses.length}
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400">
              <th className="px-4 py-3 text-left font-medium">Business</th>
              <th className="px-4 py-3 text-left font-medium">Plan</th>
              <th className="px-4 py-3 text-left font-medium">Activity</th>
              <th className="px-4 py-3 text-left font-medium">Revenue</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <EmptyState filtered={isFiltered} />
            ) : (
              filtered.map((b) => {
                const active = b.last_active ? lastActiveLabel(b.last_active) : null
                const isIdle = b.last_active
                  ? Date.now() - new Date(b.last_active).getTime() > 30 * 86400000
                  : true

                return (
                  <tr key={b.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-2.5">
                        <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                            !b.is_active ? 'bg-red-400' : isIdle ? 'bg-amber-400' : 'bg-green-500'
                          }`} />
                        <div>
                          <p className="font-medium text-gray-900">{b.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {b.owner_email} · {b.country} · {b.users_count} user{b.users_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><PlanBadge type={b.access_type} /></td>
                    <td className="px-4 py-3.5">
                      <p className="text-gray-800">{b.invoice_count} invoice{b.invoice_count !== 1 ? 's' : ''}</p>
                      {active ? (
                        <p className={`text-xs mt-0.5 ${isIdle ? 'text-amber-500' : 'text-green-600'}`}>
                          {isIdle ? `idle ${active}` : `active ${active}`}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5">no activity</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {b.invoice_count > 0 ? (
                        <p className="text-gray-800 font-medium">{formatRevenue(b.revenue, b.currency)}</p>
                      ) : (
                        <p className="text-gray-400">—</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => navigate(`/admin/businesses/${b.id}`)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
                          Enter
                        </button>
                        <ActionMenu business={b} onAction={handleAction} />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <p className="text-sm text-gray-500">
              {isFiltered ? "No businesses match your filters" : "No businesses yet"}
            </p>
          </div>
        ) : (
          filtered.map((b) => {
            const active = b.last_active ? lastActiveLabel(b.last_active) : null
            const isIdle = b.last_active
              ? Date.now() - new Date(b.last_active).getTime() > 30 * 86400000
              : true

            return (
              <div key={b.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                        !b.is_active ? 'bg-red-400' : isIdle ? 'bg-amber-400' : 'bg-green-500'
                      }`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{b.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {b.owner_email} · {b.country}
                      </p>
                    </div>
                  </div>
                  <PlanBadge type={b.access_type} />
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                  <div>
                    <p className="text-gray-400">Activity</p>
                    <p className="text-gray-700 font-medium">{b.invoice_count} invoices</p>
                    {active ? (
                      <p className={isIdle ? 'text-amber-500' : 'text-green-600'}>
                        {isIdle ? `idle ${active}` : `active ${active}`}
                      </p>
                    ) : (
                      <p className="text-gray-400">no activity</p>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-400">Revenue</p>
                    <p className="text-gray-700 font-medium">
                      {b.invoice_count > 0 ? formatRevenue(b.revenue, b.currency) : '—'}
                    </p>
                    <p className="text-gray-400">{b.users_count} user{b.users_count !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => navigate(`/admin/businesses/${b.id}`)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
                    Enter
                  </button>
                  <ActionMenu business={b} onAction={handleAction} />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Confirmation modal */}
      <ConfirmModal
        confirm={confirm}
        onConfirm={() => performAction(confirm.action, confirm.business)}
        onCancel={() => setConfirm(null)}
        loading={actionLoading}
      />

      {/* Permanent delete modal */}
      <DeleteTenantModal
        business={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(message) => {
          setDeleteTarget(null)
          setToast(message)
          fetchBusinesses()
          setTimeout(() => setToast(""), 4000)
        }}
      />

      {/* Toast */}
      <Toast message={toast} />
    </>
  )
}