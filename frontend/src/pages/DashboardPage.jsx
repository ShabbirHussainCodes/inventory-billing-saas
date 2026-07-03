import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Layout from "../components/Layout"
import { billingAPI, inventoryAPI } from "../services/api"
import { getUser } from "../utils/auth"

// ─── Reuse StatCard from admin ────────────────────────────────────────────────

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

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = {
    paid:      "bg-green-50 text-green-700",
    sent:      "bg-blue-50 text-blue-600",
    draft:     "bg-gray-100 text-gray-600",
    cancelled: "bg-red-50 text-red-600",
  }[status] || "bg-gray-100 text-gray-500"

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cfg}`}>
      {status}
    </span>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-48 rounded bg-gray-100" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-56 rounded-2xl bg-gray-100" />
        <div className="h-56 rounded-2xl bg-gray-100" />
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = getUser()
  const [summary, setSummary] = useState(null)
  const [lowStock, setLowStock] = useState([])
  const [invoices, setInvoices] = useState([])
  const [cashflow, setCashflow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [closingDay, setClosingDay] = useState(false)
  const [toast, setToast] = useState("")

  const fetchData = async () => {
    setLoading(true)
    setError("")
    try {
      const [summaryRes, lowStockRes, invoicesRes, cashflowRes] = await Promise.all([
        billingAPI.getSummary(),
        inventoryAPI.getLowStock(),
        billingAPI.getInvoices(),
        billingAPI.getCashflow(),
      ])
      setSummary(summaryRes.data)
      setLowStock(lowStockRes.data.products || [])
      setInvoices(invoicesRes.data.slice(0, 5))
      setCashflow(cashflowRes.data)
    } catch (err) {
      console.error("Dashboard fetch error:", err)
      setError("Could not load dashboard. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleCloseDay = async () => {
    setClosingDay(true)
    try {
      await billingAPI.closeDay()
      setToast("Daily report sent to Telegram ✓")
    } catch (err) {
      setToast(err?.response?.data?.error || "Failed to send report. Check Telegram settings.")
    } finally {
      setClosingDay(false)
      setTimeout(() => setToast(""), 4000)
    }
  }

  if (loading) {
    return <Layout><DashboardSkeleton /></Layout>
  }

  if (error) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[40vh] rounded-2xl border border-red-100 bg-red-50 text-center p-8">
          <p className="text-sm font-medium text-red-600 mb-1">Failed to load dashboard</p>
          <p className="text-xs text-red-400 mb-4">{error}</p>
          <button onClick={fetchData}
            className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 transition">
            Try again
          </button>
        </div>
      </Layout>
    )
  }

  const currency = summary?.currency || "INR"

  return (
    <Layout>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Good morning, {user.first_name || "there"}!
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Here's your business overview for today.
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCloseDay}
            disabled={closingDay}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
              strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M21.5 12H16l-2 3h-4l-2-3H2.5"/>
              <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
            {closingDay ? "Sending…" : "Close Day"}
          </button>
          <button
            onClick={() => navigate("/invoices")}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            + Create Invoice
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          title="Total Revenue"
          value={`${currency} ${parseFloat(summary?.total_revenue || 0).toLocaleString()}`}
          variant="success"
          sub="All time"
        />
        <StatCard
          title="Total Profit"
          value={`${currency} ${parseFloat(summary?.total_profit || 0).toLocaleString()}`}
          variant="info"
          sub="All time"
        />
        <StatCard
          title="Total Invoices"
          value={summary?.total_invoices || 0}
          sub="Created"
        />
        <StatCard
          title="Paid Invoices"
          value={summary?.paid_invoices || 0}
          variant="success"
          sub="Collected"
        />
      </div>

      {/* Cashflow — Outstanding + Overdue */}
      {cashflow && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-400 mb-1">Outstanding (Sent, Unpaid)</p>
            <p className="text-2xl font-semibold text-blue-600">
              {summary?.currency || '₹'} {parseFloat(cashflow.outstanding_amount).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {cashflow.outstanding_count} invoice{cashflow.outstanding_count !== 1 ? 's' : ''} awaiting payment
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-400 mb-1">Overdue</p>
            <p className={`text-2xl font-semibold ${cashflow.overdue_count > 0 ? 'text-red-600' : 'text-gray-300'}`}>
              {summary?.currency || '₹'} {parseFloat(cashflow.overdue_amount).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {cashflow.overdue_count > 0
                ? `${cashflow.overdue_count} invoice${cashflow.overdue_count !== 1 ? 's' : ''} past due date`
                : 'Nothing overdue'}
            </p>
          </div>
        </div>
      )}

      {/* Overdue invoices — follow-up list */}
      {cashflow?.overdue_invoices?.length > 0 && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5 mb-4">
          <p className="text-sm font-medium text-red-700 mb-3">⚠ Needs Follow-up</p>
          <div className="space-y-2">
            {cashflow.overdue_invoices.map((inv) => (
              <div key={inv.id}
                onClick={() => navigate(`/invoices/${inv.id}`)}
                className="flex items-center justify-between rounded-xl bg-white border border-red-100 px-3 py-2.5 cursor-pointer hover:bg-red-50/50 transition">
                <div>
                  <p className="text-sm font-medium text-gray-800">{inv.customer_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{inv.invoice_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">
                    {summary?.currency || '₹'} {parseFloat(inv.total_amount).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">{inv.days_overdue} day{inv.days_overdue !== 1 ? 's' : ''} overdue</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low Stock + Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Low Stock */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-900">Low Stock Alerts</p>
            <button
              onClick={() => navigate("/products")}
              className="text-xs text-blue-600 hover:underline"
            >
              View all →
            </button>
          </div>

          {lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center mb-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                  strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-green-500" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">All products stocked</p>
              <p className="text-xs text-gray-400 mt-0.5">No restocking needed</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStock.map((product) => (
                <div key={product.id}
                  className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{product.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">SKU: {product.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-600">
                      {product.stock_quantity} left
                    </p>
                    <p className="text-xs text-gray-400">min {product.reorder_point}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-900">Recent Invoices</p>
            <button
              onClick={() => navigate("/invoices")}
              className="text-xs text-blue-600 hover:underline"
            >
              View all →
            </button>
          </div>

          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center mb-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                  strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-500" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M12 18v-6M9 15h6" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">No invoices yet</p>
              <button
                onClick={() => navigate("/invoices")}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                Create your first invoice →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <div key={inv.id}
                  className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900 font-mono">
                      {inv.invoice_number}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{inv.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">
                      {inv.currency} {parseFloat(inv.total_amount).toLocaleString()}
                    </p>
                    <div className="mt-0.5 flex justify-end">
                      <StatusBadge status={inv.status} />
                    </div>
                  </div>
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
    </Layout>
  )
}