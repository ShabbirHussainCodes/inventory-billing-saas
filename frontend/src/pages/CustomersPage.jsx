import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { billingAPI } from "../services/api"

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name }) {
  const initials = (name || "?")
    .split(" ").map(w => w[0] || "").slice(0, 2).join("").toUpperCase()
  return (
    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
      {initials}
    </span>
  )
}

// ─── Customer Modal (Add + Edit) ──────────────────────────────────────────────

function CustomerModal({ customer, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    name: customer?.name || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    address: customer?.address || "",
    country: customer?.country || "",
    tax_number: customer?.tax_number || "",
  })
  const [err, setErr] = useState("")

  const handle = e => { setForm(p => ({ ...p, [e.target.name]: e.target.value })); setErr("") }

  const submit = () => {
    if (!form.name.trim()) { setErr("Customer name is required."); return }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p className="text-base font-semibold text-gray-900">
            {customer ? "Edit Customer" : "Add Customer"}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Customer Name *</label>
            <input name="name" value={form.name} onChange={handle}
              placeholder="e.g. Sharma Traders"
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
          <div>
            <label className="block text-xs text-gray-500 mb-1">Address</label>
            <textarea name="address" value={form.address} onChange={handle} rows={2}
              placeholder="Shop no. 5, Main Market, Mumbai"
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
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
            {saving ? "Saving…" : customer ? "Save Changes" : "Add Customer"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ customer, onConfirm, onCancel, loading }) {
  if (!customer) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-base font-semibold text-gray-900">Delete customer?</p>
        <p className="mt-1.5 text-sm text-gray-500">
          "<strong className="text-gray-800">{customer.name}</strong>" will be permanently removed.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message }) {
  if (!message) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
      {message}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-100" />)}
    </div>
  )
}

// ─── Main CustomersPage ────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState("")

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const res = await billingAPI.getCustomers()
      setCustomers(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCustomers() }, [])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 3000) }

  const handleAdd = async (form) => {
    setSaving(true)
    try {
      await billingAPI.addCustomer(form)
      showToast("Customer added ✓")
      fetchCustomers()
      setAddModal(false)
    } catch {
      showToast("Failed to add customer.")
    } finally { setSaving(false) }
  }

  const handleEdit = async (form) => {
    setSaving(true)
    try {
      await billingAPI.updateCustomer(editModal.id, form)
      showToast("Customer updated ✓")
      fetchCustomers()
      setEditModal(null)
    } catch {
      showToast("Failed to update customer.")
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await billingAPI.deleteCustomer(deleteConfirm.id)
      showToast("Customer deleted ✓")
      fetchCustomers()
      setDeleteConfirm(null)
    } catch {
      showToast("Failed to delete customer.")
    } finally { setSaving(false) }
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) || (c.phone || "").includes(q)
  })

  return (
    <Layout>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">Customers</h2>
          <p className="text-xs text-gray-400 mt-0.5">{customers.length} total</p>
        </div>
        <button onClick={() => setAddModal(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
          + Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input type="text" placeholder="Search customers…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
      </div>

      {/* List */}
      {loading ? (
        <Skeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {search ? "No customers match your search" : "No customers yet"}
          </p>
          {!search && (
            <button onClick={() => setAddModal(true)}
              className="mt-2 text-sm text-blue-600 hover:underline">
              Add your first customer →
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {filtered.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition">
              <Avatar name={c.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[c.email, c.phone, c.country].filter(Boolean).join(" · ") || "No contact info"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setEditModal(c)}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition">
                  Edit
                </button>
                <button onClick={() => setDeleteConfirm(c)}
                  className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 transition">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {addModal && <CustomerModal onClose={() => setAddModal(false)} onSave={handleAdd} saving={saving} />}
      {editModal && <CustomerModal customer={editModal} onClose={() => setEditModal(null)} onSave={handleEdit} saving={saving} />}
      <DeleteConfirm customer={deleteConfirm} onConfirm={handleDelete} onCancel={() => setDeleteConfirm(null)} loading={saving} />
      <Toast message={toast} />
    </Layout>
  )
}