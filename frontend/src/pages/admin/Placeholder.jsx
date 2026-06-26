// Shared empty-state — har admin page jiska data abhi nahi bana, yahi dikhayega
export default function Placeholder({ title, description }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white text-center">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>
    </div>
  )
}