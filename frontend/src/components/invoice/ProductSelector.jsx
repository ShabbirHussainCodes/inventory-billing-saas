// ProductSelector — reusable product picker
// Shows stock info + price + tax when a product is selected
// Props:
//   products   → array of products
//   value      → selected product id
//   onChange   → (product | null) => void
//   currency   → for price display

const CURRENCY_SYMBOLS = {
  INR: '₹', USD: '$', AED: 'AED ', GBP: '£', EUR: '€',
}

export default function ProductSelector({ products = [], value, onChange, currency = 'INR' }) {
  const sym = CURRENCY_SYMBOLS[currency] || `${currency} `
  const selected = products.find((p) => p.id === value) || null

  const stockColor = selected
    ? selected.stock_quantity === 0
      ? 'text-red-500'
      : selected.stock_quantity <= selected.reorder_point
      ? 'text-amber-500'
      : 'text-green-600'
    : ''

  return (
    <div>
      <select
        value={value || ''}
        onChange={(e) => {
          const product = products.find((p) => p.id === e.target.value) || null
          onChange(product)
        }}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
      >
        <option value="">Select product…</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} (Stock: {p.stock_quantity})
          </option>
        ))}
      </select>

      {/* Live stock info — shows after product selected */}
      {selected && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <span className={`font-medium ${stockColor}`}>
            Stock: {selected.stock_quantity}
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">
            {sym}{parseFloat(selected.selling_price).toLocaleString()}
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">
            {selected.tax_rate}% tax
          </span>
        </div>
      )}
    </div>
  )
}