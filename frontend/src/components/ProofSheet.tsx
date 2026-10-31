import { useEffect, useRef } from 'react'
import { documentFileUrl } from '../services/api'
import type { LineItem, Reconciliation } from '../types/reconciliation'

export default function ProofSheet({ result, line, onClose }: { result: Reconciliation; line: LineItem; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const document = result.documents.find(doc => doc.id === line.source_document_id)
  const url = documentFileUrl(result.id, line.source_document_id)
  const isPdf = document?.filename.toLowerCase().endsWith('.pdf')
  useEffect(() => {
    if (!canvas.current || isPdf) return
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const bounds = line.bbox || [0, 0, image.naturalWidth, image.naturalHeight]
      const x = Math.max(0, Math.floor(bounds[0] - 12))
      const y = Math.max(0, Math.floor(bounds[1] - 12))
      const width = Math.min(image.naturalWidth - x, Math.ceil(bounds[2] - bounds[0] + 24))
      const height = Math.min(image.naturalHeight - y, Math.ceil(bounds[3] - bounds[1] + 24))
      const target = canvas.current
      if (!target) return
      target.width = width * 2
      target.height = height * 2
      const context = target.getContext('2d')
      context?.scale(2, 2)
      context?.drawImage(image, x, y, width, height, 0, 0, width, height)
    }
    image.src = url
  }, [line, isPdf, url])
  return <div className="proof-backdrop" onClick={onClose}><section className="proof-sheet" role="dialog" aria-modal="true" aria-label="Source proof" onClick={event => event.stopPropagation()}>
    <button className="proof-close" onClick={onClose} aria-label="Close proof">Close</button>
    <p className="proof-kind">From the {document?.kind.replace('_', ' ')}</p>
    <h2>{line.description}</h2>
    <div className="proof-frame">{isPdf ? <a href={url} target="_blank" rel="noreferrer">Open source PDF, page {line.page || 1}</a> : <canvas ref={canvas} aria-label="Cropped source line" />}</div>
    <p>{line.source_text}</p><small>{document?.filename} · {line.page ? `Page ${line.page}` : 'Image'} · {line.id.split('-').at(-1)}</small>
  </section></div>
}
