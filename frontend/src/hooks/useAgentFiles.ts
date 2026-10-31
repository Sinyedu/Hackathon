import { useState, type RefObject } from 'react'
import { guessKind, pickFiles, wantsCamera, type Kind } from '../lib/agentIntent'
import { isTouch } from '../lib/device'
import { importFile, listFiles, uploadSession, type LocalFile, type Session } from '../services/session'

const MAX_BYTES = 10 * 1024 * 1024
const label = (kind: Kind) => kind.replace('_', ' ')
const FILENAME = /[\w-]+\.(pdf|png|jpe?g|webp)\b/i

export type PickMode = 'file' | 'camera'
interface Pending { file: File; rest: File[] }
interface Args {
  session: Session | null
  inputs: Record<PickMode, RefObject<HTMLInputElement | null>>
  say: (text: string) => void
  note: (text: string) => void
}

/**
 * Getting documents to the agent. A request opens this device's picker (camera on a phone, files
 * anywhere); "import <name>" reads the backend's local files folder and falls back to the picker
 * when that folder is unavailable, e.g. on a hosted backend without it.
 */
export function useAgentFiles({ session, inputs, say, note }: Args) {
  const [serverFiles, setServerFiles] = useState<LocalFile[] | null>(null)
  const [pick, setPick] = useState<PickMode | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  const waitingFor = (): Kind | null => {
    const last = session?.events.findLast((event) => event.type === 'delivery_received' || event.type === 'verdict')
    const slot = last?.type === 'delivery_received' ? last.data.waiting_for : null
    return slot === 'purchase_order' || slot === 'delivery_note' ? slot : null
  }

  const openDevice = (reason?: string, camera = false) => {
    const mode: PickMode = camera && isTouch ? 'camera' : 'file'
    setPick(mode)
    say(reason ?? (mode === 'camera' ? 'Point the camera at the document.' : isTouch ? 'Pick the document from your phone.' : 'Pick the purchase order and the delivery note from this computer.'))
    // Browsers only open a picker right after a tap or key press; after a spoken command the button stays.
    if (navigator.userActivation?.isActive ?? true) inputs[mode].current?.click()
  }

  const send = async (file: File, kind: Kind) => {
    if (!session) return
    note(`Adding ${file.name} as the ${label(kind)}.`)
    await uploadSession(session.id, { [kind]: file })
  }

  const uploadPicked = async (picked: File[]) => {
    setPick(null)
    const bad = picked.find((file) => file.size > MAX_BYTES || !(file.type.startsWith('image/') || file.type === 'application/pdf'))
    if (bad) return say(`${bad.name} is not a photo or PDF under 10 MB.`)
    const named = picked.map((file) => ({ file, kind: guessKind(file.name) ?? (picked.length === 1 ? waitingFor() : null) }))
    for (const { file, kind } of named) if (kind) await send(file, kind)
    const unknown = named.filter(({ kind }) => !kind).map(({ file }) => file)
    if (unknown.length) {
      setPending({ file: unknown[0], rest: unknown.slice(1) })
      say(`Is ${unknown[0].name} the purchase order or the delivery note?`)
    }
  }

  const assignPending = async (kind: Kind) => {
    const current = pending
    setPending(null)
    if (!current) return
    await send(current.file, kind)
    if (current.rest.length === 1) await send(current.rest[0], kind === 'purchase_order' ? 'delivery_note' : 'purchase_order')
    else if (current.rest.length > 1) say('Name the other files with order or delivery in the name and add them again.')
  }

  const importNamed = async (text: string) => {
    if (!session) return
    let listing = serverFiles
    if (!listing) {
      try {
        listing = (await listFiles(session.id)).files
        setServerFiles(listing)
      } catch {
        return openDevice('There is no files folder on this server, so pick the document from this device.')
      }
    }
    const picked = pickFiles(text, listing)
    if (picked === 'ambiguous') return say('More than one file fits that. Say the file name, or tap it below.')
    if (!picked.length) return openDevice('I did not find that in the files folder. Pick it from this device instead.')
    for (const file of picked) {
      if (!file.kind) return say(`I cannot tell if ${file.name} is the purchase order or the delivery note. Rename it with order or delivery in the name.`)
      note(`Importing ${file.name} as the ${label(file.kind)}.`)
      await importFile(session.id, file.name, file.kind)
    }
  }

  /** "attach file: name.pdf" tries the files folder by name; anything else opens the device picker. */
  const attach = async (text: string) => FILENAME.test(text) ? importNamed(text) : openDevice(undefined, wantsCamera(text))

  return { serverFiles, pick, pending, openDevice, attach, uploadPicked, assignPending, importNamed }
}
