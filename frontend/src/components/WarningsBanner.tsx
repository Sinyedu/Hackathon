export default function WarningsBanner({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null
  return (
    <details className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <summary className="cursor-pointer font-medium">{warnings.length} thing{warnings.length > 1 ? 's' : ''} to check</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
    </details>
  )
}
