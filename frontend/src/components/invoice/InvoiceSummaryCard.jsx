// InvoiceSummaryCard — sticky summary sidebar
// Auto-calculates subtotal, tax, total, profit from line items
// Profit is READ-ONLY — never user input
// Reusable for Create, Edit, Quotation workflows

const CURRENCY_SYMBOLS = {
  INR: '₹', USD: '$', AED: 'AED ', GBP: '£', EUR: '€',
}

export default function InvoiceSummaryCard({
  items = [],
  currency = 'INR',
  taxLabel = 'GST',
  onSaveDraft,
  onCreateInvoice,
  saving = null,
}) {
  const sym = CURRENCY_SYMBOLS[currency] || `${currency} `

  // All calculations — read-only, derived from items
  const subtotal = items.reduce((s, item) => s + item.quantity * item.unitPrice, 0)
  const taxAmount = items.reduce(
    (s, item) => s + item.quantity * item.unitPrice * (item.taxRate / 100),
    0
  )
  const grandTotal = subtotal + taxAmount
  const profit = items.reduce(
    (s, item) => s + item.quantity * (item.unitPrice - item.costPrice),
    0
  )

  const fmt = (num) =>
    `${sym}${Number(num).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`

  const hasItems = items.some((item) => item.product && item.quantity > 0)

  return (
    <div className="lg:sticky lg:top-20 rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-semibold text-gray-900 mb-4">Invoice Summary</p>

      {/* Totals breakdown */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Subtotal</span>
          <span className="text-gray-800 font-medium">{fmt(subtotal)}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{taxLabel}</span>
          <span className="text-gray-800 font-medium">{fmt(taxAmount)}</span>
        </div>

        <div className="h-px bg-gray-100 my-1" />

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">Total</span>
          <span className="text-lg font-bold text-gray-900">{fmt(grandTotal)}</span>
        </div>

        {/* Profit — auto-calculated, never editable */}
        <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-green-700 font-medium">Profit</span>
          <span className="text-sm font-bold text-green-700">{fmt(profit)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-5 space-y-2">
        <button
          onClick={onSaveDraft}
          disabled={!!saving || !hasItems}
          className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving === 'draft' ? 'Saving…' : 'Save Draft'}
        </button>

        <button
          onClick={onCreateInvoice}
          disabled={!!saving || !hasItems}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving === 'invoice' ? 'Creating…' : 'Create Invoice'}
        </button>
      </div>

      {!hasItems && (
        <p className="mt-3 text-center text-xs text-gray-400">
          Add at least one item to continue
        </p>
      )}
    </div>
  )
}