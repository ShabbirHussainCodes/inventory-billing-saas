import { useState, useEffect, useCallback } from "react"
import { useNavigate, useLocation, NavLink } from "react-router-dom"
import { authAPI, teamAPI } from "../services/api"
import { clearAuth, getUser, getInitials } from "../utils/auth"

// ─── Client nav config ────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    to: "/products",
    label: "Products",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    to: "/invoices",
    label: "Invoices",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    to: "/estimates",
    label: "Estimates",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    to: "/profit-intelligence",
    label: "Profit Intelligence",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
      </svg>
    ),
  },
  {
    to: "/expenses",
    label: "Expenses",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    to: "/forecasts",
    label: "Demand Forecast",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <path d="M3 3v18h18" />
        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
      </svg>
    ),
  },
  {
    to: "/customers",
    label: "Customers",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: "/inventory",
    label: "Categories",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: "/purchase-orders",
    label: "Purchase Orders",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <path d="M16 3h5v5" />
        <path d="M8 3H3v5" />
        <path d="M3 16v5h5" />
        <path d="M21 16v5h-5" />
        <path d="M3 3l7 7" />
        <path d="M21 3l-7 7" />
      </svg>
    ),
  },
  {
    to: "/team",
    label: "Team",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        <circle cx="18.5" cy="8" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    to: "/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

// ─── View As Member — Phase B.5 ────────────────────────────────────────────────
// Mirrors the Founder's Support Mode banner (pages/admin/BusinessWorkspacePage.jsx)
// — same colors/copy convention (amber = view-only, red = edit simulation),
// same "confirm before switching to edit" safety pattern.

function EditSimConfirmModal({ targetName, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">Switch to Edit Simulation?</h3>
        <p className="mt-2 text-sm text-gray-500">
          Edit Simulation mein tum <strong className="text-gray-800">{targetName}</strong> ki
          tarah actual changes save kar sakte ho (unki permissions ke hisaab se). Dhyan se use karo.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel}
            className="rounded-lg px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600 transition disabled:opacity-50">
            {loading ? "Switching…" : "Enter Edit Simulation"}
          </button>
        </div>
      </div>
    </div>
  )
}

