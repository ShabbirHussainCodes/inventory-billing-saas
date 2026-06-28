import { useState, useEffect } from "react"
import { billingAPI, inventoryAPI } from "../../services/api"

// ─── Currency helper ──────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS = {
  INR: "₹", USD: "$", AED: "AED ", GBP: "£", EUR: "€",
}

function formatAmount(amount, currency) {
  const sym = CURRENCY_SYMBOLS[currency] || `${currency} `
  const num = parseFloat(amount) || 0
  if (num >= 100000) return `${sym}${(num / 100000).toFixed(1)}L`
  if (num >= 1000) return `${sym}${(num / 1000).toFixed(1)}k`
  return `${sym}${num.toFixed(0)}`
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function ReportCard({ title, value, sub, variant = "default" }) {
  const colors = {
    default: "text-gray-900",
    success: "text-green-600",
    warning: "text-amber-600",
    danger:  "text-red-500",
  }
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500 mb-1.5">{title}</p>
      <p className={`text-2xl font-semibold ${colors[variant]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
      {children}
    </p>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ReportsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-100" />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}

// ─── Main WorkspaceReports ────────────────────────────────────────────────────

export default function WorkspaceReports() {
  const [summary, setSummary] = useState(null)
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchAll = async () => {
    setLoading(true)
    setError("")
    try {
      // Teeno parallel mein — fast load
      const [summaryRes, productsRes, customersRes] = await Promise.all([
        billingAPI.getSummary(),
        inventoryAPI.getProducts(),
        billingAPI.getCustomers(),
      ])
      setSummary(summaryRes.data)
      setProducts(productsRes.data)
      setCustomers(customersRes.data)
    } catch (err) {
      setError(err?.response?.data?.error || "Could not load reports.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  if (loading) return <ReportsSkeleton />

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-600 mb-1">Failed to load reports</p>
        <p className="text-xs text-red-400 mb-3">{error}</p>
        <button onClick={fetchAll}
          className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50">
          Try again
        </button>
      </div>
    )
  }

  const currency = summary?.currency || "INR"
  const pendingInvoices = (summary?.total_invoices || 0) - (summary?.paid_invoices || 0)
  const lowStockProducts = products.filter((p) => p.is_low_stock)
  const activeCustomers = customers.filter((c) => c.is_active)

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Business Reports</h2>
        <p className="text-xs text-gray-400">
          Read-only snapshot — real-time data from client's account
        </p>
      </div>

      {/* Revenue */}
      <div>
        <SectionTitle>Revenue</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ReportCard
            title="Total Revenue"
            value={formatAmount(summary?.total_revenue || 0, currency)}
            sub="All invoices"
            variant="success"
          />
          <ReportCard
            title="Total Profit"
            value={formatAmount(summary?.total_profit || 0, currency)}
            sub={`${currency} earned`}
            variant="success"
          />
          <ReportCard
            title="Paid Invoices"
            value={summary?.paid_invoices || 0}
            sub="Collected"
          />
          <ReportCard
            title="Pending"
            value={pendingInvoices}
            sub="Draft + Sent"
            variant={pendingInvoices > 0 ? "warning" : "default"}
          />
        </div>
      </div>

      {/* Inventory + Customers */}
      <div>
        <SectionTitle>Operations</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <ReportCard
            title="Total Products"
            value={products.length}
            sub="In inventory"
          />
          <ReportCard
            title="Low Stock"
            value={lowStockProducts.length}
            sub={lowStockProducts.length > 0 ? "Needs restocking" : "All stocked"}
            variant={lowStockProducts.length > 0 ? "warning" : "default"}
          />
          <ReportCard
            title="Active Customers"
            value={activeCustomers.length}
            sub={`of ${customers.length} total`}
          />
        </div>
      </div>

      {/* Low stock detail */}
      {lowStockProducts.length > 0 && (
        <div>
          <SectionTitle>Low Stock Alert</SectionTitle>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-amber-700 border-b border-amber-200">
                  <th className="px-4 py-2.5 text-left font-medium">Product</th>
                  <th className="px-4 py-2.5 text-left font-medium">SKU</th>
                  <th className="px-4 py-2.5 text-right font-medium">Stock</th>
                  <th className="px-4 py-2.5 text-right font-medium">Reorder At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {lowStockProducts.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 font-medium text-amber-900">{p.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-amber-700">{p.sku}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-amber-700">
                      {p.stock_quantity}
                    </td>
                    <td className="px-4 py-2.5 text-right text-amber-600">{p.reorder_point}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Founder note */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
        <p className="text-xs text-blue-700 font-medium">📋 Founder Note</p>
        <p className="text-xs text-blue-600 mt-0.5">
          Yeh data real-time hai. Agar client ke inventory mein issues hain —
          Low Stock section dekho aur client ko proactively suggest karo.
        </p>
      </div>
    </div>
  )
}