import { useState, useEffect } from "react"
import { billingAPI, inventoryAPI } from "../../services/api"

const SYM = { INR: '₹', USD: '$', AED: 'AED ', GBP: '£', EUR: '€' }

function StatCard({ title, value, sub, variant = "default" }) {
  const colors = {
    default: "text-gray-900",
    success: "text-green-600",
    warning: "text-amber-600",
    info:    "text-blue-600",
  }
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500 mb-1.5">{title}</p>
      <p className={`text-2xl font-semibold ${colors[variant]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// NOTE ON SCOPE (being transparent about this in code, not just chat):
// "+ Create Invoice" is deliberately NOT included here, even in edit mode.
// Letting a founder create a real invoice on a client's behalf from
// inside support mode is a separate, bigger decision than "view their
// numbers" or "trigger their existing daily report" — it wasn't asked
// for, and it's safer to leave it out until explicitly requested.

export default function WorkspaceDashboard({ isEditMode }) {
  const [summary, setSummary] = useState(null)
  const [lowStock, setLowStock] = useState([])
  const [invoices, setInvoices] = useState([])
  const [cashflow, setCashflow] = useState(null)
  const [healthScore, setHealthScore] = useState(null)
  const [expenseSummary, setExpenseSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [toast, setToast] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const now = new Date()
      const [summaryRes, lowStockRes, invoicesRes, cashflowRes, healthRes, expenseRes] = await Promise.all([
        billingAPI.getSummary(),
        inventoryAPI.getLowStock(),
        billingAPI.getInvoices(),
        billingAPI.getCashflow(),
        billingAPI.getHealthScore(),
        billingAPI.getExpenseSummary(now.getFullYear(), now.getMonth() + 1),
      ])
      setSummary(summaryRes.data)
      setLowStock(lowStockRes.data.products || [])
      setInvoices(invoicesRes.data.slice(0, 5))
      setCashflow(cashflowRes.data)
      setHealthScore(healthRes.data)
      setExpenseSummary(expenseRes.data)
    } catch (err) {
      setError('Could not load this business\'s dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleCloseDay = async () => {
    setActionBusy(true)
    try {
      await billingAPI.closeDay()
      showToast('Daily report sent to their Telegram ✓')
    } catch (err) {
      showToast(err?.response?.data?.error || 'Could not send report.')
    } finally {
      setActionBusy(false)
    }
  }

  const handleGenerateBrief = async () => {
    setActionBusy(true)
    try {
      await billingAPI.generateBusinessBrief()
      showToast('Business Brief generated ✓')
    } catch (err) {
      showToast(err?.response?.data?.error || 'Could not generate brief.')
    } finally {
      setActionBusy(false)
    }
  }

  const currency = summary?.currency || 'INR'
  const sym = SYM[currency] || currency + ' '

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-gray-100" />)}
        </div>
        <div className="h-40 rounded-2xl bg-gray-100" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <button onClick={fetchData} className="text-sm text-red-600 underline">Try again</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Edit-mode-only actions — hidden entirely in View mode */}
      {isEditMode && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 flex items-center justify-between">
          <p className="text-xs text-red-700 font-medium">
            ✏️ Edit Mode — actions below affect this business's real account
          </p>
          <div className="flex gap-2">
            <button onClick={handleGenerateBrief} disabled={actionBusy}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition disabled:opacity-50">
              Generate Business Brief
            </button>
            <button onClick={handleCloseDay} disabled={actionBusy}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition disabled:opacity-50">
              {actionBusy ? 'Sending…' : 'Close Day (sends their Telegram)'}
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard title="Total Revenue" value={`${sym}${parseFloat(summary?.total_revenue || 0).toLocaleString()}`} variant="success" sub="All time" />
        <StatCard title="Total Profit" value={`${sym}${parseFloat(summary?.total_profit || 0).toLocaleString()}`} variant="info" sub="All time" />
        <StatCard title="Total Invoices" value={summary?.total_invoices || 0} sub="Created" />
        <StatCard title="Paid Invoices" value={summary?.paid_invoices || 0} variant="success" sub="Collected" />
        <StatCard title="This Month's Expenses" value={`${sym}${parseFloat(expenseSummary?.total || 0).toLocaleString()}`} variant="warning" />
      </div>

      {/* Business Health — read-only, no click-to-expand in this v1 */}
      {healthScore && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-900">Business Health</p>
            <p className="text-xl font-bold text-gray-900">{healthScore.total_score}<span className="text-sm text-gray-400">/100</span></p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {Object.entries(healthScore.breakdown).map(([key, b]) => (
              <div key={key} className="rounded-lg bg-gray-50 px-2.5 py-2">
                <p className="text-[10px] text-gray-400">{b.label}</p>
                <p className="text-sm font-semibold text-gray-800">{b.score}/{b.max}</p>
              </div>
            ))}
          </div>
          {healthScore.reasons.length > 0 && (
            <ul className="text-xs text-gray-600 space-y-0.5">
              {healthScore.reasons.map((r, i) => <li key={i}>• {r}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Cashflow */}
      {cashflow && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-400 mb-1">Outstanding</p>
            <p className="text-xl font-semibold text-blue-600">{sym}{parseFloat(cashflow.outstanding_amount).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">{cashflow.outstanding_count} invoice(s) awaiting payment</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-400 mb-1">Overdue</p>
            <p className={`text-xl font-semibold ${cashflow.overdue_count > 0 ? 'text-red-600' : 'text-gray-300'}`}>
              {sym}{parseFloat(cashflow.overdue_amount).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1">{cashflow.overdue_count > 0 ? `${cashflow.overdue_count} overdue` : 'Nothing overdue'}</p>
          </div>
        </div>
      )}

      {/* Low Stock + Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-900 mb-3">Low Stock Alerts</p>
          {lowStock.length === 0 ? (
            <p className="text-xs text-gray-400">All products stocked.</p>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0, 5).map(p => (
                <div key={p.id} className="flex justify-between text-xs">
                  <span className="text-gray-700">{p.name}</span>
                  <span className="text-amber-600 font-medium">{p.stock_quantity} left</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-900 mb-3">Recent Invoices</p>
          {invoices.length === 0 ? (
            <p className="text-xs text-gray-400">No invoices yet.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map(inv => (
                <div key={inv.id} className="flex justify-between text-xs">
                  <span className="font-mono text-gray-700">{inv.invoice_number}</span>
                  <span className="text-gray-500">{sym}{parseFloat(inv.total_amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}