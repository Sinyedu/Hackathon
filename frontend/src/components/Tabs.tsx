export interface TabDef<T extends string> {
  id: T
  label: string
  dot?: boolean
}

export default function Tabs<T extends string>({ tabs, value, onChange }: {
  tabs: TabDef<T>[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div role="tablist" className="flex gap-1 rounded-xl bg-slate-200/70 p-1">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`relative flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${value === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
          {t.label}
          {t.dot && <span className="absolute right-2 top-2 size-2 rounded-full bg-amber-500" aria-label="needs attention" />}
        </button>
      ))}
    </div>
  )
}
