import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { billingAPI } from "../services/api"

const SYM = { INR: '₹', USD: '$', AED: 'AED ', GBP: '£', EUR: '€' }

const CATEGORY_OPTIONS = [
  { value: 'rent', label: 'Rent' },
  { value: 'salary', label: 'Salary' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
]

const PAYMENT_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
]

function formatDate(dateStr) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function fmt(amount, currency) {
  const sym = SYM[currency] || currency + ' '
  return `${sym}${parseFloat(amount).toLocaleString()}`
}

// ─── Add Expense Modal ────────────────────────────────────────────────────

function AddExpenseModal({ onClose, onCreated }) {
  const [category, setCategory] = useState('other')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) { setError('Title is required.'); return }
    if (!amount || parseFloat(amount) <= 0) { setError('Enter a valid amount.'); return }

    setSaving(true)
    try {
      await billingAPI.addExpense({
        category, title: title.trim(), amount: parseFloat(amount),
        expense_date: expenseDate, payment_method: paymentMethod, notes,
      })
      onCreated()
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not save expense.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">Add Expense</h3>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Office Rent — July"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Payment Method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                {PAYMENT_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
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
            {saving ? "Saving…" : "Add Expense"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState('')

  const fetchAll = () => {
    setLoading(true)
    const now = new Date()
    Promise.all([
      billingAPI.getExpenses(),
      billingAPI.getExpenseSummary(now.getFullYear(), now.getMonth() + 1),
    ]).then(([expRes, sumRes]) => {
      setExpenses(expRes.data)
      setSummary(sumRes.data)
    }).catch(() => setToast('Could not load expenses.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAll() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return
    try {
      await billingAPI.deleteExpense(id)
      showToast('Deleted.')
      fetchAll()
    } catch {
      showToast('Could not delete.')
    }
  }

  const currency = summary?.currency || 'INR'

  return (
    <Layout>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Expenses</h2>
          <p className="text-xs text-gray-400 mt-0.5">Track rent, salary, utilities and other business costs</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
          + Add Expense
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-24 rounded-2xl bg-gray-100" />
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-gray-100" />)}
        </div>
      ) : (
        <div className="space-y-4">

          {/* This month summary */}
          {summary && parseFloat(summary.total) > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs text-gray-400 mb-1">This Month's Expenses</p>
              <p className="text-2xl font-bold text-gray-900 mb-3">{fmt(summary.total, currency)}</p>
              <div className="flex flex-wrap gap-2">
                {summary.by_category.map(c => (
                  <span key={c.category} className="text-xs bg-gray-50 border border-gray-100 rounded-full px-3 py-1 text-gray-600">
                    {c.category_label}: <span className="font-medium text-gray-800">{fmt(c.total, currency)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Expense list */}
          {expenses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
              <p className="text-sm font-medium text-gray-900 mb-1">No expenses recorded yet</p>
              <button onClick={() => setShowAdd(true)} className="mt-2 text-sm text-blue-600 hover:underline">
                Add your first expense →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map(exp => (
                <div key={exp.id} className="rounded-2xl border border-gray-200 bg-white p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-gray-900 truncate">{exp.title}</p>
                      <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 flex-shrink-0">
                        {exp.category_label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {formatDate(exp.expense_date)}
                      {exp.payment_method && ` · ${exp.payment_method.toUpperCase()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <p className="text-sm font-semibold text-gray-900">{fmt(exp.amount, currency)}</p>
                    <button onClick={() => handleDelete(exp.id)}
                      className="text-gray-300 hover:text-red-500 transition">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                        strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <AddExpenseModal
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); showToast('Expense added ✓'); fetchAll() }}
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