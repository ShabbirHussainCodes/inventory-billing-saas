import { useState, useEffect } from "react"
import { superAdminAPI } from "../../services/api"
import StatCard from "../../components/admin/StatCard"
import NeedsAttention from "../../components/admin/NeedsAttention"
import SignupTrend from "../../components/admin/SignupTrend"
import ActivityFeed from "../../components/admin/ActivityFeed"

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 animate-pulse">
      <div className="h-3.5 w-24 rounded bg-gray-100 mb-3" />
      <div className="h-7 w-16 rounded bg-gray-100" />
    </div>
  )
}

function SkeletonBlock({ h = "h-40" }) {
  return <div className={`rounded-2xl border border-gray-200 bg-white ${h} animate-pulse`} />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2"><SkeletonBlock h="h-44" /></div>
        <SkeletonBlock h="h-44" />
      </div>
      <SkeletonBlock h="h-64" />
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] rounded-2xl border border-red-100 bg-red-50 text-center p-8">
      <p className="text-sm font-medium text-red-600 mb-1">Failed to load dashboard</p>
      <p className="text-xs text-red-400 mb-4">{message}</p>
      <button onClick={onRetry}
        className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 transition">
        Try again
      </button>
    </div>
  )
}

// MRR breakdown tooltip card
function MRRCard({ stats }) {
  const mrr = stats.estimated_mrr || 0
  const breakdown = stats.mrr_breakdown || {}
  const hasRevenue = mrr > 0

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Estimated MRR</p>
          <p className={`text-2xl font-bold ${hasRevenue ? 'text-gray-900' : 'text-gray-300'}`}>
            {hasRevenue ? `₹${mrr.toLocaleString()}` : '₹0'}
          </p>
        </div>
        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 font-medium">
          Estimated
        </span>
      </div>

      {/* Breakdown */}
      <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
        {breakdown.pro_count > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">{breakdown.pro_count} × Pro (₹{breakdown.pro_price})</span>
            <span className="text-gray-700 font-medium">₹{(breakdown.pro_count * breakdown.pro_price).toLocaleString()}</span>
          </div>
        )}
        {breakdown.enterprise_count > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">{breakdown.enterprise_count} × Enterprise (₹{breakdown.enterprise_price})</span>
            <span className="text-gray-700 font-medium">₹{(breakdown.enterprise_count * breakdown.enterprise_price).toLocaleString()}</span>
          </div>
        )}
        {!hasRevenue && (
          <p className="text-[11px] text-gray-400">No paid plans yet — upgrade clients to Pro/Enterprise</p>
        )}
      </div>
    </div>
  )
}

// Plan breakdown card
function PlanMixCard({ stats }) {
  const counts = stats.plan_counts || {
    free: stats.free_tenants || 0,
    pro: 0,
    enterprise: 0,
    admin_grant: stats.admin_grant_tenants || 0,
  }

  const plans = [
    { key: 'free',        label: 'Free',       color: 'bg-gray-200',   text: 'text-gray-600' },
    { key: 'pro',         label: 'Pro',         color: 'bg-blue-400',   text: 'text-blue-600' },
    { key: 'enterprise',  label: 'Enterprise',  color: 'bg-purple-400', text: 'text-purple-600' },
    { key: 'admin_grant', label: 'Granted',     color: 'bg-green-400',  text: 'text-green-600' },
  ]

  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-xs text-gray-400 mb-3">Plan Mix</p>

      {/* Bar */}
      <div className="flex rounded-full overflow-hidden h-2 mb-3">
        {plans.map(p => (
          counts[p.key] > 0 && (
            <div key={p.key}
              className={`${p.color} transition-all`}
              style={{ width: `${(counts[p.key] / total) * 100}%` }}
            />
          )
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-1">
        {plans.map(p => (
          <div key={p.key} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${p.color}`} />
            <span className="text-[11px] text-gray-500">
              {p.label} <span className={`font-semibold ${p.text}`}>{counts[p.key]}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchAll = async () => {
    setLoading(true)
    setError("")
    try {
      const [statsRes, dashRes] = await Promise.all([
        superAdminAPI.getStats(),
        superAdminAPI.getDashboard(),
      ])
      setStats(statsRes.data)
      setDashboard(dashRes.data)
    } catch (err) {
      setError(err?.response?.data?.error || "Could not reach the server.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorState message={error} onRetry={fetchAll} />

  return (
    <div className="space-y-3">

      {/* Row 1 — Core platform counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total businesses" value={stats.total_tenants} />
        <StatCard title="Active" value={stats.active_tenants} variant="success" />
        <StatCard
          title="Suspended"
          value={stats.suspended_tenants}
          variant={stats.suspended_tenants > 0 ? 'danger' : 'default'}
        />
        <StatCard title="Total users" value={stats.total_users} />
      </div>

      {/* Row 2 — Growth + Plan Mix + MRR + Revenue */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="New this month"
          value={`+${stats.new_this_month}`}
          variant="success"
          sub="signups"
        />
        <PlanMixCard stats={stats} />
        <MRRCard stats={stats} />
        <StatCard
          title="Platform Revenue"
          value={stats.estimated_mrr > 0 ? `₹${stats.estimated_mrr.toLocaleString()}` : '₹0'}
          sub="estimated · this month"
          variant={stats.estimated_mrr > 0 ? 'success' : 'default'}
        />
      </div>

      {/* Row 3 — Needs Attention + Signup Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <NeedsAttention data={dashboard.needs_attention} />
        </div>
        <SignupTrend data={dashboard.signup_trend} />
      </div>

      {/* Row 4 — Activity Feed */}
      <ActivityFeed data={dashboard.activity_feed} />
    </div>
  )
}