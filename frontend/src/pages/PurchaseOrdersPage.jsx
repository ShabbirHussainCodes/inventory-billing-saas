import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { inventoryAPI } from "../services/api"
import ProductSelector from "../components/invoice/ProductSelector"

const SYM = { INR: '₹', USD: '$', AED: 'AED ', GBP: '£', EUR: '€' }

function formatDate(dateStr) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

const STATUS_CFG = {
  draft:     { label: "Draft",     cls: "bg-gray-100 text-gray-600" },
  ordered:   { label: "Ordered",   cls: "bg-blue-50 text-blue-600" },
  received:  { label: "Received",  cls: "bg-green-50 text-green-700" },
  cancelled: { label: "Cancelled", cls: "bg-red-50 text-red-600" },
}

// Mirrors backend's PurchaseOrder.get_freight_allocation() exactly — this
// is a PREVIEW only (before the order is saved), so the two must stay in
// sync. If the split logic ever changes, update both places.
function calculateFreightAllocation(items, freightCharge, splitMethod) {
  const charge = parseFloat(freightCharge) || 0
  const validItems = items.filter(i => i.product)
  if (!validItems.length || charge === 0) return {}

  const allocation = {}

  if (splitMethod === 'equal') {
    const share = charge / validItems.length
    validItems.forEach(i => { allocation[i.id] = share })
  } else if (splitMethod === 'by_quantity') {
    const totalQty = validItems.reduce((s, i) => s + (i.quantity_ordered || 0), 0)
    if (totalQty === 0) return {}
    validItems.forEach(i => { allocation[i.id] = ((i.quantity_ordered || 0) / totalQty) * charge })
  } else if (splitMethod === 'by_value') {
    const totalValue = validItems.reduce((s, i) => s + (i.unit_cost || 0) * (i.quantity_ordered || 0), 0)
    if (totalValue === 0) return {}
    validItems.forEach(i => {
      const val = (i.unit_cost || 0) * (i.quantity_ordered || 0)
      allocation[i.id] = (val / totalValue) * charge
    })
  } else if (splitMethod === 'by_volume') {
    // Override (typed for this specific order) takes priority — falls
    // back to product's own default volume. Mirrors backend model logic.
    const getItemVolume = (i) => {
      if (i.volume_cbm_override !== '' && i.volume_cbm_override != null) {
        return parseFloat(i.volume_cbm_override) || 0
      }
      return i.product?.volume_cbm ? parseFloat(i.product.volume_cbm) : 0
    }
    const totalVolume = validItems.reduce((s, i) => s + getItemVolume(i) * (i.quantity_ordered || 0), 0)
    if (totalVolume === 0) return {}
    validItems.forEach(i => {
      allocation[i.id] = ((getItemVolume(i) * (i.quantity_ordered || 0)) / totalVolume) * charge
    })
  }

  return allocation
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { label: status, cls: "bg-gray-100 text-gray-500" }
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
}

// ─── Create Purchase Order Modal ─────────────────────────────────────────────

