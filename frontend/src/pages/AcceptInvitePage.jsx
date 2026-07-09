import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { teamAPI } from "../services/api"

// Login ke finishLogin() jaisa hi — accept-invite se bhi same shape ke
// tokens+user milte hain, isliye same pattern reuse kiya
function finishLogin(navigate, tokens, user) {
  localStorage.setItem("access_token", tokens.access)
  localStorage.setItem("refresh_token", tokens.refresh)
  localStorage.setItem("user", JSON.stringify(user))
  navigate("/dashboard")
}

export default function AcceptInvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [checking, setChecking] = useState(true)
  const [invite, setInvite] = useState(null) // { business_name, role_name, email, account_exists }
  const [loadError, setLoadError] = useState("")

  const [form, setForm] = useState({ first_name: "", last_name: "", password: "" })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  useEffect(() => {
    let cancelled = false
    teamAPI.getInviteDetail(token).then(res => {
      if (cancelled) return
      if (res.data.valid) {
        setInvite(res.data)
      } else {
        setLoadError(res.data.error || "This invite link is invalid or has expired.")
      }
    }).catch(() => {
      if (!cancelled) setLoadError("This invite link is invalid or has expired.")
    }).finally(() => {
      if (!cancelled) setChecking(false)
    })
    return () => { cancelled = true }
  }, [token])

  const handleChange = e => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
    setSubmitError("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError("")

    if (!form.password) { setSubmitError("Password is required."); return }
    if (!invite.account_exists) {
      if (!form.first_name.trim() || !form.last_name.trim()) {
        setSubmitError("First name and last name are required.")
        return
      }
      if (form.password.length < 8) {
        setSubmitError("Password must be at least 8 characters long.")
        return
      }
    }

    setSubmitting(true)
    try {
      const payload = invite.account_exists
        ? { password: form.password }
        : { first_name: form.first_name.trim(), last_name: form.last_name.trim(), password: form.password }
      const res = await teamAPI.acceptInvite(token, payload)
      const { tokens, user } = res.data
      finishLogin(navigate, tokens, user)
    } catch (err) {
      const status = err?.response?.status
      const msg = err?.response?.data?.error
      if (status === 401) {
        setSubmitError("Incorrect password for this account.")
      } else if (status === 429) {
        setSubmitError("Too many attempts. Please wait a minute and try again.")
      } else {
        setSubmitError(msg || "Something went wrong. Please try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Checking invite…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invite not available</h1>
          <p className="text-sm text-gray-500 mb-6">{loadError}</p>
          <a href="/" className="text-sm text-blue-600 hover:underline">Go to login →</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-600">BillingMars</h1>
          <p className="text-gray-700 mt-3 font-medium">
            Join {invite.business_name}
          </p>
          <p className="text-gray-500 mt-1 text-sm">
            as <strong>{invite.role_name}</strong> · {invite.email}
          </p>
        </div>

        {invite.account_exists && (
          <div className="bg-blue-50 text-blue-700 p-3 rounded-lg mb-4 text-sm">
            You already have a BillingMars account with this email. Enter your password to join.
          </div>
        )}

        {submitError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!invite.account_exists && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input name="first_name" value={form.first_name} onChange={handleChange} required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input name="last_name" value={form.last_name} onChange={handleChange} required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {invite.account_exists ? "Password" : "Choose a password"}
            </label>
            <input type="password" name="password" value={form.password} onChange={handleChange}
              placeholder="••••••••" required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <button type="submit" disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50">
            {submitting ? "Joining…" : invite.account_exists ? "Log in & Join" : "Create account & Join"}
          </button>
        </form>
      </div>
    </div>
  )
}
