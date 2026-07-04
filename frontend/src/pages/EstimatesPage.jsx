import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { billingAPI, inventoryAPI } from "../services/api"
import ProductSelector from "../components/invoice/ProductSelector"

const SYM = { INR: '₹', USD: '$', AED: 'AED ', GBP: '£', EUR: '€' }

function formatDate(dateStr) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

const STATUS_CFG = {
  draft:     { label: "Draft",     cls: "bg-gray-100 text-gray-600" },
  sent:      { label: "Sent",      cls: "bg-blue-50 text-blue-600" },
  accepted:  { label: "Accepted",  cls: "bg-green-50 text-green-700" },
  rejected:  { label: "Rejected",  cls: "bg-red-50 text-red-600" },
  converted: { label: "Converted", cls: "bg-purple-50 text-purple-700" },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { label: status, cls: "bg-gray-100 text-gray-500" }
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
}

// ─── Create Estimate Modal ────────────────────────────────────────────────

function CreateEstimateModal({ customers, products, currency, onClose, onCreated }) {
  const [customer, setCustomer] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ id: 1, product: null, quantity: 1, unit_price: 0 }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const sym = SYM[currency] || currency + ' '

  const addItem = () => setItems(prev => [...prev, { id: Date.now(), product: null, quantity: 1, unit_price: 0 }])
  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id))
  const updateItem = (id, patch) => setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))

  const handleProductSelect = (id, product) => {
    updateItem(id, { product, unit_price: product ? product.selling_price : 0 })
  }

  const totalAmount = items.reduce((sum, i) => sum + (i.unit_price || 0) * (i.quantity || 0), 0)

  const handleSubmit = async () => {
    setError('')
    if (!customer) {
      setError('Select a customer.')
      return
    }
    const validItems = items.filter(i => i.product && i.quantity > 0)
    if (validItems.length === 0) {
      setError('Add at least one item.')
      return
    }
    setSaving(true)
    try {
      await billingAPI.addEstimate({
        customer,
        estimate_date: new Date().toISOString().slice(0, 10),
        valid_until: validUntil || null,
        notes,
        items: validItems.map(i => ({
          product: i.product.id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      })
      onCreated()
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not create estimate.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl my-auto">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">New Estimate</h3>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Customer</label>
              <select value={customer} onChange={e => setCustomer(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="">Select customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Valid Until (optional)</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
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
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Quantity</label>
                      <input type="number" min="1" value={item.quantity}
                        onChange={e => {
                          const val = e.target.value
                          updateItem(item.id, { quantity: val === '' ? '' : Math.max(1, parseInt(val) || 1) })
                        }}
                        onBlur={() => { if (!item.quantity) updateItem(item.id, { quantity: 1 }) }}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Unit Price</label>
                      <input type="number" min="0" step="0.01" value={item.unit_price}
                        onChange={e => updateItem(item.id, { unit_price: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">Estimated Total (before tax)</p>
            <p className="text-sm font-semibold text-gray-900">{sym}{totalAmount.toLocaleString()}</p>
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
            {saving ? "Creating…" : "Create Estimate"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [toast, setToast] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  const currency = 'INR' // Matches existing convention (Products/Purchase Orders
  // pages also hardcode this — see honest note from Purchase Orders session).

  const fetchAll = () => {
    setLoading(true)
    Promise.all([
      billingAPI.getEstimates(),
      billingAPI.getCustomers(),
      inventoryAPI.getProducts(),
    ]).then(([estRes, custRes, prodRes]) => {
      setEstimates(estRes.data)
      setCustomers(custRes.data)
      setProducts(prodRes.data)
    }).catch(() => setToast('Could not load estimates.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAll() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleStatusChange = async (id, newStatus) => {
    setActionLoading(id)
    try {
      await billingAPI.updateEstimateStatus(id, newStatus)
      showToast(`Marked as ${newStatus}.`)
      fetchAll()
    } catch (err) {
      showToast(err?.response?.data?.error || 'Could not update status.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleConvert = async (id) => {
    setActionLoading(id)
    try {
      await billingAPI.convertEstimateToInvoice(id)
      showToast('Converted to invoice ✓')
      fetchAll()
    } catch (err) {
      showToast(err?.response?.data?.error || 'Could not convert — check product stock.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this draft estimate?')) return
    try {
      await billingAPI.deleteEstimate(id)
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
          <h2 className="text-base font-semibold text-gray-900">Estimates</h2>
          <p className="text-xs text-gray-400 mt-0.5">Send quotes before they become invoices</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
          + New Estimate
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-100" />)}
        </div>
      ) : estimates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">No estimates yet</p>
          <button onClick={() => setShowCreate(true)} className="mt-2 text-sm text-blue-600 hover:underline">
            Create your first estimate →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {estimates.map(est => (
            <div key={est.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-mono font-medium text-gray-900">{est.estimate_number}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{est.customer_name}</p>
                </div>
                <StatusBadge status={est.status} />
              </div>

              <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
                <span>Total: <span className="font-medium text-gray-800">{sym}{parseFloat(est.total_amount).toLocaleString()}</span></span>
                {est.valid_until && <span>Valid until {formatDate(est.valid_until)}</span>}
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {est.items.map(item => (
                  <span key={item.id} className="text-xs bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1 text-gray-600">
                    {item.product_name} × {item.quantity}
                  </span>
                ))}
              </div>

              <div className="flex justify-end items-center gap-2 pt-3 border-t border-gray-100">
                {est.status === 'draft' && (
                  <>
                    <button onClick={() => handleDelete(est.id)}
                      className="rounded-lg border border-red-100 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition">
                      Delete
                    </button>
                    <button onClick={() => handleStatusChange(est.id, 'sent')} disabled={actionLoading === est.id}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition disabled:opacity-50">
                      Mark as Sent
                    </button>
                  </>
                )}
                {est.status === 'sent' && (
                  <>
                    <button onClick={() => handleStatusChange(est.id, 'rejected')} disabled={actionLoading === est.id}
                      className="text-xs text-gray-400 hover:text-red-500 transition px-2">
                      Reject
                    </button>
                    <button onClick={() => handleStatusChange(est.id, 'accepted')} disabled={actionLoading === est.id}
                      className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition disabled:opacity-50">
                      ✓ Mark as Accepted
                    </button>
                  </>
                )}
                {est.status === 'accepted' && (
                  <>
                    <button onClick={() => handleStatusChange(est.id, 'rejected')} disabled={actionLoading === est.id}
                      className="text-xs text-gray-400 hover:text-red-500 transition px-2">
                      Reject instead
                    </button>
                    <button onClick={() => handleConvert(est.id)} disabled={actionLoading === est.id}
                      className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-purple-700 transition disabled:opacity-50">
                      {actionLoading === est.id ? "Converting…" : "→ Convert to Invoice"}
                    </button>
                  </>
                )}
                {est.status === 'rejected' && (
                  <span className="text-xs text-gray-400">Rejected by customer</span>
                )}
                {est.status === 'converted' && (
                  <span className="text-xs text-purple-600">Converted to invoice ✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateEstimateModal
          customers={customers}
          products={products}
          currency={currency}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); showToast('Estimate created ✓'); fetchAll() }}
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