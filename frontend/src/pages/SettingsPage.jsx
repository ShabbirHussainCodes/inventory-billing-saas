import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Layout from "../components/Layout"
import { tenantAPI, authAPI } from "../services/api"
import { clearAuth } from "../utils/auth"

// ─── Phase C (part 2) — Device Sessions ────────────────────────────────────
// Lightweight user-agent -> readable label, no external library. Good
// enough to distinguish "Chrome on Windows" from "Safari on iPhone" for
// a login-history list — not meant to be a precise device-fingerprint.
function describeUserAgent(ua) {
  if (!ua) return "Unknown device"
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" : "Browser"
  const os =
    /iPhone|iPad/.test(ua) ? "iOS" :
    /Android/.test(ua) ? "Android" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Windows/.test(ua) ? "Windows" :
    /Linux/.test(ua) ? "Linux" : ""
  return os ? `${browser} on ${os}` : browser
}

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(isoString).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function LogoutEverywhereConfirm({ onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-base font-semibold text-gray-900">Log out of all devices?</p>
        <p className="mt-1.5 text-sm text-gray-500">
          This signs you out everywhere — <strong className="text-gray-800">including this device.</strong> You'll
          need to log in again here too.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
            {loading ? "Signing out…" : "Log out everywhere"}
          </button>
        </div>
      </div>
    </div>
  )
}

const PLAN_CONFIG = {
  free:         { label: 'Free',       color: 'text-gray-600',  bg: 'bg-gray-100',   desc: '10 invoices/mo · 20 products · 25 customers · 1 team member (for testing)' },
  basic:        { label: 'Basic',      color: 'text-teal-600',  bg: 'bg-teal-50',    desc: 'Unlimited invoices · products · customers · up to 2 team members' },
  pro:          { label: 'Pro',        color: 'text-blue-600',  bg: 'bg-blue-50',    desc: 'Everything in Basic · unlimited team members · AI Insights · Team Activity Log' },
  enterprise:   { label: 'Enterprise', color: 'text-purple-600',bg: 'bg-purple-50',  desc: 'Everything in Pro · Custom Roles & Permission Editor · Priority support' },
  admin_grant:  { label: 'Granted',    color: 'text-green-600', bg: 'bg-green-50',   desc: 'Full access granted by BillingMars team' },
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: "", gst_number: "", business_phone: "",
    business_email: "", business_address: "", business_website: "",
    telegram_chat_id: "",
  })
  const [plan, setPlan] = useState('free')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState("")

  // Phase C (part 2) — Device Sessions / Logout Everywhere
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    tenantAPI.getSettings()
      .then(res => {
        setForm(prev => ({ ...prev, ...res.data }))
        setPlan(res.data.access_type || 'free')
      })
      .catch(console.error)
      .finally(() => setLoading(false))

    authAPI.getLoginSessions()
      .then(res => setSessions(res.data))
      .catch(console.error)
      .finally(() => setSessionsLoading(false))
  }, [])

  const handleLogoutEverywhere = async () => {
    setLoggingOut(true)
    try {
      await authAPI.logoutEverywhere()
    } catch {
      // Even if the call fails, clearing local tokens is the safe default —
      // we don't want a network error to leave the user thinking they're
      // still safely logged out elsewhere when the request never landed.
    } finally {
      clearAuth()
      navigate("/")
    }
  }

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 3000) }

  const handleSave = async () => {
    setSaving(true)
    try {
      await tenantAPI.updateSettings(form)
      showToast("Settings saved ✓")
    } catch {
      showToast("Failed to save settings.")
    } finally { setSaving(false) }
  }

  const planCfg = PLAN_CONFIG[plan] || PLAN_CONFIG.free

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-2xl bg-gray-100" />
          <div className="h-96 rounded-2xl bg-gray-100" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-900">Settings</h2>
        <p className="text-xs text-gray-400 mt-0.5">Business details appear on your invoices</p>
      </div>

      <div className="max-w-2xl space-y-4">

        {/* Current Plan Card */}
        <div className={`rounded-2xl border border-gray-200 p-5 ${planCfg.bg}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">Current Plan</p>
              <p className={`text-lg font-bold ${planCfg.color}`}>{planCfg.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{planCfg.desc}</p>
            </div>
            {plan === 'free' && (
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Want more?</p>
                <p className="text-xs font-medium text-blue-600">
                  Contact us to upgrade →
                </p>
              </div>
            )}
          </div>

          {/* Free plan usage hints */}
          {plan === 'free' && (
            <div className="mt-3 pt-3 border-t border-gray-200/60 grid grid-cols-3 gap-3">
              {[
                { label: 'Invoices/mo', limit: 10 },
                { label: 'Products',    limit: 20 },
                { label: 'Customers',   limit: 25 },
              ].map(item => (
                <div key={item.label} className="text-center">
                  <p className="text-xs font-medium text-gray-700">{item.limit}</p>
                  <p className="text-[11px] text-gray-400">{item.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Business Details */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <p className="text-sm font-medium text-gray-900">Business Details</p>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Business Name</label>
            <input name="name" value={form.name} onChange={handle}
              placeholder="e.g. Sharma Electronics"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">GST / Tax Number</label>
            <input name="gst_number" value={form.gst_number} onChange={handle}
              placeholder="27AAPFU0939F1ZV"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input name="business_phone" value={form.business_phone} onChange={handle}
                placeholder="+91 98765 43210"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input name="business_email" type="email" value={form.business_email} onChange={handle}
                placeholder="support@business.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Website</label>
            <input name="business_website" value={form.business_website} onChange={handle}
              placeholder="www.business.com"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Address</label>
            <textarea name="business_address" value={form.business_address} onChange={handle} rows={2}
              placeholder="Shop no. 5, Main Market, Mumbai"
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          <div className="pt-2">
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </div>

        {/* Telegram Daily Report */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
          <p className="text-sm font-medium text-gray-900">Telegram Daily Report</p>
          <p className="text-xs text-gray-400">
            Get your day's collection and profit sent to Telegram with one click.
          </p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Telegram Chat ID</label>
            <input name="telegram_chat_id" value={form.telegram_chat_id} onChange={handle}
              placeholder="e.g. 987654321"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="pt-1">
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
              {saving ? "Saving…" : "Save Telegram ID"}
            </button>
          </div>
        </div>

        {/* Security — Phase C (part 2) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Security</p>
            <p className="text-xs text-gray-400 mt-0.5">Your recent sign-ins on this account.</p>
          </div>

          {sessionsLoading ? (
            <div className="animate-pulse space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-gray-100" />)}
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-gray-400">No sign-in history yet.</p>
          ) : (
            <div className="rounded-lg border border-gray-100 divide-y divide-gray-50">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-sm text-gray-700">{describeUserAgent(s.user_agent)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.ip_address || "Unknown IP"}{s.tenant_name ? ` · ${s.tenant_name}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(s.created_at)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2">
              Signed in somewhere you don't recognize? Log out of every device at once.
            </p>
            <button onClick={() => setShowLogoutConfirm(true)}
              className="rounded-lg border border-red-100 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition">
              Log out of all devices
            </button>
          </div>
        </div>
      </div>

      {showLogoutConfirm && (
        <LogoutEverywhereConfirm
          onConfirm={handleLogoutEverywhere}
          onCancel={() => setShowLogoutConfirm(false)}
          loading={loggingOut}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </Layout>
  )
}