function CreatePOModal({ suppliers, products, currency, onClose, onCreated }) {
  const [supplier, setSupplier] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [freightCharge, setFreightCharge] = useState('')
  const [freightSplitMethod, setFreightSplitMethod] = useState('by_value')
  const [items, setItems] = useState([{ id: 1, product: null, quantity_ordered: 1, unit_cost: 0, volume_cbm_override: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const sym = SYM[currency] || currency + ' '

  const addItem = () => {
    setItems(prev => [...prev, { id: Date.now(), product: null, quantity_ordered: 1, unit_cost: 0, volume_cbm_override: '' }])
  }
  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id))
  const updateItem = (id, patch) => setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))

  const handleProductSelect = (id, product) => {
    updateItem(id, {
      product,
      // Cost price ko default unit cost bana do — user edit kar sakta hai
      unit_cost: product ? product.cost_price : 0,
      // Product ka default volume suggestion ki tarah bhar do — lekin
      // yeh sirf starting point hai, user isse is order ke liye
      // (supplier ke bataye actual CBM ke hisaab se) edit kar sakta hai
      volume_cbm_override: product?.volume_cbm ? String(product.volume_cbm) : '',
    })
  }

  // CBM total — sirf un items ka jinke product mein volume_cbm set hai
  const totalCbm = items.reduce((sum, i) => {
    if (i.product?.volume_cbm) {
      return sum + (parseFloat(i.product.volume_cbm) * (i.quantity_ordered || 0))
    }
    return sum
  }, 0)

  const totalCost = items.reduce((sum, i) => sum + (i.unit_cost || 0) * (i.quantity_ordered || 0), 0)
  const freightAllocation = calculateFreightAllocation(items, freightCharge, freightSplitMethod)

  const handleSubmit = async () => {
    setError('')
    const validItems = items.filter(i => i.product && i.quantity_ordered > 0)
    if (validItems.length === 0) {
      setError('Add at least one item with a product and quantity.')
      return
    }
    setSaving(true)
    try {
      await inventoryAPI.addPurchaseOrder({
        supplier: supplier || null,
        expected_date: expectedDate || null,
        notes,
        freight_charge: freightCharge || 0,
        freight_split_method: freightSplitMethod,
        items: validItems.map(i => ({
          product: i.product.id,
          quantity_ordered: i.quantity_ordered,
          unit_cost: i.unit_cost,
          volume_cbm_override: i.volume_cbm_override === '' ? null : i.volume_cbm_override,
        })),
      })
      onCreated()
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not create purchase order.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl my-auto">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">New Purchase Order</h3>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Supplier</label>
              <select value={supplier} onChange={e => setSupplier(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="">Select supplier (optional)</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Expected Date</label>
              <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">Items</label>
              <button onClick={addItem} className="text-xs text-blue-600 hover:underline">+ Add item</button>
            </div>
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="flex-1">
                      <ProductSelector products={products} value={item.product?.id || ''}
                        onChange={(p) => handleProductSelect(item.id, p)} currency={currency} />
                    </div>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(item.id)}
                        className="mt-1.5 text-gray-400 hover:text-red-500 transition">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                          strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Quantity</label>
                      <input type="number" min="1" value={item.quantity_ordered}
                        onChange={e => {
                          const val = e.target.value
                          updateItem(item.id, { quantity_ordered: val === '' ? '' : Math.max(1, parseInt(val) || 1) })
                        }}
                        onBlur={() => {
                          if (item.quantity_ordered === '' || !item.quantity_ordered) {
                            updateItem(item.id, { quantity_ordered: 1 })
                          }
                        }}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Unit Cost</label>
                      <input type="number" min="0" step="0.01" value={item.unit_cost}
                        onChange={e => updateItem(item.id, { unit_cost: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">
                        Volume (m³) <span className="text-gray-300">— for this order</span>
                      </label>
                      <input type="number" min="0" step="0.0001" value={item.volume_cbm_override}
                        onChange={e => updateItem(item.id, { volume_cbm_override: e.target.value })}
                        placeholder="0.0000"
                        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    </div>
                  </div>
                  {item.volume_cbm_override && (
                    <p className="mt-1.5 text-[11px] text-gray-400">
                      Total volume: {(parseFloat(item.volume_cbm_override) * item.quantity_ordered).toFixed(4)} m³
                      {item.product?.volume_cbm && parseFloat(item.volume_cbm_override) !== parseFloat(item.product.volume_cbm) && (
                        <span className="text-amber-600"> (overridden from product default {item.product.volume_cbm} m³)</span>
                      )}
                    </p>
                  )}
                  {item.product && freightAllocation[item.id] > 0 && (
                    <p className="mt-1 text-[11px] text-blue-600">
                      + {sym}{freightAllocation[item.id].toFixed(2)} freight → landed cost {sym}
                      {(item.unit_cost + freightAllocation[item.id] / (item.quantity_ordered || 1)).toFixed(2)}/unit
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Freight / Shipping */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-700 mb-2">Freight / Shipping Charges (optional)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Total Freight Cost</label>
                <input type="number" min="0" step="0.01" value={freightCharge}
                  onChange={e => setFreightCharge(e.target.value)} placeholder="0.00"
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Split Method</label>
                <select value={freightSplitMethod} onChange={e => setFreightSplitMethod(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="by_value">By item value</option>
                  <option value="by_quantity">By quantity</option>
                  <option value="by_volume">By volume (CBM)</option>
                  <option value="equal">Equally</option>
                </select>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-gray-400">
              Freight is tracked for reporting only — it does not change product cost price.
              {freightSplitMethod === 'by_volume' && ' Note: items without a Volume set will get ₹0 allocated.'}
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          {/* Totals */}
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Item Cost</p>
              <p className="text-sm font-semibold text-gray-900">{sym}{totalCost.toLocaleString()}</p>
            </div>
            {parseFloat(freightCharge) > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-blue-100">
                <p className="text-xs text-gray-500">+ Freight</p>
                <p className="text-sm font-semibold text-gray-900">{sym}{parseFloat(freightCharge).toLocaleString()}</p>
              </div>
            )}
            {totalCbm > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">Total Volume</p>
                <p className="text-sm font-semibold text-gray-900">{totalCbm.toFixed(4)} m³</p>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50">
            {saving ? "Creating…" : "Create Purchase Order"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [freightSummary, setFreightSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [toast, setToast] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  const currency = 'INR' // Note: not fetched from tenant settings here — matches
  // the currency shown for cost values; acceptable for v1 single-currency use.

  const fetchAll = () => {
    setLoading(true)
    const now = new Date()
    Promise.all([
      inventoryAPI.getPurchaseOrders(),
      inventoryAPI.getSuppliers(),
      inventoryAPI.getProducts(),
      inventoryAPI.getFreightSummary(now.getFullYear(), now.getMonth() + 1),
    ]).then(([poRes, supRes, prodRes, freightRes]) => {
      setOrders(poRes.data)
      setSuppliers(supRes.data)
      setProducts(prodRes.data)
      setFreightSummary(freightRes.data)
    }).catch(() => setToast('Could not load purchase orders.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAll() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleStatusChange = async (id, newStatus) => {
    setActionLoading(id)
    try {
      await inventoryAPI.updatePurchaseOrderStatus(id, newStatus)
      showToast(`Marked as ${newStatus}.`)
      fetchAll()
    } catch (err) {
      showToast(err?.response?.data?.error || 'Could not update status.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this draft purchase order?')) return
    try {
      await inventoryAPI.deletePurchaseOrder(id)
      showToast('Deleted.')
      fetchAll()
    } catch (err) {
      showToast(err?.response?.data?.error || 'Could not delete.')
    }
  }

  const sym = SYM[currency] || currency + ' '

  return (
    <Layout>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Purchase Orders</h2>
          <p className="text-xs text-gray-400 mt-0.5">Track what's ordered from suppliers and on the way</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
          + New Purchase Order
        </button>
      </div>

      {/* Monthly freight summary */}
      {freightSummary && parseFloat(freightSummary.total_freight) > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-700 font-medium">This Month's Freight/Shipping</p>
            <p className="text-lg font-bold text-amber-800">
              {SYM[currency] || currency + ' '}{parseFloat(freightSummary.total_freight).toLocaleString()}
            </p>
          </div>
          <p className="text-xs text-amber-600">
            across {freightSummary.order_count} received order{freightSummary.order_count !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-100" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">No purchase orders yet</p>
          <button onClick={() => setShowCreate(true)} className="mt-2 text-sm text-blue-600 hover:underline">
            Create your first purchase order →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(po => {
            const totalCost = po.items.reduce((sum, i) => sum + parseFloat(i.unit_cost) * i.quantity_ordered, 0)
            const totalCbm = po.items.reduce((sum, i) => sum + (i.volume_cbm ? parseFloat(i.volume_cbm) * i.quantity_ordered : 0), 0)
            return (
              <div key={po.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{po.supplier_name || 'No supplier'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {po.items.length} item{po.items.length !== 1 ? 's' : ''} · Expected {formatDate(po.expected_date)}
                    </p>
                  </div>
                  <StatusBadge status={po.status} />
                </div>

                <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
                  <span>Cost: <span className="font-medium text-gray-800">{sym}{totalCost.toLocaleString()}</span></span>
                  {parseFloat(po.freight_charge) > 0 && (
                    <span>Freight: <span className="font-medium text-amber-700">{sym}{parseFloat(po.freight_charge).toLocaleString()}</span></span>
                  )}
                  {totalCbm > 0 && <span>Volume: <span className="font-medium text-gray-800">{totalCbm.toFixed(4)} m³</span></span>}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {po.items.map(item => (
                    <span key={item.id} className="text-xs bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1 text-gray-600">
                      {item.product_name} × {item.quantity_ordered}
                    </span>
                  ))}
                </div>

                <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                  {po.status === 'draft' && (
                    <>
                      <button onClick={() => handleDelete(po.id)}
                        className="rounded-lg border border-red-100 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition">
                        Delete
                      </button>
                      <button onClick={() => handleStatusChange(po.id, 'ordered')} disabled={actionLoading === po.id}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition disabled:opacity-50">
                        Mark as Ordered
                      </button>
                    </>
                  )}
                  {po.status === 'ordered' && (
                    <>
                      <button onClick={() => handleStatusChange(po.id, 'cancelled')} disabled={actionLoading === po.id}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition disabled:opacity-50">
                        Cancel
                      </button>
                      <button onClick={() => handleStatusChange(po.id, 'received')} disabled={actionLoading === po.id}
                        className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition disabled:opacity-50">
                        {actionLoading === po.id ? "Receiving…" : "✓ Mark as Received"}
                      </button>
                    </>
                  )}
                  {po.status === 'received' && (
                    <span className="text-xs text-gray-400">Received {formatDate(po.received_date)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreatePOModal
          suppliers={suppliers}
          products={products}
          currency={currency}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); showToast('Purchase order created ✓'); fetchAll() }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </Layout>
  )
}