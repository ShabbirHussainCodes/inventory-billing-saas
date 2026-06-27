import { useState, useEffect } from "react"
import { billingAPI } from "../../services/api"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS = {
  INR: "₹", USD: "$", AED: "AED ", GBP: "£", EUR: "€",
}

function formatAmount(amount, currency) {
  const sym = CURRENCY_SYMBOLS[currency] || `${currency} `
  return `${sym}${parseFloat(amount).toLocaleString()}`
}

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
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Invoice Detail Modal ─────────────────────────────────────────────────────

function InvoiceDetailModal({ invoice, isEditMode, onClose, onStatusChange, statusLoading }) {
  if (!invoice) return null

  const NEXT_STATUSES = {
    draft:     ["sent", "cancelled"],
    sent:      ["paid", "cancelled"],
    paid:      [],
    cancelled: ["draft"],
  }
  const nextStatuses = NEXT_STATUSES[invoice.status] || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900">
                {invoice.invoice_number}
              </h3>
              <StatusBadge status={invoice.status} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {invoice.customer_name} · {formatDate(invoice.invoice_date)}
            </p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        {/* Line items */}
        <div className="px-6 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Items
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 text-left font-medium">Product</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Unit Price</th>
                <th className="pb-2 text-right font-medium">Tax</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(invoice.items || []).map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 text-gray-800">{item.product_name}</td>
                  <td className="py-2.5 text-right text-gray-600">{item.quantity}</td>
                  <td className="py-2.5 text-right text-gray-600">
                    {formatAmount(item.unit_price, invoice.currency)}
                  </td>
                  <td className="py-2.5 text-right text-gray-500 text-xs">
                    {item.tax_rate}%
                  </td>
                  <td className="py-2.5 text-right font-medium text-gray-800">
                    {formatAmount(item.total, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{formatAmount(invoice.subtotal, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>{invoice.tax_label || "Tax"}</span>
              <span>{formatAmount(invoice.tax_amount, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-gray-900 pt-1 border-t border-gray-100">
              <span>Total</span>
              <span>{formatAmount(invoice.total_amount, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-xs text-green-600">
              <span>Profit</span>
              <span>{formatAmount(invoice.total_profit, invoice.currency)}</span>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Footer — status actions (Edit Mode only) */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <div>
            {isEditMode && nextStatuses.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Mark as:</span>
                {nextStatuses.map((s) => (
                  <button key={s}
                    onClick={() => onStatusChange(invoice.id, s)}
                    disabled={statusLoading}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition disabled:opacity-60 ${
                      s === "paid"      ? "bg-green-500 text-white hover:bg-green-600" :
                      s === "cancelled" ? "bg-red-500 text-white hover:bg-red-600" :
                      s === "sent"      ? "bg-blue-500 text-white hover:bg-blue-600" :
                      "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}>
                    {statusLoading ? "…" : STATUS_CFG[s]?.label || s}
                  </button>
                ))}
              </div>
            )}
            {!isEditMode && (
              <p className="text-xs text-amber-600">
                👁 Switch to Edit Mode to change invoice status
              </p>
            )}
          </div>
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message }) {
  if (!message) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
      {message}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function InvoicesSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-gray-100" />
      ))}
    </div>
  )
}

// ─── Main WorkspaceInvoices ───────────────────────────────────────────────────

export default function WorkspaceInvoices({ isEditMode }) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [toast, setToast] = useState("")

  const fetchInvoices = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await billingAPI.getInvoices()
      setInvoices(res.data)
    } catch (err) {
      setError(err?.response?.data?.error || "Could not load invoices.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInvoices() }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  // Status update
  const handleStatusChange = async (invoiceId, newStatus) => {
    setStatusLoading(true)
    try {
      await billingAPI.updateInvoiceStatus(invoiceId, newStatus)
      showToast(`Invoice marked as ${STATUS_CFG[newStatus]?.label} ✓`)
      await fetchInvoices()
      // Update selected invoice status in modal
      setSelectedInvoice((prev) => prev ? { ...prev, status: newStatus } : null)
    } catch {
      showToast("Status update failed. Try again.")
    } finally {
      setStatusLoading(false)
    }
  }

  // Client-side filter
  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase()
    return (
      !q ||
      inv.invoice_number.toLowerCase().includes(q) ||
      (inv.customer_name || "").toLowerCase().includes(q)
    )
  })

  if (loading) return <InvoicesSkeleton />

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-600 mb-1">Failed to load invoices</p>
        <p className="text-xs text-red-400 mb-3">{error}</p>
        <button onClick={fetchInvoices}
          className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50">
          Try again
        </button>
      </div>
    )
  }

  const totalRevenue = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + parseFloat(i.total_amount), 0)

  const currency = invoices[0]?.currency || "INR"

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Invoices</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {invoices.length} invoices ·{" "}
            <span className="text-green-600">
              {formatAmount(totalRevenue, currency)} collected
            </span>
          </p>
        </div>

        <div className="ml-auto">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search by invoice no. or customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-64"
            />
          </div>
        </div>
      </div>

      {/* View mode notice */}
      {!isEditMode && (
        <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-700">
            👁 View Only — Switch to Edit Mode to update invoice status
          </p>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400">
              <th className="px-4 py-3 text-left font-medium">Invoice</th>
              <th className="px-4 py-3 text-left font-medium">Customer</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Amount</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                  {search ? "No invoices match your search." : "No invoices yet."}
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
                  <td className="px-4 py-3.5 font-medium text-gray-800">
                    {formatAmount(inv.total_amount, inv.currency)}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice detail modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          isEditMode={isEditMode}
          onClose={() => setSelectedInvoice(null)}
          onStatusChange={handleStatusChange}
          statusLoading={statusLoading}
        />
      )}

      <Toast message={toast} />
    </>
  )
}