function ViewAsBanner({ session, onModeChanged, onExit }) {
  const [confirmEdit, setConfirmEdit] = useState(false)
  const [modeLoading, setModeLoading] = useState(false)
  const [exiting, setExiting] = useState(false)

  if (!session) return null
  const isEditMode = session.mode === "edit"

  const handleSwitchToEdit = async () => {
    setModeLoading(true)
    try {
      const res = await teamAPI.switchViewAsMode("edit")
      onModeChanged(res.data.mode)
    } catch {
      // Silent — session may have auto-ended server-side; next status check will catch it
    } finally {
      setModeLoading(false)
      setConfirmEdit(false)
    }
  }

  const handleSwitchToView = async () => {
    setModeLoading(true)
    try {
      const res = await teamAPI.switchViewAsMode("view")
      onModeChanged(res.data.mode)
    } catch {
      // Silent
    } finally {
      setModeLoading(false)
    }
  }

  const handleExit = async () => {
    setExiting(true)
    try {
      await teamAPI.endViewAs()
    } catch {
      // Endpoint 404s if the session already auto-ended server-side — fine either way
    } finally {
      onExit()
      setExiting(false)
    }
  }

  return (
    <>
      <div className={`sticky top-0 z-50 ${isEditMode ? "bg-red-500" : "bg-amber-500"}`}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-white animate-pulse" />
            <span className="text-sm font-semibold text-white">
              Viewing As: {session.target_name} ({session.target_role})
            </span>
          </div>

          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white">
            {isEditMode ? "✏️ Edit Simulation" : "👁 View Only"}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {isEditMode ? (
              <button onClick={handleSwitchToView} disabled={modeLoading}
                className="rounded-lg bg-white/20 px-3 py-1 text-xs font-medium text-white hover:bg-white/30 transition disabled:opacity-60">
                {modeLoading ? "…" : "Switch to View Only"}
              </button>
            ) : (
              <button onClick={() => setConfirmEdit(true)} disabled={modeLoading}
                className="rounded-lg bg-white/20 px-3 py-1 text-xs font-medium text-white hover:bg-white/30 transition disabled:opacity-60">
                {modeLoading ? "…" : "Switch to Edit Simulation"}
              </button>
            )}

            <button onClick={handleExit} disabled={exiting}
              className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition disabled:opacity-60">
              {exiting ? "Exiting…" : "Exit View As ×"}
            </button>
          </div>
        </div>
      </div>

      {confirmEdit && (
        <EditSimConfirmModal
          targetName={session.target_name}
          onConfirm={handleSwitchToEdit}
          onCancel={() => setConfirmEdit(false)}
          loading={modeLoading}
        />
      )}
    </>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = getUser()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [viewAsSession, setViewAsSession] = useState(null)

  // Fresh check on every page load (Layout remounts per-page in this app) —
  // matches the backend's own "never trust stale state" philosophy. A light
  // poll is added too so a mid-session auto-termination (role changed,
  // business suspended, etc. — see teams/permissions.py) is reflected
  // without needing a full page navigation.
  const refreshViewAsStatus = useCallback(async () => {
    try {
      const res = await teamAPI.getViewAsStatus()
      setViewAsSession(res.data.session)
    } catch {
      // Silent — banner just won't show if this fails
    }
  }, [])

  useEffect(() => {
    refreshViewAsStatus()
    const interval = setInterval(refreshViewAsStatus, 20000)
    return () => clearInterval(interval)
  }, [refreshViewAsStatus])

  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem("refresh_token")
      if (refresh) await authAPI.logout({ refresh })
    } catch {
      // API fail hone pe bhi logout karo
    } finally {
      clearAuth()
      navigate("/")
    }
  }

  // Current page title for topbar
  const currentNav = NAV_ITEMS.find((item) => location.pathname === item.to)
  const pageTitle = currentNav?.label || "BillingMars"

  return (
    <div className={`min-h-screen bg-gray-50 flex ${viewAsSession ? "pt-11" : ""}`}>

      {/* Phase B.5 — View As Member banner. Fixed overlay so it doesn't
          disturb the existing flex(sidebar+content) layout below — the
          conditional pt-11 above just makes room for it. */}
      {viewAsSession && (
        <div className="fixed inset-x-0 top-0 z-[70]">
          <ViewAsBanner
            session={viewAsSession}
            onModeChanged={(mode) => setViewAsSession((prev) => ({ ...prev, mode }))}
            onExit={() => setViewAsSession(null)}
          />
        </div>
      )}

      {/* Mobile overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed ${viewAsSession ? "top-11 bottom-0" : "inset-y-0"} left-0 z-40 flex w-60 flex-col border-r border-gray-200 bg-white transition-transform duration-200 md:translate-x-0 ${
        drawerOpen ? "translate-x-0" : "-translate-x-full"
      }`}>

        {/* Brand */}
        <div className="px-5 pb-4 pt-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-bold">
              B
            </span>
            <span className="text-[15px] font-semibold text-gray-900">BillingMars</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User identity */}
        <div className="flex items-center gap-3 border-t border-gray-200 px-4 py-3">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
            {getInitials(user)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-gray-900">
              {user.first_name
                ? `${user.first_name} ${user.last_name || ""}`.trim()
                : user.email}
            </p>
            <p className="truncate text-[11px] text-gray-400">
              {user.role === "business_owner" ? "Owner" : "Staff"}
            </p>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 md:pl-60">

        {/* Topbar */}
        <header className={`sticky ${viewAsSession ? "top-11" : "top-0"} z-20 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur md:px-6`}>

          {/* Mobile hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
              strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          <p className="text-[15px] font-semibold text-gray-900">{pageTitle}</p>

          <div className="ml-auto">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto max-w-7xl p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}