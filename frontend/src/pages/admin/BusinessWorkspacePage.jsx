import { useParams, useNavigate } from "react-router-dom"

// Phase 2 mein yahan Business Workspace aayega (Support Mode + full client dashboard)
// Abhi sirf routing taiyaar hai

export default function BusinessWorkspacePage() {
  const { id } = useParams()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white text-center p-8">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
          strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-500"
          aria-hidden="true">
          <path d="M3 21h18" />
          <path d="M5 21V7l8-4v18" />
          <path d="M19 21V11l-6-4" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900">Business Workspace</h2>
      <p className="mt-1 max-w-xs text-sm text-gray-500">
        Founder Support Mode — view and manage this client's complete workspace.
        Coming in Phase 2.
      </p>
      <p className="mt-3 rounded-lg bg-gray-100 px-3 py-1.5 font-mono text-xs text-gray-400">
        Business ID: {id}
      </p>
      <button
        onClick={() => navigate('/admin/businesses')}
        className="mt-5 rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition"
      >
        ← Back to businesses
      </button>
    </div>
  )
}