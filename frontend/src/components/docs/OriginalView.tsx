import { ExternalLink } from 'lucide-react'
import { documentFileUrl } from '../../services/api'
import type { Document } from '../../types/reconciliation'

/** The original upload exactly as received: the PDF in the browser's viewer, or the scan as an image. */
export default function OriginalView({ reconciliationId, document }: { reconciliationId: string; document: Document | undefined }) {
  if (!document) return <p className="compare__empty">This document has not arrived yet.</p>
  const url = documentFileUrl(reconciliationId, document.id)
  const isPdf = document.filename.toLowerCase().endsWith('.pdf')
  return (
    <div className="original">
      <div className="original__bar">
        <span>{document.filename}</span>
        <a className="link-btn" href={url} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden /> Open in a new tab</a>
      </div>
      {isPdf
        ? <iframe className="original__pdf" src={url} title={`${document.filename} (PDF)`} />
        : <img className="original__img" src={url} alt={`Scan: ${document.filename}`} />}
    </div>
  )
}
