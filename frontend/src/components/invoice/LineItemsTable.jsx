// LineItemsTable — reusable line items component
// Auto-fills price/tax from product, real-time total calc, stock warning
// Reusable for: Create Invoice, Edit Invoice, Quotation, PO

import ProductSelector from "./ProductSelector"

const CURRENCY_SYMBOLS = {
  INR: '₹', USD: '$', AED: 'AED ', GBP: '£', EUR: '€',
}

export default function LineItemsTable({ items, products, onItemsChange, currency = 'INR' }) {
  const sym = CURRENCY_SYMBOLS[currency] || `${currency} `

  // New empty item
  const addItem = () => {
    onItemsChange([
      ...items,
      {
        id: Date.now(),
        product: null,
        quantity: 1,
        unitPrice: 0,
        costPrice: 0,
        taxRate: 0,
        stockAvailable: 0,
      },
    ])
  }

  const removeItem = (id) => {
    onItemsChange(items.filter((item) => item.id !== id))
  }

  const updateItem = (id, changes) => {
    onItemsChange(items.map((item) => (item.id === id ? { ...item, ...changes } : item)))
  }

  // Product selected → auto-fill price, cost, tax, stock
  const handleProductChange = (id, product) => {
    updateItem(id, {
      product,
      unitPrice: product ? parseFloat(product.selling_price) : 0,
      costPrice: product ? parseFloat(product.cost_price) : 0,
      taxRate: product ? parseFloat(product.tax_rate) : 0,
      stockAvailable: product ? product.stock_quantity : 0,
    })
  }

  const fmt = (num) =>
    `${sym}${Number(num).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  return (
    <div>
      {/* Column headers */}
      <div className="mb-2 grid grid-cols-12 gap-2 px-1 text-xs font-medium text-gray-400">
        <div className="col-span-5">Product</div>
        <div className="col-span-2">Qty</div>
        <div className="col-span-2">Unit Price</div>
        <div className="col-span-2 text-right">Total</div>
        <div className="col-span-1" />
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item) => {
          const lineSubtotal = item.quantity * item.unitPrice
          const lineTax = lineSubtotal * (item.taxRate / 100)
          const lineTotal = lineSubtotal + lineTax
          const isOverStock = item.product && item.quantity > item.stockAvailable
          const isOutOfStock = item.product && item.stockAvailable === 0

          return (
            <div
              key={item.id}
              className={`rounded-xl border p-3 ${
                isOverStock ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="grid grid-cols-12 gap-2 items-start">
                {/* Product selector */}
                <div className="col-span-5">
                  <ProductSelector
                    products={products}
                    value={item.product?.id || ''}
                    onChange={(product) => handleProductChange(item.id, product)}
                    currency={currency}
                  />
                </div>

                {/* Quantity */}
                <div className="col-span-2">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      isOverStock
                        ? 'border-red-300 bg-white focus:ring-red-500/30'
                        : 'border-gray-200 bg-white focus:ring-blue-500/30'
                    }`}
                  />
                  {/* Real-time stock warning */}
                  {isOutOfStock && (
                    <p className="mt-1 text-xs text-red-500">⚠ Out of stock</p>
                  )}
                  {!isOutOfStock && isOverStock && (
                    <p className="mt-1 text-xs text-red-500">
                      ⚠ Only {item.stockAvailable} available
                    </p>
                  )}
                </div>

                {/* Unit price — editable (can override) */}
                <div className="col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                {/* Line total — read-only, auto-calculated */}
                <div className="col-span-2 pt-2 text-right">
                  <p className="text-sm font-semibold text-gray-800">{fmt(lineTotal)}</p>
                  {item.taxRate > 0 && (
                    <p className="text-xs text-gray-400">incl. {item.taxRate}% tax</p>
                  )}
                </div>

                {/* Remove button */}
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="mt-1.5 rounded p-1 text-gray-400 hover:text-red-500 transition"
                    aria-label="Remove item"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add item */}
      <button
        onClick={addItem}
        className="mt-3 flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Item
      </button>
    </div>
  )
}