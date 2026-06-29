// InvoiceBuilder — core invoice form component
// mode-aware: 'create' | 'edit' (future)
// Reusable for: Create Invoice, Edit Invoice, Quotation, Purchase Order
// All business logic lives here — pages are thin wrappers

import { useState, useEffect } from "react"
import { billingAPI, inventoryAPI } from "../../services/api"
import LineItemsTable from "./LineItemsTable"
import InvoiceSummaryCard from "./InvoiceSummaryCard"

const todayISO = () => new Date().toISOString().split('T')[0]

const newEmptyItem = () => ({
  id: Date.now() + Math.random(),
  product: null,
  quantity: 1,
  unitPrice: 0,
  costPrice: 0,
  taxRate: 0,
  stockAvailable: 0,
})

export default function InvoiceBuilder({ mode = 'create', initialData = null, onSuccess }) {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [customer, setCustomer] = useState(null)
  const [invoiceDate, setInvoiceDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([newEmptyItem()])

  // ── Data ────────────────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [currency, setCurrency] = useState('INR')
  const [taxLabel, setTaxLabel] = useState('GST')
  const [dataLoading, setDataLoading] = useState(true)

  // ── UI ──────────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(null) // null | 'draft' | 'invoice'
  const [error, setError] = useState('')

  // ── Load customers, products, tenant currency ───────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const [customersRes, productsRes, summaryRes] = await Promise.all([
          billingAPI.getCustomers(),
          inventoryAPI.getProducts(),
          billingAPI.getSummary(),
        ])
        setCustomers(customersRes.data)
        setProducts(productsRes.data.filter((p) => p.is_active !== false))
        setCurrency(summaryRes.data.currency || 'INR')
        setTaxLabel(summaryRes.data.tax_label || 'GST')
      } catch {
        setError('Could not load data. Please refresh the page.')
      } finally {
        setDataLoading(false)
      }
    }
    load()
  }, [])

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = () => {
    if (!customer) return 'Please select a customer.'
    const validItems = items.filter((i) => i.product)
    if (validItems.length === 0) return 'Add at least one product.'
    for (const item of validItems) {
      if (item.quantity < 1) return `Quantity must be at least 1.`
      if (item.quantity > item.stockAvailable) {
        return `"${item.product.name}" has only ${item.stockAvailable} units in stock.`
      }
    }
    return null
  }

  // ── Build API payload ───────────────────────────────────────────────────────

  const buildPayload = () => ({
    customer: customer.id,
    invoice_date: invoiceDate,
    due_date: dueDate || null,
    notes: notes.trim(),
    items: items
      .filter((i) => i.product)
      .map((item) => ({
        product: item.product.id,
        quantity: item.quantity,
        unit_price: item.unitPrice.toFixed(2),
        cost_price: item.costPrice.toFixed(2),
        tax_rate: item.taxRate.toFixed(2),
      })),
  })

  // ── Save as Draft ────────────────────────────────────────────────────────────
  // Backend default status is 'draft' — no extra call needed

  const handleSaveDraft = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setSaving('draft')
    setError('')
    try {
      await billingAPI.createInvoice(buildPayload())
      onSuccess?.()
    } catch (err) {
      const data = err?.response?.data
      setError(
        data?.items || data?.customer || data?.non_field_errors?.[0] ||
        'Failed to save draft. Please check your inputs.'
      )
    } finally {
      setSaving(null)
    }
  }

  // ── Create Invoice (sent status) ─────────────────────────────────────────────

  const handleCreateInvoice = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setSaving('invoice')
    setError('')
    try {
      const res = await billingAPI.createInvoice(buildPayload())
      // Mark as sent (not draft)
      await billingAPI.updateInvoiceStatus(res.data.id, 'sent')
      onSuccess?.()
    } catch (err) {
      const data = err?.response?.data
      setError(
        data?.items || data?.customer || data?.non_field_errors?.[0] ||
        'Failed to create invoice. Please check your inputs.'
      )
    } finally {
      setSaving(null)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-24 rounded-2xl bg-gray-100" />
          <div className="h-20 rounded-2xl bg-gray-100" />
          <div className="h-48 rounded-2xl bg-gray-100" />
        </div>
        <div className="h-64 rounded-2xl bg-gray-100" />
      </div>
    )
  }

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {typeof error === 'object' ? JSON.stringify(error) : error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left — Form ────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Customer */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Customer *
            </label>
            {customers.length === 0 ? (
              <p className="text-sm text-amber-600">
                No customers yet. Please{' '}
                <a href="/customers" className="underline">add a customer</a> first.
              </p>
            ) : (
              <select
                value={customer?.id || ''}
                onChange={(e) =>
                  setCustomer(customers.find((c) => c.id === e.target.value) || null)
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">Select customer…</option>
                {customers.map((c) => (
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
                <label className="block text-xs text-gray-500 mb-1.5">
                  Invoice Date *
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  Due Date (optional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  min={invoiceDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-900 mb-4">Line Items</p>
            {products.length === 0 ? (
              <p className="text-sm text-amber-600">
                No products yet. Please{' '}
                <a href="/products" className="underline">add products</a> first.
              </p>
            ) : (
              <LineItemsTable
                items={items}
                products={products}
                onItemsChange={setItems}
                currency={currency}
              />
            )}
          </div>

          {/* Notes */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <label className="block text-xs text-gray-500 mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, delivery notes, or any message for the customer…"
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        {/* ── Right — Summary card ───────────────────────────────────────────── */}
        <div>
          <InvoiceSummaryCard
            items={items}
            currency={currency}
            taxLabel={taxLabel}
            onSaveDraft={handleSaveDraft}
            onCreateInvoice={handleCreateInvoice}
            saving={saving}
          />
        </div>
      </div>
    </div>
  )
}