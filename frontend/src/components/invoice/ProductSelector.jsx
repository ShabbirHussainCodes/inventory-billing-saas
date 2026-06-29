// ProductSelector — reusable product picker with live stock + pricing info
// Shows contextual info below selection without cluttering the row
// Props: products, value (product id), onChange, currency, onAddNew

const SYM = { INR:'₹', USD:'$', AED:'AED ', GBP:'£', EUR:'€' }

export default function ProductSelector({ products=[], value, onChange, currency='INR', onAddNew }) {
  const sym = SYM[currency] || currency+' '
  const selected = products.find(p => p.id === value) || null

  const stockColor = selected
    ? selected.stock_quantity === 0 ? 'text-red-500'
    : selected.stock_quantity <= selected.reorder_point ? 'text-amber-500'
    : 'text-green-600'
    : ''

  return (
    <div className="space-y-1">
      <select
        value={value || ''}
        onChange={e => onChange(products.find(p => p.id === e.target.value) || null)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      >
        <option value="">Select product…</option>
        {products.map(p => (
          <option key={p.id} value={p.id} disabled={p.stock_quantity === 0}>
            {p.name}{p.stock_quantity === 0 ? ' (Out of stock)' : ''}
          </option>
        ))}
      </select>

      {/* Contextual info — shows only when product selected */}
      {selected && (
        <div className="flex items-center gap-2 px-1 text-xs">
          <span className={`font-medium ${stockColor}`}>
            Stock: {selected.stock_quantity}
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">{sym}{parseFloat(selected.selling_price).toLocaleString()}</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">{selected.tax_rate}% tax</span>
        </div>
      )}

      {/* Add new product inline */}
      {onAddNew && (
        <button type="button" onClick={onAddNew}
          className="flex items-center gap-1 px-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New product
        </button>
      )}
    </div>
  )
}