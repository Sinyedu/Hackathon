import { useState } from 'react'
import { API, generateDelivery } from '../services/session'
import type { Session } from '../services/session'

const PERSONAS = [
  { name: 'FreshField', sample: 'Tomato Box 5KG' },
  { name: 'Nordic Greens', sample: 'Tomater, kasse 5 kg' },
  { name: 'Metro Wholesale', sample: 'TOM-5K-CS' },
]
const CHAOS = [
  { id: 'shortage', label: 'Shortage' },
  { id: 'extra', label: 'Unordered item' },
  { id: 'swapped', label: 'Swapped product' },
  { id: 'overstated', label: 'Note overstates count' },
]
const INITIAL_SEED = Math.floor(Math.random() * 1_000_000)

export default function ChaosDock({ session, onError }: { session: Session; onError: (message: string) => void }) {
  const [persona, setPersona] = useState(PERSONAS[1].name)
  const [chaos, setChaos] = useState(['shortage'])
  const [ugliness, setUgliness] = useState(2)
  const [seed, setSeed] = useState(INITIAL_SEED)
  const [busy, setBusy] = useState(false)
  const [generated, setGenerated] = useState<Session['generated'][number] | null>(null)
  const print = async () => {
    setBusy(true)
    onError('')
    try { setGenerated(await generateDelivery(session.id, { persona, chaos, ugliness, seed })) }
    catch (cause) { onError((cause as Error).message) } finally { setBusy(false) }
  }
  return <section className="chaos-dock"><h2>Make a test delivery</h2>
    <p>Synthetic scans with a hidden answer key, so you can check what DockProof catches.</p>
    <div className="persona-grid">{PERSONAS.map(item => <button className={persona === item.name ? 'persona-card selected' : 'persona-card'} key={item.name} onClick={() => setPersona(item.name)}><strong>{item.name}</strong><code>{item.sample}</code></button>)}</div>
    <h3>Mistakes to hide in it</h3><div className="chaos-pills">{CHAOS.map(item => <label key={item.id} className={chaos.includes(item.id) ? 'chaos-pill selected' : 'chaos-pill'}><input type="checkbox" checked={chaos.includes(item.id)} onChange={() => setChaos(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])} />{item.label}</label>)}</div>
    <label className="ugliness-control">Scan wear <span>{ugliness} / 4</span><input type="range" min="0" max="4" value={ugliness} onChange={event => setUgliness(Number(event.target.value))} /></label>
    <div className="generator-actions"><button className="secondary-action" onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}>Randomise seed</button><span className="seed-label">Seed {seed}</span><button className="primary-action" disabled={busy} onClick={() => void print()}>{busy ? 'Printing…' : 'Print to dock'}</button></div>
    {generated && <div className="generator-preview"><div><strong>Printed to dock.</strong><p>The watcher will read the new documents automatically.</p><small>{generated.delivery_id}</small></div><img src={`${API}/api/session/${session.id}/generated/${generated.delivery_id}/note`} alt="Generated delivery note preview" /></div>}
  </section>
}
