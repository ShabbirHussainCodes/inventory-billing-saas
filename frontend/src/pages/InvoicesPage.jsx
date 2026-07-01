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

function DeleteConfirm({ invoice, onConfirm, onCancel, loading }) {
  if (!invoice) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-base font-semibold text-gray-900">Delete draft invoice?</p>
        <p className="mt-1.5 text-sm text-gray-500">
          "<strong className="text-gray-800">{invoice.invoice_number}</strong>" will be
          permanently deleted and its stock will be restored.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Toast({ message }) {
  if (!message) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
      {message}
    </div>
  )
}

export default function InvoicesPage() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState("")

  const fetchInvoices = () => {
    billingAPI.getInvoices()
      .then((res) => setInvoices(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchInvoices() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000) }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await billingAPI.deleteInvoice(deleteConfirm.id)
      showToast("Draft deleted, stock restored ✓")
      fetchInvoices()
      setDeleteConfirm(null)
    } catch {
      showToast("Failed to delete invoice.")
    } finally { setDeleting(false) }
  }

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

      {/* List */}
      {loading ? (
        <InvoicesSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {search || statusFilter !== "all" ? "No invoices match your filters" : "No invoices yet"}
          </p>
          {!search && statusFilter === "all" && (
            <button onClick={() => navigate("/invoices/create")}
              className="mt-2 text-sm text-blue-600 hover:underline">
              Create your first invoice →
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-2xl border border-gray-200 bg-white overflow-hidden">
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
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-3.5">
                      <button onClick={() => navigate(`/invoices/${inv.id}`)}
                        className="font-medium font-mono text-sm text-blue-600 hover:underline">
                        {inv.invoice_number}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-gray-700">{inv.customer_name}</td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs">{formatDate(inv.invoice_date)}</td>
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
                    <td className="px-4 py-3.5"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3.5 text-right">
                      {inv.status === 'draft' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => navigate(`/invoices/edit/${inv.id}`)}
                            className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition">
                            Edit
                          </button>
                          <button onClick={() => setDeleteConfirm(inv)}
                            className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 transition">
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((inv) => (
              <div key={inv.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between mb-2">
                  <button onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="font-mono text-sm font-semibold text-blue-600 hover:underline">
                    {inv.invoice_number}
                  </button>
                  <StatusBadge status={inv.status} />
                </div>
                <p className="text-sm text-gray-700 mb-1">{inv.customer_name}</p>
                <p className="text-xs text-gray-400 mb-3">{formatDate(inv.invoice_date)}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {inv.currency} {parseFloat(inv.total_amount).toLocaleString()}
                    </p>
                    <p className="text-xs text-green-600 font-medium">
                      Profit: {inv.currency} {parseFloat(inv.total_profit).toLocaleString()}
                    </p>
                  </div>
                  {inv.status === 'draft' && (
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/invoices/edit/${inv.id}`)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                        Edit
                      </button>
                      <button onClick={() => setDeleteConfirm(inv)}
                        className="rounded-lg border border-red-100 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <DeleteConfirm
        invoice={deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        loading={deleting}
      />
      <Toast message={toast} />
    </Layout>
  )
}