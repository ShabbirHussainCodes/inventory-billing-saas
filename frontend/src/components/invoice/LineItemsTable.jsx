// LineItemsTable — premium line items with price override, discount, real-time warnings
// Reusable: Create Invoice, Edit Invoice, Quotation, PO, POS

import ProductSelector from "./ProductSelector"

const SYM = { INR:'₹', USD:'$', AED:'AED ', GBP:'£', EUR:'€' }

// Per-line calculation — returns all derived values
export function calcLine(item) {
  const qty = Number(item.quantity) || 0
  const base = Number(item.unitPrice) || 0
  const cost = Number(item.costPrice) || 0
  const tax = Number(item.taxRate) || 0
  const dv = Number(item.discountValue) || 0

  // Discount amount (on the line total, before tax)
  const discountAmount = item.discountType === 'percent'
    ? base * qty * (dv / 100)
    : Math.min(dv, base * qty) // ₹ discount can't exceed line total

  const lineBeforeTax = Math.max(0, base * qty - discountAmount)
  const effectiveUnitPrice = qty > 0 ? lineBeforeTax / qty : 0
  const lineTax = lineBeforeTax * (tax / 100)
  const lineTotal = lineBeforeTax + lineTax
  const lineProfit = qty > 0 ? lineBeforeTax - cost * qty : 0
  const isBelowCost = effectiveUnitPrice > 0 && effectiveUnitPrice < cost

  return { discountAmount, lineBeforeTax, effectiveUnitPrice, lineTax, lineTotal, lineProfit, isBelowCost }
}

export const newItem = () => ({
  id: Date.now() + Math.random(),
  product: null,
  quantity: 1,
  unitPrice: 0,       // user-editable, defaults from product.selling_price
  costPrice: 0,       // from product, used only for profit calc (not sent to API)
  taxRate: 0,
  stockAvailable: 0,
  discountType: 'percent',
  discountValue: 0,
  showDiscount: false,
})

