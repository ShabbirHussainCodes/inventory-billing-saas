// CreateInvoicePage — thin wrapper
// All logic is in InvoiceBuilder — this page just provides context + navigation

import { useNavigate } from "react-router-dom"
import Layout from "../components/Layout"
import InvoiceBuilder from "../components/invoice/InvoiceBuilder"

export default function CreateInvoicePage() {
  const navigate = useNavigate()

  return (
    <Layout>
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate('/invoices')}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          ← Back
        </button>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Create Invoice</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Fill in the details below to generate an invoice
          </p>
        </div>
      </div>

      <InvoiceBuilder
        mode="create"
        onSuccess={() => navigate('/invoices')}
      />
    </Layout>
  )
}