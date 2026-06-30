import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Layout from "../components/Layout"
import { billingAPI } from "../services/api"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  })
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG = {
  draft:     { label: "Draft",     cls: "bg-gray-100 text-gray-600" },
  sent:      { label: "Sent",      cls: "bg-blue-50 text-blue-600" },
  paid:      { label: "Paid",      cls: "bg-green-50 text-green-700" },
  cancelled: { label: "Cancelled", cls: "bg-red-50 text-red-600" },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { label: status, cls: "bg-gray-100 text-gray-500" }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function InvoicesSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-gray-100" />
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  useEffect(() => {
    billingAPI.getInvoices()
      .then((res) => setInvoices(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Client-side filter
  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      inv.invoice_number?.toLowerCase().includes(q) ||
      (inv.customer_name || "").toLowerCase().includes(q)
    const matchStatus = statusFilter === "all" || inv.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <Layout>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">Invoices</h2>
          <p className="text-xs text-gray-400 mt-0.5">{invoices.length} total</p>
        </div>
        <button
          onClick={() => navigate("/invoices/create")}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          + Create Invoice
        </button>
      </div>

      {/* Search + filter */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search by invoice no. or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="all">All status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <InvoicesSkeleton />
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400">
                <th className="px-4 py-3 text-left font-medium">Invoice</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Profit</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      {search || statusFilter !== "all"
                        ? "No invoices match your filters"
                        : "No invoices yet"}
                    </p>
                    {!search && statusFilter === "all" && (
                      <button
                        onClick={() => navigate("/invoices/create")}
                        className="mt-2 text-sm text-blue-600 hover:underline"
                      >
                        Create your first invoice →
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-3.5">
                      <p className="font-medium font-mono text-sm text-gray-900">
                        {inv.invoice_number}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-gray-700">
                      {inv.customer_name}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs">
                      {formatDate(inv.invoice_date)}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-gray-900">
                        {inv.currency} {parseFloat(inv.total_amount).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        incl. {inv.tax_label} {inv.currency} {parseFloat(inv.tax_amount).toLocaleString()}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-medium text-green-600">
                        {inv.currency} {parseFloat(inv.total_profit).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {inv.status === 'draft' ? (
                        <button
                          onClick={() => navigate(`/invoices/edit/${inv.id}`)}
                          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition"
                        >
                          Edit
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}