export default function LineItemsTable({ items, products, onItemsChange, currency='INR', onAddNewProduct }) {
  const sym = SYM[currency] || currency+' '
  const fmt = n => `${sym}${Number(n).toLocaleString(undefined,{maximumFractionDigits:0})}`

  const add = () => onItemsChange([...items, newItem()])
  const remove = id => onItemsChange(items.filter(i => i.id !== id))
  const update = (id, changes) => onItemsChange(items.map(i => i.id===id ? {...i,...changes} : i))

  const handleProduct = (id, product) => {
    update(id, {
      product,
      unitPrice: product ? parseFloat(product.selling_price) : 0,
      costPrice: product ? parseFloat(product.cost_price) : 0,
      taxRate:   product ? parseFloat(product.tax_rate) : 0,
      stockAvailable: product ? product.stock_quantity : 0,
    })
  }

  return (
    <div>
      {/* Header — desktop only */}
      <div className="hidden md:grid mb-2 grid-cols-12 gap-2 px-1 text-xs font-medium text-gray-400">
        <div className="col-span-4">Product</div>
        <div className="col-span-2 text-center">Qty</div>
        <div className="col-span-2 text-center">Unit Price</div>
        <div className="col-span-2 text-center">Discount</div>
        <div className="col-span-1 text-right">Total</div>
        <div className="col-span-1"/>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => {
          const { discountAmount, lineBeforeTax, lineTax, lineTotal, isBelowCost } = calcLine(item)
          const isOverStock = item.product && item.quantity > item.stockAvailable
          const isOutOfStock = item.product && item.stockAvailable === 0

          return (
            <div key={item.id} className={`rounded-xl border p-3 transition ${
              isOverStock ? 'border-red-200 bg-red-50' : isBelowCost ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200 bg-gray-50'
            }`}>

              {/* Desktop layout */}
              <div className="hidden md:grid grid-cols-12 gap-2 items-start">
                <div className="col-span-4">
                  <ProductSelector products={products} value={item.product?.id || ''}
                    onChange={p => handleProduct(item.id, p)} currency={currency} onAddNew={onAddNewProduct} />
                </div>
                <div className="col-span-2">
                  <input type="number" min="1" value={item.quantity}
                    onChange={e => {
                      const val = e.target.value
                      update(item.id, { quantity: val === '' ? '' : Math.max(1, parseInt(val)||1) })
                    }}
                    onBlur={() => {
                      if (item.quantity === '' || !item.quantity) update(item.id, { quantity: 1 })
                    }}
                    className={`w-full rounded-lg border px-2 py-2 text-center text-sm focus:outline-none focus:ring-2 ${isOverStock ? 'border-red-300 bg-white focus:ring-red-500/30' : 'border-gray-200 bg-white focus:ring-blue-500/30'}`}
                  />
                  {isOutOfStock && <p className="mt-0.5 text-center text-[10px] text-red-500">Out of stock</p>}
                  {!isOutOfStock && isOverStock && <p className="mt-0.5 text-center text-[10px] text-red-500">⚠ Only {item.stockAvailable}</p>}
                </div>
                <div className="col-span-2">
                  <input type="number" min="0" step="0.01" value={item.unitPrice}
                    onChange={e => update(item.id, { unitPrice: parseFloat(e.target.value)||0 })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  {isBelowCost && <p className="mt-0.5 text-center text-[10px] text-amber-600">⚠ Below cost</p>}
                </div>
                <div className="col-span-2">
                  <div className="flex gap-1">
                    <select value={item.discountType} onChange={e => update(item.id, { discountType: e.target.value })}
                      className="w-10 rounded-lg border border-gray-200 bg-white px-1 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                      <option value="percent">%</option>
                      <option value="amount">{sym}</option>
                    </select>
                    <input type="number" min="0" step="0.01" value={item.discountValue || ''} placeholder="0"
                      onChange={e => update(item.id, { discountValue: parseFloat(e.target.value)||0 })}
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                  {discountAmount > 0 && <p className="mt-0.5 text-center text-[10px] text-green-600">-{fmt(discountAmount)}</p>}
                </div>
                <div className="col-span-1 pt-2 text-right">
                  <p className="text-sm font-semibold text-gray-800">{fmt(lineTotal)}</p>
                  {item.taxRate > 0 && <p className="text-[10px] text-gray-400">+{item.taxRate}% tax</p>}
                </div>
                <div className="col-span-1 flex justify-end">
                  <button type="button" onClick={() => remove(item.id)}
                    className="mt-2 rounded p-1 text-gray-400 hover:text-red-500 transition" aria-label="Remove item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Mobile layout — stacked */}
              <div className="md:hidden space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <ProductSelector products={products} value={item.product?.id || ''}
                      onChange={p => handleProduct(item.id, p)} currency={currency} onAddNew={onAddNewProduct} />
                  </div>
                  <button type="button" onClick={() => remove(item.id)}
                    className="mt-1 rounded p-1 text-gray-400 hover:text-red-500 transition flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Qty</p>
                    <input type="number" min="1" value={item.quantity}
                      onChange={e => {
                        const val = e.target.value
                        update(item.id, { quantity: val === '' ? '' : Math.max(1, parseInt(val)||1) })
                      }}
                      onBlur={() => {
                        if (item.quantity === '' || !item.quantity) update(item.id, { quantity: 1 })
                      }}
                      className={`w-full rounded-lg border px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 ${isOverStock ? 'border-red-300 bg-white' : 'border-gray-200 bg-white'}`}
                    />
                    {isOutOfStock && <p className="mt-0.5 text-[10px] text-red-500">Out of stock</p>}
                    {!isOutOfStock && isOverStock && <p className="mt-0.5 text-[10px] text-red-500">⚠ Only {item.stockAvailable}</p>}
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Unit Price</p>
                    <input type="number" min="0" step="0.01" value={item.unitPrice}
                      onChange={e => update(item.id, { unitPrice: parseFloat(e.target.value)||0 })}
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    {isBelowCost && <p className="mt-0.5 text-[10px] text-amber-600">⚠ Below cost</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 flex-1 mr-3">
                    <select value={item.discountType} onChange={e => update(item.id, { discountType: e.target.value })}
                      className="w-10 rounded-lg border border-gray-200 bg-white px-1 py-1.5 text-xs focus:outline-none">
                      <option value="percent">%</option>
                      <option value="amount">{sym}</option>
                    </select>
                    <input type="number" min="0" step="0.01" value={item.discountValue || ''} placeholder="Discount"
                      onChange={e => update(item.id, { discountValue: parseFloat(e.target.value)||0 })}
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{fmt(lineTotal)}</p>
                    {item.taxRate > 0 && <p className="text-[10px] text-gray-400">+{item.taxRate}% tax</p>}
                    {discountAmount > 0 && <p className="text-[10px] text-green-600">-{fmt(discountAmount)}</p>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add item */}
      <button type="button" onClick={add}
        className="mt-3 flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Line Item
      </button>
    </div>
  )
}