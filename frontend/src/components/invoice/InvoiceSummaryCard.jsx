// InvoiceSummaryCard — premium checkout-style summary
// Profit is READ-ONLY, auto-calculated — never user input
// Reusable: Create, Edit, Quotation, PO

import { calcLine } from "./LineItemsTable"

const SYM = { INR:'₹', USD:'$', AED:'AED ', GBP:'£', EUR:'€' }

export default function InvoiceSummaryCard({ items=[], currency='INR', taxLabel='GST', onSaveDraft, onCreateInvoice, saving=null, draftLabel='Save as Draft', submitLabel='Create Invoice' }) {
  const sym = SYM[currency] || currency+' '
  const fmt = n => `${sym}${Number(n).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}`

  // All derived from items — never user input
  let originalSubtotal = 0
  let totalDiscount = 0
  let taxAmount = 0
  let profit = 0

  items.forEach(item => {
    const { discountAmount, lineBeforeTax, lineTax, lineProfit } = calcLine(item)
    const qty = Number(item.quantity) || 0
    const base = Number(item.unitPrice) || 0
    originalSubtotal += base * qty
    totalDiscount += discountAmount
    taxAmount += lineTax
    profit += lineProfit
  })

  const discountedSubtotal = originalSubtotal - totalDiscount
  const grandTotal = discountedSubtotal + taxAmount

  const hasItems = items.some(i => i.product && Number(i.quantity) > 0)
  const hasStockIssue = items.some(i => i.product && Number(i.quantity) > i.stockAvailable)

  return (
    <div className="lg:sticky lg:top-20 rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-100 px-5 py-4">
        <p className="text-sm font-semibold text-gray-900">Summary</p>
      </div>

      {/* Breakdown */}
      <div className="px-5 py-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Subtotal</span>
          <span className="text-gray-800">{fmt(originalSubtotal)}</span>
        </div>

        {totalDiscount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-green-600">Discount</span>
            <span className="text-green-600 font-medium">-{fmt(totalDiscount)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{taxLabel}</span>
          <span className="text-gray-800">{fmt(taxAmount)}</span>
        </div>

        <div className="h-px bg-gray-100" />

        {/* Grand Total — emphasized */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">Grand Total</span>
          <span className="text-xl font-bold text-gray-900">{fmt(grandTotal)}</span>
        </div>

        {/* Profit — read-only, auto-calculated */}
        <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${
          profit < 0 ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'
        }`}>
          <div>
            <p className={`text-xs font-medium ${profit < 0 ? 'text-red-700' : 'text-green-700'}`}>
              Profit
            </p>
            {profit < 0 && (
              <p className="text-[10px] text-red-500 mt-0.5">Selling below cost</p>
            )}
          </div>
          <span className={`text-sm font-bold ${profit < 0 ? 'text-red-700' : 'text-green-700'}`}>
            {fmt(profit)}
          </span>
        </div>

        {/* Stock warning */}
        {hasStockIssue && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
            <p className="text-xs text-red-600">⚠ Some items exceed available stock</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="border-t border-gray-100 px-5 py-4 space-y-2">
        <button type="button"
          onClick={onSaveDraft}
          disabled={!!saving || !hasItems}
          className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
          {saving === 'draft' ? 'Saving…' : draftLabel}
        </button>

        <button type="button"
          onClick={onCreateInvoice}
          disabled={!!saving || !hasItems || hasStockIssue}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {saving === 'invoice' ? 'Saving…' : (
            <>
              {submitLabel}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </>
          )}
        </button>

        {!hasItems && (
          <p className="text-center text-xs text-gray-400 pt-1">
            Add at least one item to continue
          </p>
        )}
      </div>
    </div>
  )
}