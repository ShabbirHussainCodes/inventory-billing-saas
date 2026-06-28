import { useState, useEffect } from "react"
import { superAdminAPI } from "../../services/api"

// ─── Signup Trend Chart (30 days, CSS only) ───────────────────────────────────

function SignupTrend30({ data = [] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const total = data.reduce((s, d) => s + d.count, 0)

  // Show only every 5th label to avoid crowding
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-gray-900">Signup Trend</p>
          <p className="text-xs text-gray-400 mt-0.5">Last 30 days</p>
        </div>
        <p className="text-xs font-medium text-green-600">+{total} total</p>
      </div>

      <div className="flex items-end gap-0.5" style={{ height: 80 }}>
        {data.map((item, i) => {
          const heightPct = (item.count / maxCount) * 100
          const isToday = i === data.length - 1
          return (
            <div key={item.date}
              className="flex flex-col items-center flex-1 gap-0.5">
              <div className="w-full flex items-end" style={{ height: 64 }}>
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    isToday ? 'bg-blue-500' : 'bg-blue-200'
                  }`}
                  style={{ height: `${Math.max(heightPct, item.count > 0 ? 8 : 2)}%` }}
                  title={`${item.date}: ${item.count}`}
                />
              </div>
              {/* Show label every 5 days */}
              <span className="text-[8px] text-gray-400">
                {i % 5 === 0 || isToday ? item.date.split(' ')[0] : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Geographic Distribution ──────────────────────────────────────────────────

function GeographicChart({ data = [] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-900 mb-1">Geographic Distribution</p>
      <p className="text-xs text-gray-400 mb-4">Businesses by country</p>

      {data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.country}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700">{item.country}</span>
                <span className="text-xs text-gray-500">{item.count}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-blue-400 transition-all"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Plan Distribution ────────────────────────────────────────────────────────

function PlanDistribution({ data, total }) {
  const plans = [
    { key: 'free_tier',   label: 'Free',    color: 'bg-gray-400',   text: 'text-gray-600' },
    { key: 'paid',        label: 'Paid',    color: 'bg-blue-500',   text: 'text-blue-600' },
    { key: 'admin_grant', label: 'Granted', color: 'bg-purple-500', text: 'text-purple-600' },
  ]

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-900 mb-1">Plan Distribution</p>
      <p className="text-xs text-gray-400 mb-4">Across all businesses</p>

      {/* Visual bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-4">
        {plans.map((p) => {
          const count = data[p.key] || 0
          const pct = total > 0 ? (count / total) * 100 : 0
          return pct > 0 ? (
            <div key={p.key}
              className={`${p.color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${p.label}: ${count}`}
            />
          ) : null
        })}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {plans.map((p) => {
          const count = data[p.key] || 0
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={p.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${p.color}`} />
                <span className="text-xs text-gray-600">{p.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${p.text}`}>{count}</span>
                <span className="text-xs text-gray-400">{pct}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Business Health ──────────────────────────────────────────────────────────

function BusinessHealth({ data, total }) {
  const segments = [
    { key: 'healthy',   label: 'Healthy',   color: 'bg-green-500', text: 'text-green-600',  light: 'bg-green-50' },
    { key: 'dormant',   label: 'Dormant',   color: 'bg-amber-400', text: 'text-amber-600',  light: 'bg-amber-50' },
    { key: 'suspended', label: 'Suspended', color: 'bg-red-400',   text: 'text-red-600',    light: 'bg-red-50' },
  ]

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-900 mb-1">Business Health</p>
      <p className="text-xs text-gray-400 mb-4">Platform-wide status breakdown</p>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-4">
        {segments.map((s) => {
          const count = data[s.key] || 0
          const pct = total > 0 ? (count / total) * 100 : 0
          return pct > 0 ? (
            <div key={s.key}
              className={`${s.color}`}
              style={{ width: `${pct}%` }}
              title={`${s.label}: ${count}`}
            />
          ) : null
        })}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-3 gap-2">
        {segments.map((s) => {
          const count = data[s.key] || 0
          return (
            <div key={s.key} className={`rounded-xl ${s.light} p-3 text-center`}>
              <p className={`text-xl font-semibold ${s.text}`}>{count}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Top Businesses ───────────────────────────────────────────────────────────

function TopBusinesses({ data = [] }) {
  const PLAN_BADGES = {
    paid:        { label: 'Paid',    cls: 'bg-blue-50 text-blue-600' },
    free_tier:   { label: 'Free',    cls: 'bg-gray-100 text-gray-600' },
    admin_grant: { label: 'Granted', cls: 'bg-purple-50 text-purple-600' },
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-900 mb-1">Top Active Businesses</p>
      <p className="text-xs text-gray-400 mb-4">By invoice count</p>

      {data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          No invoice activity yet
        </p>
      ) : (
        <div className="space-y-3">
          {data.map((b, i) => {
            const badge = PLAN_BADGES[b.access_type] || PLAN_BADGES.free_tier
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{b.name}</p>
                  <p className="text-xs text-gray-400">{b.country}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">
                    {b.invoice_count}
                    <span className="text-xs font-normal text-gray-400 ml-1">inv</span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-36 rounded-2xl bg-gray-100" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-52 rounded-2xl bg-gray-100" />
        <div className="h-52 rounded-2xl bg-gray-100" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-44 rounded-2xl bg-gray-100" />
        <div className="h-44 rounded-2xl bg-gray-100" />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await superAdminAPI.getAnalytics()
      setData(res.data)
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load analytics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) return <AnalyticsSkeleton />

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-600 mb-3">{error}</p>
        <button onClick={fetchData}
          className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50">
          Try again
        </button>
      </div>
    )
  }

  const totalTenants = data.total_tenants || 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Platform Analytics</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time data — {totalTenants} businesses on platform
          </p>
        </div>
        <button onClick={fetchData}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition">
          ↻ Refresh
        </button>
      </div>

      {/* 30-day signup trend */}
      <SignupTrend30 data={data.signup_trend} />

      {/* Geographic + Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GeographicChart data={data.geographic} />
        <PlanDistribution data={data.plan_distribution} total={totalTenants} />
      </div>

      {/* Business health + Top businesses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BusinessHealth data={data.health_breakdown} total={totalTenants} />
        <TopBusinesses data={data.top_businesses} />
      </div>
    </div>
  )
}