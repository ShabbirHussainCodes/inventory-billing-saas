// InvoiceDetailPage — full invoice breakdown
// Shows exactly what was sold: products, quantities, prices, tax, totals
// This layout is also the foundation for future PDF download (Phase 6 Step 4)

import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import Layout from "../components/Layout"
import { billingAPI } from "../services/api"

const SYM = { INR: '₹', USD: '$', AED: 'AED ', GBP: '£', EUR: '€' }

function formatDate(dateStr) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  })
}

const STATUS_CFG = {
  draft:     { label: "Draft",     cls: "bg-gray-100 text-gray-600" },
  sent:      { label: "Sent",      cls: "bg-blue-50 text-blue-600" },
  paid:      { label: "Paid",      cls: "bg-green-50 text-green-700" },
  cancelled: { label: "Cancelled", cls: "bg-red-50 text-red-600" },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { label: status, cls: "bg-gray-100 text-gray-500" }
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium capitalize ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-64 rounded bg-gray-100" />
      <div className="h-80 rounded-2xl bg-gray-100" />
    </div>
  )
}

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    billingAPI.getInvoiceDetail(id)
      .then(res => setInvoice(res.data))
      .catch(() => setError('Could not load invoice.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Layout><Skeleton /></Layout>

  if (error || !invoice) {
    return (
      <Layout>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-600 mb-3">{error || 'Invoice not found.'}</p>
          <button onClick={() => navigate('/invoices')}
            className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50">
            ← Back to Invoices
          </button>
        </div>
      </Layout>
    )
  }

  const sym = SYM[invoice.currency] || invoice.currency + ' '
  const fmt = n => `${sym}${parseFloat(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <Layout>
      {/* Header bar — actions */}
      <div className="mb-5 flex flex-wrap items-center gap-3 print:hidden">
        <button onClick={() => navigate('/invoices')}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition">
          ← Back
        </button>
        <div className="flex-1" />
        {invoice.status === 'draft' && (
          <button onClick={() => navigate(`/invoices/edit/${invoice.id}`)}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            Edit Invoice
          </button>
        )}
        <button onClick={() => window.print()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
          Print / Save PDF
        </button>
      </div>

      {/* Invoice document */}
      <div className="rounded-2xl border border-gray-200 bg-white p-8 max-w-3xl mx-auto print:border-none print:shadow-none">

        {/* Document header */}
        <div className="flex items-start justify-between pb-6 border-b border-gray-100">
          <div>
            <p className="text-xl font-bold text-gray-900">INVOICE</p>
            <p className="text-sm text-gray-500 mt-1 font-mono">{invoice.invoice_number}</p>
          </div>
          <div className="text-right">
            <StatusBadge status={invoice.status} />
            <p className="text-xs text-gray-400 mt-2">Issued {formatDate(invoice.invoice_date)}</p>
            {invoice.due_date && (
              <p className="text-xs text-gray-400">Due {formatDate(invoice.due_date)}</p>
            )}
          </div>
        </div>

        {/* Bill to */}
        <div className="py-6 border-b border-gray-100">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-2">Billed To</p>
          <p className="text-base font-semibold text-gray-900">{invoice.customer_name}</p>
        </div>

        {/* Line items */}
        <div className="py-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 text-left font-medium">Product</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Unit Price</th>
                <th className="pb-2 text-right font-medium">Tax</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(invoice.items || []).map(item => (
                <tr key={item.id}>
                  <td className="py-3 text-gray-800">{item.product_name}</td>
                  <td className="py-3 text-right text-gray-600">{item.quantity}</td>
                  <td className="py-3 text-right text-gray-600">{fmt(item.unit_price)}</td>
                  <td className="py-3 text-right text-gray-500 text-xs">{item.tax_rate}%</td>
                  <td className="py-3 text-right font-medium text-gray-900">{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {invoice.items?.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">No items in this invoice.</p>
          )}
        </div>

        {/* Totals */}
        <div className="flex justify-end pt-4 border-t border-gray-100">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-800">{fmt(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{invoice.tax_label}</span>
              <span className="text-gray-800">{fmt(invoice.tax_amount)}</span>
            </div>
            <div className="h-px bg-gray-100 my-1" />
            <div className="flex justify-between">
              <span className="text-sm font-semibold text-gray-900">Total</span>
              <span className="text-lg font-bold text-gray-900">{fmt(invoice.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Internal note: profit — hidden when printing (customer shouldn't see this) */}
        <div className="mt-4 flex justify-end print:hidden">
          <div className="w-64 rounded-lg bg-green-50 border border-green-100 px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-green-700">Your Profit</span>
            <span className="text-sm font-bold text-green-700">{fmt(invoice.total_profit)}</span>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5">Notes</p>
            <p className="text-sm text-gray-600">{invoice.notes}</p>
          </div>
        )}
      </div>
    </Layout>
  )
}