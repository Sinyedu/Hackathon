import { Mic, MessageCircle, Send, Square, Volume2, VolumeX, X } from 'lucide-react'
import { useState } from 'react'
import { useAsk } from '../hooks/useAsk'
import { useRecorder } from '../hooks/useRecorder'
import { canSpeak, stopSpeaking } from '../lib/speak'
import type { Document } from '../types/reconciliation'
import ScanLinks from './ScanLinks'

const QUICK = ['What is in the delivery note?', 'What is missing?', 'Which supplier do you recommend?']

export default function AskPanel({ reconciliationId }: { reconciliationId: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [aloud, setAloud] = useState(false)
  const { messages, stage, voiceError, ask, askByVoice } = useAsk(reconciliationId, aloud)
  const mic = useRecorder((audio) => void askByVoice(audio))
  const busy = stage !== 'idle' || mic.recording

  const send = (q: string) => {
    const question = q.trim()
    if (!question || busy) return
    setText('')
    void ask(question)
  }
  const status = mic.recording ? 'Listening… tap the square to stop' : stage === 'transcribing' ? 'Transcribing…' : stage === 'thinking' ? 'Thinking…' : null

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Ask DockProof"
        className="fixed bottom-4 right-4 z-20 flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 font-semibold text-white shadow-lg hover:bg-indigo-700">
        <MessageCircle className="size-5" aria-hidden /> Ask
      </button>
    )
  }
  return (
    <aside aria-label="Ask DockProof" className="fixed inset-x-0 bottom-0 z-30 flex max-h-[80vh] flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[26rem] sm:rounded-2xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold text-slate-900">Ask about this delivery</h2>
        <div className="flex items-center gap-1">
          {canSpeak && (
            <button onClick={() => { if (aloud) stopSpeaking(); setAloud(!aloud) }} aria-pressed={aloud}
              aria-label="Read answers aloud" className="rounded-full p-2 text-slate-600 hover:bg-slate-100">
              {aloud ? <Volume2 className="size-5 text-indigo-600" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
            </button>
          )}
          <button onClick={() => { stopSpeaking(); setOpen(false) }} aria-label="Close" className="rounded-full p-2 text-slate-600 hover:bg-slate-100">
            <X className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">Tap the microphone and ask, or pick a question. I answer from what DockProof read in your scans.</p>
            {QUICK.map((q) => (
              <button key={q} onClick={() => send(q)} disabled={busy}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">{q}</button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="space-y-1.5">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-sm text-white">{m.question}</p>
            <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-900">
              {m.error ? <span role="alert" className="text-red-700">{m.error}</span> : m.answer ?? <span className="text-slate-500">Thinking…</span>}
              {m.answer && <div className="mt-2"><ScanLinks reconciliationId={reconciliationId} documents={m.sources as Document[]} label="Based on" /></div>}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t px-3 py-3">
        {(status || mic.error || voiceError) && (
          <p role="status" className={`mb-2 text-sm ${mic.error || voiceError ? 'text-red-700' : 'text-slate-600'}`}>{mic.error ?? voiceError ?? status}</p>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(text) }} className="flex items-center gap-2">
          <button type="button" onClick={mic.recording ? mic.stop : () => void mic.start()} disabled={!mic.supported || (busy && !mic.recording)}
            aria-label={mic.recording ? 'Stop recording' : 'Ask by voice'} title={mic.supported ? undefined : 'Microphone needs HTTPS or localhost'}
            className={`rounded-full p-3 text-white disabled:bg-slate-300 ${mic.recording ? 'animate-pulse bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {mic.recording ? <Square className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}
          </button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type a question" maxLength={500}
            aria-label="Question" className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-sm" />
          <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="rounded-full p-3 text-indigo-700 hover:bg-indigo-50 disabled:text-slate-300">
            <Send className="size-5" aria-hidden />
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">Answers are based on the text read from the scans (not the pixels). Check the linked scans for anything important.</p>
      </div>
    </aside>
  )
}
