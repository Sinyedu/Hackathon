import { useEffect, useState } from 'react'
import { Check, FileText, Smartphone } from 'lucide-react'
import QRCode from 'qrcode'
import LiveDot from './LiveDot'
import { lanIp, uploadSession } from '../services/session'
import type { Session } from '../services/session'

export function PairCard({ session }: { session: Session }) {
  const [qr, setQr] = useState('')
  const [url, setUrl] = useState('')
  useEffect(() => {
    void lanIp(session.id).then(({ ip }) => {
      const target = `http://${ip}:${location.port || '5173'}/dock?s=${session.id}`
      setUrl(target)
      return QRCode.toDataURL(target, { margin: 0, width: 240, color: { dark: '#0B0D12', light: '#FFFFFF' } })
    }).then(setQr).catch(() => setQr(''))
  }, [session.id])
  const connected = session.events.some(event => event.type === 'phone_connected')
  return <section className="pair">
    {qr ? <img className="pair__qr" src={qr} alt={`QR code for ${url}`} /> : <Smartphone size={40} aria-hidden />}
    <div>
      <h2>Scan from the dock</h2>
      <p>Point a phone at the code to scan delivery notes and count boxes.</p>
      <LiveDot label={connected ? 'Phone connected' : 'Waiting for a phone'} active={connected} />
      {!qr && <a className="link-btn" href={`/dock?s=${session.id}`}>Open the dock view here</a>}
    </div>
  </section>
}

function FilePick({ label, hint, file, capture, onPick }: { label: string; hint: string; file: File | null; capture?: boolean; onPick: (file: File) => void }) {
  return <label className={file ? 'pick pick--done' : 'pick'}>
    <span className="pick__icon">{file ? <Check size={20} aria-hidden /> : <FileText size={20} aria-hidden />}</span>
    <span className="pick__text"><strong>{label}</strong><small>{file ? file.name : hint}</small></span>
    <input type="file" accept="image/*,.pdf,application/pdf" capture={capture ? 'environment' : undefined}
      onChange={event => { const picked = event.target.files?.[0]; if (picked) onPick(picked); event.currentTarget.value = '' }} />
  </label>
}

export function Upload({ session, isDock, onError }: { session: Session; isDock: boolean; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [purchase, setPurchase] = useState<File | null>(null)
  const [note, setNote] = useState<File | null>(null)
  const submit = async (files: { purchase_order?: File; delivery_note?: File }) => {
    setBusy(true)
    onError('')
    try { await uploadSession(session.id, files) } catch (cause) { onError((cause as Error).message) } finally { setBusy(false) }
  }
  return <section className="upload">
    <h2>{isDock ? 'Scan the delivery note' : 'Add both documents'}</h2>
    <div className="upload__picks">
      {!isDock && <FilePick label="Purchase order" hint="What you ordered · photo or PDF" file={purchase} onPick={file => { setPurchase(file); void submit({ purchase_order: file }) }} />}
      <FilePick label="Delivery note" hint="What arrived · photo or PDF" file={note} capture={isDock}
        onPick={file => { setNote(file); void submit({ ...(purchase ? { purchase_order: purchase } : {}), delivery_note: file }) }} />
    </div>
    {busy && <LiveDot label="Uploading" active />}
  </section>
}
