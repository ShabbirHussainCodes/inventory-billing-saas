import { useState, useEffect } from "react"
import { billingAPI } from "../../services/api"

// ─── Customer Form Modal (Add + Edit) ────────────────────────────────────────

function CustomerModal({ customer, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    name: customer?.name || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    address: customer?.address || "",
    country: customer?.country || "",
    tax_number: customer?.tax_number || "",
  })
  const [err, setErr] = useState("")

  const handle = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))
    setErr("")
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setErr("Customer name required hai.")
      return
    }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          {customer ? "Edit Customer" : "Add Customer"}
        </h3>

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Customer Name *</label>
            <input name="name" value={form.name} onChange={handle}
              placeholder="e.g. Sharma Traders"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          {/* Email + Phone */}
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

          {/* Country + Tax Number */}
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

          {/* Address */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Address</label>
            <textarea name="address" value={form.address} onChange={handle}
              placeholder="Shop no. 5, Main Market, Mumbai"
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
          </div>
        </div>

        {err && <p className="mt-2 text-xs text-red-500">{err}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Saving…" : customer ? "Save Changes" : "Add Customer"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirmation ──────────────────────────────────────────────────────

function DeleteConfirm({ customer, onConfirm, onCancel, loading }) {
  if (!customer) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">Delete customer?</h3>
        <p className="mt-1.5 text-sm text-gray-500">
          "<strong className="text-gray-800">{customer.name}</strong>" client ke
          customer list se hata diya jaayega.
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

// ─── Initials avatar ──────────────────────────────────────────────────────────

function Avatar({ name }) {
  const initials = name
    .split(" ")
    .map((w) => w[0] || "")
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return (
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
      {initials}
    </span>
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

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CustomersSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-gray-100" />
      ))}
    </div>
  )
}

// ─── Main WorkspaceCustomers ──────────────────────────────────────────────────

export default function WorkspaceCustomers({ isEditMode }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [toast, setToast] = useState("")

  const fetchCustomers = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await billingAPI.getCustomers()
      setCustomers(res.data)
    } catch (err) {
      setError(err?.response?.data?.error || "Could not load customers.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCustomers() }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  // ── CRUD ──
  const handleAdd = async (form) => {
    setFormLoading(true)
    try {
      await billingAPI.addCustomer(form)
      showToast("Customer added ✓")
      fetchCustomers()
      setAddModal(false)
    } catch {
      showToast("Failed to add customer.")
    } finally {
      setFormLoading(false)
    }
  }

  const handleEdit = async (form) => {
    setFormLoading(true)
    try {
      await billingAPI.updateCustomer(editModal.id, form)
      showToast("Customer updated ✓")
      fetchCustomers()
      setEditModal(null)
    } catch {
      showToast("Failed to update customer.")
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async () => {
    setFormLoading(true)
    try {
      await billingAPI.deleteCustomer(deleteConfirm.id)
      showToast("Customer deleted ✓")
      fetchCustomers()
      setDeleteConfirm(null)
    } catch {
      showToast("Failed to delete customer.")
    } finally {
      setFormLoading(false)
    }
  }

  // Client-side search
  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return (
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.country || "").toLowerCase().includes(q)
    )
  })

  if (loading) return <CustomersSkeleton />

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-600 mb-1">Failed to load customers</p>
        <p className="text-xs text-red-400 mb-3">{error}</p>
        <button onClick={fetchCustomers}
          className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50">
          Try again
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Customers</h2>
          <p className="text-xs text-gray-400 mt-0.5">{customers.length} customers</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search customers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Add button — sirf Edit Mode mein */}
          {isEditMode && (
            <button
              onClick={() => setAddModal(true)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              + Add Customer
            </button>
          )}
        </div>
      </div>

      {/* View mode notice */}
      {!isEditMode && (
        <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-700">
            👁 View Only — Switch to Edit Mode to add, edit, or delete customers
          </p>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400">
              <th className="px-4 py-3 text-left font-medium">Customer</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Country</th>
              <th className="px-4 py-3 text-left font-medium">GST / Tax No.</th>
              {isEditMode && (
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={isEditMode ? 5 : 4}
                  className="py-12 text-center text-sm text-gray-400">
                  {search
                    ? "No customers match your search."
                    : "No customers added yet."}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60 transition">
                  {/* Customer name + email */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} />
                      <div>
                        <p className="font-medium text-gray-900">{c.name}</p>
                        {c.email && (
                          <p className="text-xs text-gray-400 mt-0.5">{c.email}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="px-4 py-3.5 text-sm text-gray-600">
                    {c.phone || <span className="text-gray-300">—</span>}
                  </td>

                  {/* Country */}
                  <td className="px-4 py-3.5 text-sm text-gray-600">
                    {c.country || <span className="text-gray-300">—</span>}
                  </td>

                  {/* Tax number */}
                  <td className="px-4 py-3.5 font-mono text-xs text-gray-500">
                    {c.tax_number || <span className="text-gray-300 font-sans">—</span>}
                  </td>

                  {/* Actions — sirf Edit Mode mein */}
                  {isEditMode && (
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditModal(c)}
                          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(c)}
                          className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {addModal && (
        <CustomerModal
          onClose={() => setAddModal(false)}
          onSave={handleAdd}
          loading={formLoading}
        />
      )}
      {editModal && (
        <CustomerModal
          customer={editModal}
          onClose={() => setEditModal(null)}
          onSave={handleEdit}
          loading={formLoading}
        />
      )}
      <DeleteConfirm
        customer={deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        loading={formLoading}
      />

      <Toast message={toast} />
    </>
  )
}