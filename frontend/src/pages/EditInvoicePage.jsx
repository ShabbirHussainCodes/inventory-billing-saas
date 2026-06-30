// EditInvoicePage — fetches the draft invoice, then reuses InvoiceBuilder
// Only draft invoices can be edited (enforced both frontend and backend)

import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import Layout from "../components/Layout"
import InvoiceBuilder from "../components/invoice/InvoiceBuilder"
import { billingAPI } from "../services/api"

export default function EditInvoicePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    billingAPI.getInvoiceDetail(id)
      .then(res => {
        if (res.data.status !== 'draft') {
          setError('Only draft invoices can be edited.')
        } else {
          setInvoice(res.data)
        }
      })
      .catch(() => setError('Could not load invoice.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-gray-100" />
          <div className="h-64 rounded-2xl bg-gray-100" />
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button onClick={() => navigate('/invoices')}
            className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50">
            ← Back to Invoices
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate('/invoices')}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition">
          ← Back
        </button>
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Edit Invoice {invoice.invoice_number}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Update the details below and save your changes
          </p>
        </div>
      </div>

      <InvoiceBuilder
        mode="edit"
        initialData={invoice}
        onSuccess={() => navigate('/invoices')}
      />
    </Layout>
  )
}