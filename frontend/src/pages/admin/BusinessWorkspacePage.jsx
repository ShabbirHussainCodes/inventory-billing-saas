import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { superAdminAPI } from "../../services/api"

// ─── Workspace sidebar navigation ────────────────────────────────────────────
// Abhi sab "soon" hain — aage ke steps mein ek ek fill hoga

const WORKSPACE_NAV = [
  { label: 'Dashboard',  icon: '▦', soon: true },
  { label: 'Inventory',  icon: '⊟', soon: true },
  { label: 'Customers',  icon: '◎', soon: true },
  { label: 'Invoices',   icon: '⊞', soon: true },
  { label: 'Reports',    icon: '⊿', soon: true },
]

// ─── Edit mode confirmation modal ────────────────────────────────────────────

function EditConfirmModal({ tenantName, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">
          Switch to Edit Mode?
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          Edit mode mein tum <strong className="text-gray-800">{tenantName}</strong> ke
          data mein changes kar sakte ho. Galti se changes hone ka risk hai — dhyan se use karo.
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
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600 transition disabled:opacity-50"
          >
            {loading ? 'Switching…' : 'Enter Edit Mode'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main workspace page ──────────────────────────────────────────────────────

export default function BusinessWorkspacePage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [confirmEdit, setConfirmEdit] = useState(false)
  const [modeLoading, setModeLoading] = useState(false)
  const [exiting, setExiting] = useState(false)

  // ── On mount: check existing session or enter new one ──
  useEffect(() => {
    const initWorkspace = async () => {
      setLoading(true)
      setError("")
      try {
        // Pehle check karo ki koi active session hai iss tenant ke liye
        const sessionRes = await superAdminAPI.getActiveSession()
        const existing = sessionRes.data.session

        if (existing && existing.tenant_id === id) {
          // Same tenant ka session already active hai — reuse karo
          setSession(existing)
        } else {
          // Naya session banao (view mode se shuru — safe default)
          const res = await superAdminAPI.enterWorkspace(id, 'view')
          setSession(res.data)
        }
      } catch (err) {
        setError(
          err?.response?.data?.error || "Could not enter workspace. Please try again."
        )
      } finally {
        setLoading(false)
      }
    }

    initWorkspace()
  }, [id])

  // ── Exit workspace ──
  const handleExit = async () => {
    setExiting(true)
    try {
      await superAdminAPI.exitWorkspace()
    } catch {
      // Session cleanup fail hone pe bhi navigate karo
    } finally {
      navigate('/admin/businesses')
    }
  }

  // ── Switch to Edit mode (after confirmation) ──
  const handleSwitchToEdit = async () => {
    setModeLoading(true)
    try {
      const res = await superAdminAPI.switchMode('edit')
      setSession((prev) => ({ ...prev, mode: res.data.mode }))
    } catch {
      // Mode switch fail — view mode pe hi raho
    } finally {
      setModeLoading(false)
      setConfirmEdit(false)
    }
  }

  // ── Switch back to View mode ──
  const handleSwitchToView = async () => {
    setModeLoading(true)
    try {
      const res = await superAdminAPI.switchMode('view')
      setSession((prev) => ({ ...prev, mode: res.data.mode }))
    } catch {
      // Silent fail — UI state stays
    } finally {
      setModeLoading(false)
    }
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="text-sm text-gray-500">Entering workspace…</p>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 text-center p-8">
        <p className="text-sm font-medium text-red-600 mb-1">Could not enter workspace</p>
        <p className="text-xs text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => navigate('/admin/businesses')}
          className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          ← Back to businesses
        </button>
      </div>
    )
  }

  const isEditMode = session?.mode === 'edit'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Founder Support Mode Banner ─────────────────────────────────────── */}
      {/* Amber ranga — clearly different from normal app — founder hamesha
          jaane ki woh ek alag mode mein hai */}
      <div className={`sticky top-0 z-50 ${isEditMode ? 'bg-red-500' : 'bg-amber-500'}`}>
        <div className="mx-auto flex max-w-full items-center gap-3 px-4 py-2.5">

          {/* Pulsing dot + label */}
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-white animate-pulse" />
            <span className="text-sm font-semibold text-white">
              Founder Support Mode
            </span>
          </div>

          {/* Divider */}
          <span className="text-white/40">|</span>

          {/* Business name */}
          <span className="text-sm font-medium text-white/90 truncate max-w-[200px]">
            {session?.tenant_name}
          </span>

          {/* Mode badge */}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isEditMode
              ? 'bg-white/20 text-white'
              : 'bg-white/20 text-white'
          }`}>
            {isEditMode ? '✏️ Edit Mode' : '👁 View Only'}
          </span>

          {/* Spacer */}
          <div className="ml-auto flex items-center gap-2">

            {/* Mode toggle button */}
            {isEditMode ? (
              <button
                onClick={handleSwitchToView}
                disabled={modeLoading}
                className="rounded-lg bg-white/20 px-3 py-1 text-xs font-medium text-white hover:bg-white/30 transition disabled:opacity-60"
              >
                {modeLoading ? '…' : 'Switch to View Only'}
              </button>
            ) : (
              <button
                onClick={() => setConfirmEdit(true)}
                disabled={modeLoading}
                className="rounded-lg bg-white/20 px-3 py-1 text-xs font-medium text-white hover:bg-white/30 transition disabled:opacity-60"
              >
                {modeLoading ? '…' : 'Switch to Edit Mode'}
              </button>
            )}

            {/* Exit button */}
            <button
              onClick={handleExit}
              disabled={exiting}
              className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition disabled:opacity-60"
            >
              {exiting ? 'Exiting…' : 'Exit Workspace ×'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Main layout ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1">

        {/* Workspace sidebar */}
        <aside className="w-56 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col min-h-full px-3 py-5">

          {/* Business identity */}
          <div className="px-2 mb-5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              Workspace
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900 truncate">
              {session?.tenant_name}
            </p>
            <p className={`mt-1 text-[10px] font-medium ${
              isEditMode ? 'text-red-500' : 'text-amber-600'
            }`}>
              {isEditMode ? 'Edit Mode active' : 'View Only'}
            </p>
          </div>

          {/* Nav items — sab soon abhi */}
          <nav className="space-y-0.5">
            {WORKSPACE_NAV.map((item) => (
              <div
                key={item.label}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400"
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
                <span className="ml-auto rounded-full border border-gray-200 px-1.5 py-0.5 text-[9px] text-gray-400">
                  soon
                </span>
              </div>
            ))}
          </nav>

          {/* Back to Command Center */}
          <button
            onClick={handleExit}
            disabled={exiting}
            className="mt-auto flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-800 transition"
          >
            ← Command Center
          </button>
        </aside>

        {/* ── Content area ── */}
        <main className="flex-1 p-6">

          {/* Mode indicator bar */}
          <div className={`mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
            isEditMode
              ? 'bg-red-50 text-red-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              isEditMode ? 'bg-red-500' : 'bg-amber-500'
            }`} />
            {isEditMode
              ? 'Edit Mode — Changes will be saved to client data'
              : 'View Only — No changes will be saved'}
          </div>

          {/* Workspace placeholder — next steps mein content aayega */}
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                strokeLinecap="round" strokeLinejoin="round"
                className="h-7 w-7 text-amber-500" aria-hidden="true">
                <path d="M3 21h18" />
                <path d="M5 21V7l8-4v18" />
                <path d="M19 21V11l-6-4" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900">
              Inside {session?.tenant_name}'s Workspace
            </h2>
            <p className="mt-2 mx-auto max-w-xs text-sm text-gray-500">
              Session active hai. Inventory, Customers, Invoices, aur Reports
              next steps mein build honge.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-2 text-xs text-gray-500 font-mono">
              Session ID: {session?.session_id?.slice(0, 8)}…
            </div>
          </div>
        </main>
      </div>

      {/* Edit confirmation modal */}
      {confirmEdit && (
        <EditConfirmModal
          tenantName={session?.tenant_name}
          onConfirm={handleSwitchToEdit}
          onCancel={() => setConfirmEdit(false)}
          loading={modeLoading}
        />
      )}
    </div>
  )
}