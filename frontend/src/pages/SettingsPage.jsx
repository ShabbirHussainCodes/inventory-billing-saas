import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { tenantAPI } from "../services/api"

const PLAN_CONFIG = {
  free:         { label: 'Free',       color: 'text-gray-600',  bg: 'bg-gray-100',   desc: '10 invoices/mo · 20 products · 25 customers' },
  pro:          { label: 'Pro',        color: 'text-blue-600',  bg: 'bg-blue-50',    desc: 'Unlimited invoices · products · customers' },
  enterprise:   { label: 'Enterprise', color: 'text-purple-600',bg: 'bg-purple-50',  desc: 'Unlimited everything · Multiple users' },
  admin_grant:  { label: 'Granted',    color: 'text-green-600', bg: 'bg-green-50',   desc: 'Full access granted by BillingMars team' },
}

export default function SettingsPage() {
  const [form, setForm] = useState({
    name: "", gst_number: "", business_phone: "",
    business_email: "", business_address: "", business_website: "",
  })
  const [plan, setPlan] = useState('free')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState("")

  useEffect(() => {
    tenantAPI.getSettings()
      .then(res => {
        setForm(prev => ({ ...prev, ...res.data }))
        setPlan(res.data.access_type || 'free')
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </Layout>
  )
}