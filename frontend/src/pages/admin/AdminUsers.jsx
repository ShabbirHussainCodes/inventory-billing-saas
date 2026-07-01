import { useState, useEffect, useRef } from "react"
import { superAdminAPI } from "../../services/api"

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function getInitials(first, last, email) {
  if (first || last) return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase()
  return (email?.[0] || '?').toUpperCase()
}

function getFullName(first, last) {
  const name = `${first || ''} ${last || ''}`.trim()
  return name || '—'
}

// ─── Role badge ──────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const cfg = {
    business_owner: { label: 'Owner', cls: 'bg-blue-50 text-blue-600' },
    staff:          { label: 'Staff', cls: 'bg-gray-100 text-gray-600' },
  }[role] || { label: role, cls: 'bg-gray-100 text-gray-500' }

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Confirm modal (deactivate) ──────────────────────────────────────────────

function ConfirmModal({ confirm, onConfirm, onCancel, loading }) {
  if (!confirm) return null
  const isDeactivate = confirm.action === 'deactivate'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">
          {isDeactivate ? 'Deactivate user?' : 'Activate user?'}
        </h3>
        <p className="mt-1.5 text-sm text-gray-500">
          {isDeactivate
            ? `"${confirm.user.email}" ka access band ho jaayega. Baad mein activate kar sakte ho.`
            : `"${confirm.user.email}" wapas active ho jaayega.`}
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
              isDeactivate ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {loading ? 'Working…' : isDeactivate ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Reset password modal ────────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose, onSubmit, loading }) {
  const [password, setPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [err, setErr] = useState("")

  const handleSubmit = () => {
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.")
      return
    }
    setErr("")
    onSubmit(password)
  }

  if (!user) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">Reset password</h3>
        <p className="mt-1 text-sm text-gray-500">
          Set a new password for <span className="font-medium text-gray-700">{user.email}</span>
        </p>

        <div className="mt-4 relative">
          <input
            type={showPwd ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErr("") }}
            placeholder="New password (min 8 characters)"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <button
            type="button"
            onClick={() => setShowPwd((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={showPwd ? 'Hide password' : 'Show password'}
          >
            {showPwd ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M1 1l22 22" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {err && <p className="mt-1.5 text-xs text-red-500">{err}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !password}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Resetting…' : 'Reset password'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Action menu (fixed position — table clipping se bahar) ──────────────────

function ActionMenu({ user, onDeactivate, onActivate, onResetPassword }) {
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
          strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <circle cx="12" cy="5" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="19" r="1" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {/* Reset password — always visible */}
          <button
            onClick={() => { onResetPassword(user); setOpen(false) }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            Reset password
          </button>

          <div className="my-1 border-t border-gray-100" />

          {/* Activate / Deactivate */}
          {user.is_active ? (
            <button
              onClick={() => { onDeactivate(user); setOpen(false) }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition"
            >
              Deactivate user
            </button>
          ) : (
            <button
              onClick={() => { onActivate(user); setOpen(false) }}
              className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50 transition"
            >
              Activate user
            </button>
          )}
        </div>
      )}
    </>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3 animate-pulse">
        <div className="h-9 flex-1 rounded-lg bg-gray-100" />
        <div className="h-9 w-28 rounded-lg bg-gray-100" />
        <div className="h-9 w-28 rounded-lg bg-gray-100" />
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-gray-100 last:border-0 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 rounded bg-gray-200" />
              <div className="h-3 w-44 rounded bg-gray-100" />
            </div>
            <div className="h-5 w-12 rounded-full bg-gray-100" />
            <div className="h-3 w-24 rounded bg-gray-100" />
            <div className="h-3 w-16 rounded bg-gray-100" />
            <div className="h-7 w-7 rounded-lg bg-gray-100" />
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

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [confirm, setConfirm] = useState(null)       // { action, user }
  const [resetModal, setResetModal] = useState(null) // { user }
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState("")

  // ── Fetch ──
  const fetchUsers = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await superAdminAPI.getUsers()
      // Pagination response — results array lo
      setUsers(res.data.results || res.data)
    } catch (err) {
      setError(err?.response?.data?.error || "Could not load users.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  // ── Client-side filter ──
  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    const name = getFullName(u.first_name, u.last_name).toLowerCase()
    const matchSearch = !q ||
      name.includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.tenant_name.toLowerCase().includes(q)
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' ? u.is_active : !u.is_active)
    return matchSearch && matchRole && matchStatus
  })

  // ── Toast helper ──
  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  // ── Toggle active/inactive ──
  const performToggle = async (user) => {
    setActionLoading(true)
    try {
      await superAdminAPI.toggleUser(user.id)
      showToast(
        user.is_active
          ? `${user.email} deactivated ✓`
          : `${user.email} activated ✓`
      )
      fetchUsers()
    } catch {
      showToast("Action failed. Please try again.")
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  // ── Reset password ──
  const performReset = async (password) => {
    setActionLoading(true)
    try {
      await superAdminAPI.resetPassword(resetModal.user.id, { new_password: password })
      showToast(`Password reset for ${resetModal.user.email} ✓`)
      setResetModal(null)
    } catch {
      showToast("Reset failed. Please try again.")
    } finally {
      setActionLoading(false)
    }
  }

  // ── Render ──
  if (loading) return <TableSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] rounded-2xl border border-red-100 bg-red-50 text-center p-8">
        <p className="text-sm font-medium text-red-600 mb-1">Failed to load users</p>
        <p className="text-xs text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchUsers}
          className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50"
        >
          Try again
        </button>
      </div>
    )
  }

  const isFiltered = search || roleFilter !== 'all' || statusFilter !== 'all'

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
            placeholder="Search by name, email, or business…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="all">All roles</option>
          <option value="business_owner">Owner</option>
          <option value="staff">Staff</option>
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} of {users.length}
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-2xl border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400">
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Business</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Joined</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-sm text-gray-400">
                  {isFiltered ? 'No users match your filters.' : 'No users registered yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/60 transition">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                        {getInitials(u.first_name, u.last_name, u.email)}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{getFullName(u.first_name, u.last_name)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">{u.tenant_name}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${u.is_active ? 'bg-green-500' : 'bg-red-400'}`} />
                      <span className={`text-xs font-medium ${u.is_active ? 'text-green-700' : 'text-red-600'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-500">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3.5 text-right">
                    <ActionMenu user={u}
                      onDeactivate={(user) => setConfirm({ action: 'deactivate', user })}
                      onActivate={(user) => setConfirm({ action: 'activate', user })}
                      onResetPassword={(user) => setResetModal({ user })}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <p className="text-sm text-gray-400">
              {isFiltered ? 'No users match your filters.' : 'No users registered yet.'}
            </p>
          </div>
        ) : (
          filtered.map((u) => (
            <div key={u.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                    {getInitials(u.first_name, u.last_name, u.email)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{getFullName(u.first_name, u.last_name)}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                </div>
                <RoleBadge role={u.role} />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                <div>
                  <p className="text-gray-400">Business</p>
                  <p className="text-gray-700 font-medium truncate">{u.tenant_name || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Status</p>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${u.is_active ? 'bg-green-500' : 'bg-red-400'}`} />
                    <span className={`font-medium ${u.is_active ? 'text-green-700' : 'text-red-600'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Joined {formatDate(u.created_at)}</p>
                <ActionMenu user={u}
                  onDeactivate={(user) => setConfirm({ action: 'deactivate', user })}
                  onActivate={(user) => setConfirm({ action: 'activate', user })}
                  onResetPassword={(user) => setResetModal({ user })}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Confirm modal (deactivate / activate) */}
      <ConfirmModal
        confirm={confirm}
        onConfirm={() => performToggle(confirm.user)}
        onCancel={() => setConfirm(null)}
        loading={actionLoading}
      />

      {/* Reset password modal */}
      <ResetPasswordModal
        user={resetModal?.user || null}
        onClose={() => setResetModal(null)}
        onSubmit={performReset}
        loading={actionLoading}
      />

      {/* Toast */}
      <Toast message={toast} />
    </>
  )
}