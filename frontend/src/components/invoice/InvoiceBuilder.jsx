// InvoiceBuilder — core invoice form, mode-aware, reusable
// Includes inline Quick-Add modals for Customer and Product
// No page navigation required for common actions

import { useState, useEffect } from "react"
import { billingAPI, inventoryAPI, isPlanLimitError, getPlanLimitMessage } from "../../services/api"
import LineItemsTable, { newItem, calcLine } from "./LineItemsTable"
import InvoiceSummaryCard from "./InvoiceSummaryCard"

const todayISO = () => new Date().toISOString().split('T')[0]

// Extract readable error from any DRF response format
function extractError(err, fallback) {
  const d = err?.response?.data
  if (!d) return fallback
  // Array of item errors e.g. [{"product_name": ["..."]}]
  if (Array.isArray(d)) {
    const msgs = d.map(item =>
      typeof item === 'object'
        ? Object.entries(item).map(([k,v]) => `${k}: ${Array.isArray(v)?v.join(', '):v}`).join('; ')
        : String(item)
    ).filter(Boolean)
    return msgs.join(' | ') || fallback
  }
  // Object errors
  if (typeof d === 'object') {
    if (d.error) return d.error
    if (d.detail) return d.detail
    if (d.items) {
      const itemErr = Array.isArray(d.items) ? d.items[0] : d.items
      if (typeof itemErr === 'object') return Object.values(itemErr).flat().join(', ')
      return String(itemErr)
    }
    const first = Object.entries(d)[0]
    if (first) return `${first[0]}: ${Array.isArray(first[1])?first[1].join(', '):first[1]}`
  }
  return fallback
}

// ─── Quick Add Customer Modal ─────────────────────────────────────────────────

function QuickAddCustomerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name:'', email:'', phone:'', country:'', tax_number:'', address:'' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handle = e => { setForm(p=>({...p,[e.target.name]:e.target.value})); setErr('') }

  const submit = async () => {
    if (!form.name.trim()) { setErr('Customer name required.'); return }
    setSaving(true)
    try {
      const res = await billingAPI.addCustomer(form)
      onCreated(res.data)
    } catch {
      setErr('Failed to create customer. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p className="text-base font-semibold text-gray-900">Add Customer</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name *</label>
            <input name="name" value={form.name} onChange={handle}
              placeholder="Sharma Traders"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input name="email" type="email" value={form.email} onChange={handle}
                placeholder="raj@sharma.in"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input name="phone" value={form.phone} onChange={handle}
                placeholder="+91 98765 43210"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Country</label>
              <input name="country" value={form.country} onChange={handle}
                placeholder="India"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">GST / Tax No.</label>
              <input name="tax_number" value={form.tax_number} onChange={handle}
                placeholder="27AAPFU0939F1ZV"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Creating…' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Quick Add Product Modal ──────────────────────────────────────────────────

function QuickAddProductModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name:'', sku:'', cost_price:'', selling_price:'',
    stock_quantity:0, reorder_point:10, tax_rate:0
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handle = e => { setForm(p=>({...p,[e.target.name]:e.target.value})); setErr('') }

  const submit = async () => {
    if (!form.name.trim() || !form.sku.trim() || !form.cost_price || !form.selling_price) {
      setErr('Name, SKU, Cost Price and Selling Price are required.'); return
    }
    setSaving(true)
    try {
      const res = await inventoryAPI.addProduct(form)
      onCreated(res.data)
    } catch {
      setErr('Failed to create product. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p className="text-base font-semibold text-gray-900">Add Product</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Product Name *</label>
              <input name="name" value={form.name} onChange={handle}
                placeholder="e.g. Rice 1kg"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">SKU *</label>
              <input name="sku" value={form.sku} onChange={handle}
                placeholder="RICE-001"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cost Price *</label>
              <input name="cost_price" type="number" step="0.01" value={form.cost_price} onChange={handle}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Selling Price *</label>
              <input name="selling_price" type="number" step="0.01" value={form.selling_price} onChange={handle}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Stock</label>
              <input name="stock_quantity" type="number" value={form.stock_quantity} onChange={handle}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reorder At</label>
              <input name="reorder_point" type="number" value={form.reorder_point} onChange={handle}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tax %</label>
              <input name="tax_rate" type="number" step="0.01" value={form.tax_rate} onChange={handle}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Creating…' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main InvoiceBuilder ──────────────────────────────────────────────────────

export default function InvoiceBuilder({ mode='create', initialData=null, onSuccess }) {
  // Form state
  const [customer, setCustomer]       = useState(null)
  const [invoiceDate, setInvoiceDate] = useState(todayISO())
  const [dueDate, setDueDate]         = useState('')
  const [notes, setNotes]             = useState('')
  const [items, setItems]             = useState([newItem()])

  // Data
  const [customers, setCustomers] = useState([])
  const [products, setProducts]   = useState([])
  const [currency, setCurrency]   = useState('INR')
  const [taxLabel, setTaxLabel]   = useState('GST')
  const [dataLoading, setDataLoading] = useState(true)

  // Modals
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [showAddProduct, setShowAddProduct]   = useState(false)

  // UI
  const [saving, setSaving] = useState(null)
  const [error, setError]   = useState('')

  // Load data — and pre-fill form if editing
  useEffect(() => {
    Promise.all([
      billingAPI.getCustomers(),
      inventoryAPI.getProducts(),
      billingAPI.getSummary(),
    ]).then(([cr, pr, sr]) => {
      setCustomers(cr.data)
      setProducts(pr.data)
      setCurrency(sr.data.currency || 'INR')
      setTaxLabel(sr.data.tax_label || 'GST')

      // Edit mode — pre-fill everything from initialData
      if (mode === 'edit' && initialData) {
        const matchedCustomer = cr.data.find(c => c.id === initialData.customer)
        setCustomer(matchedCustomer || null)
        setInvoiceDate(initialData.invoice_date || todayISO())
        setDueDate(initialData.due_date || '')
        setNotes(initialData.notes || '')

        const prefilledItems = (initialData.items || []).map(it => {
          const product = pr.data.find(p => p.id === it.product)
          // Stock available = current stock + jo isi invoice ne already allocate kiya tha
          const stockAvailable = product ? product.stock_quantity + it.quantity : 0
          return {
            id: it.id || Date.now() + Math.random(),
            product,
            quantity: it.quantity,
            unitPrice: parseFloat(it.unit_price),
            costPrice: parseFloat(it.cost_price),
            taxRate: parseFloat(it.tax_rate),
            stockAvailable,
            discountType: 'percent',
            discountValue: 0,
          }
        })
        setItems(prefilledItems.length > 0 ? prefilledItems : [newItem()])
      }
    }).catch(() => setError('Could not load data. Please refresh.'))
    .finally(() => setDataLoading(false))
  }, [])

  // Validate
  const validate = () => {
    if (!customer) return 'Please select a customer.'
    const valid = items.filter(i => i.product)
    if (valid.length === 0) return 'Add at least one product.'
    for (const item of valid) {
      if (item.quantity < 1) return 'Quantity must be at least 1.'
      if (item.quantity > item.stockAvailable) {
        return `"${item.product.name}" has only ${item.stockAvailable} in stock.`
      }
    }
    return null
  }

  // Build payload — discount baked into effective unit_price, but the
  // discount amount itself is ALSO sent separately now (discount_amount)
  // so it's not silently lost — future analytics/fraud-detection needs
  // to know how much discount was actually given, not just the net price.
  const buildPayload = (status = 'draft') => ({
    customer: customer.id,
    invoice_date: invoiceDate,
    due_date: dueDate || null,
    status,             // Set status directly — no separate PATCH needed
    notes: notes.trim(),
    items: items
      .filter(i => i.product)
      .map(item => {
        const { effectiveUnitPrice, discountAmount } = calcLine(item)
        return {
          product: item.product.id,
          quantity: item.quantity,
          unit_price: effectiveUnitPrice.toFixed(2),
          cost_price: item.costPrice.toFixed(2),
          tax_rate: item.taxRate.toFixed(2),
          discount_amount: discountAmount.toFixed(2),
        }
      })
  })

  const handleSaveDraft = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setSaving('draft'); setError('')
    try {
      if (mode === 'edit') {
        await billingAPI.updateInvoice(initialData.id, buildPayload('draft'))
      } else {
        await billingAPI.createInvoice(buildPayload('draft'))
      }
      onSuccess?.()
    } catch(err) {
      if (isPlanLimitError(err)) setError(getPlanLimitMessage(err))
      else setError(extractError(err, 'Failed to save draft.'))
    } finally { setSaving(null) }
  }

  const handleCreateInvoice = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setSaving('invoice'); setError('')
    try {
      if (mode === 'edit') {
        await billingAPI.updateInvoice(initialData.id, buildPayload('sent'))
      } else {
        await billingAPI.createInvoice(buildPayload('sent'))
      }
      onSuccess?.()
    } catch(err) {
      if (isPlanLimitError(err)) setError(getPlanLimitMessage(err))
      else setError(extractError(err, 'Failed to create invoice.'))
    } finally { setSaving(null) }
  }

  // Quick-add customer → auto-select
  const handleCustomerCreated = (newCustomer) => {
    setCustomers(prev => [...prev, newCustomer])
    setCustomer(newCustomer)
    setShowAddCustomer(false)
  }

  // Quick-add product → add to list
  const handleProductCreated = (newProduct) => {
    setProducts(prev => [...prev, newProduct])
    setShowAddProduct(false)
  }

  if (dataLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-pulse">
        <div className="lg:col-span-2 space-y-4">
          {[80,64,160,56].map((h,i) => <div key={i} className={`h-${h} rounded-2xl bg-gray-100`} style={{height:h}} />)}
        </div>
        <div className="h-64 rounded-2xl bg-gray-100" />
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left: Form ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Customer */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-900">Bill To *</label>
              <button type="button" onClick={() => setShowAddCustomer(true)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                New customer
              </button>
            </div>

            {customers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-500 mb-2">No customers yet</p>
                <button type="button" onClick={() => setShowAddCustomer(true)}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition">
                  + Add your first customer
                </button>
              </div>
            ) : (
              <select
                value={customer?.id || ''}
                onChange={e => setCustomer(customers.find(c => c.id === e.target.value) || null)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="">Select customer…</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.email ? ` — ${c.email}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Dates */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Invoice Date *</label>
                <input type="date" value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Due Date (optional)</label>
                <input type="date" value={dueDate} min={invoiceDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-900 mb-4">Items</p>
            {products.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-500 mb-2">No products in inventory</p>
                <button type="button" onClick={() => setShowAddProduct(true)}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition">
                  + Add your first product
                </button>
              </div>
            ) : (
              <LineItemsTable
                items={items}
                products={products}
                onItemsChange={setItems}
                currency={currency}
                onAddNewProduct={() => setShowAddProduct(true)}
              />
            )}
          </div>

          {/* Notes */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <label className="block text-xs text-gray-500 mb-1.5">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Payment terms, delivery notes, or any message for the customer…"
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
        </div>

        {/* ── Right: Summary ─────────────────────────────────────────────── */}
        <div>
          <InvoiceSummaryCard
            items={items}
            currency={currency}
            taxLabel={taxLabel}
            onSaveDraft={handleSaveDraft}
            onCreateInvoice={handleCreateInvoice}
            saving={saving}
            draftLabel={mode === 'edit' ? 'Save Changes' : 'Save as Draft'}
            submitLabel={mode === 'edit' ? 'Update & Send' : 'Create Invoice'}
          />
        </div>
      </div>

      {/* Inline modals */}
      {showAddCustomer && (
        <QuickAddCustomerModal
          onClose={() => setShowAddCustomer(false)}
          onCreated={handleCustomerCreated}
        />
      )}
      {showAddProduct && (
        <QuickAddProductModal
          onClose={() => setShowAddProduct(false)}
          onCreated={handleProductCreated}
        />
      )}
    </>
  )
}