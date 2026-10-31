import { Camera, FileText, ImageUp, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'

interface Props {
  title: string
  hint: string
  file: File | null
  onChange: (file: File | null) => void
  disabled: boolean
}

export default function FileSlot({ title, hint, file, onChange, disabled }: Props) {
  const camera = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (file?.type.startsWith('image/') ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.files?.[0] ?? null)
    e.target.value = ''
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mb-3 text-sm text-slate-500">{hint}</p>
      {file ? (
        <div className="flex items-center gap-3">
          {preview ? (
            <img src={preview} alt={`${title} preview`} className="size-24 rounded-lg border object-cover" />
          ) : (
            <FileText className="size-12 text-slate-400" aria-hidden />
          )}
          <p className="min-w-0 flex-1 truncate text-sm text-slate-700">{file.name}</p>
          <button onClick={() => onChange(null)} disabled={disabled} aria-label={`Remove ${title}`}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <X className="size-5" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => camera.current?.click()} disabled={disabled}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            <Camera className="size-5" aria-hidden /> Scan with camera
          </button>
          <button onClick={() => picker.current?.click()} disabled={disabled}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <ImageUp className="size-5" aria-hidden /> Choose file
          </button>
        </div>
      )}
      <input ref={camera} type="file" accept="image/*" capture="environment" onChange={pick} hidden />
      <input ref={picker} type="file" accept="image/*,application/pdf" onChange={pick} hidden />
    </section>
  )
}
