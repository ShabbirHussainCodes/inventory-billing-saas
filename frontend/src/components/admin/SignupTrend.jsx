// 7-day signup trend — pure CSS bar chart, koi external library nahi
// Props: data = [{ date: '21 Jun', count: 3 }, ...]

export default function SignupTrend({ data = [] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-sm font-medium text-gray-900">New signups</p>
        <p className="text-xs text-green-600 font-medium">+{total} this week</p>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1.5 flex-1 min-h-[80px]">
        {data.map((item, i) => {
          const heightPct = maxCount > 0 ? (item.count / maxCount) * 100 : 0
          const isToday = i === data.length - 1
          return (
            <div
              key={item.date}
              className="flex flex-col items-center gap-1 flex-1"
            >
              <span className="text-[10px] text-gray-500 tabular-nums">
                {item.count > 0 ? item.count : ''}
              </span>
              <div className="w-full flex items-end" style={{ height: 60 }}>
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    isToday ? 'bg-blue-500' : 'bg-blue-200'
                  }`}
                  style={{
                    height: `${Math.max(heightPct, item.count > 0 ? 8 : 3)}%`,
                  }}
                />
              </div>
              <span className="text-[9px] text-gray-400 truncate w-full text-center">
                {item.date.split(' ')[0]}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-gray-400 mt-3">Last 7 days</p>
    </div>
  )
}