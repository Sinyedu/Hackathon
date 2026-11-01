import { useEffect, useRef, useState } from 'react'
import { parseWake } from '../lib/wake'
import { desktop } from './desktop'

export function useWakeVoice(enabled: boolean, busy: boolean, onCommand: (text: string) => void, onStop: () => void) {
  const [status, setStatus] = useState('off')
  const [listening, setListening] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [caption, setCaption] = useState('')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState('')
  const command = useRef(onCommand), stop = useRef(onStop), expiry = useRef<number | undefined>(undefined)
  const wasBusy = useRef(false)
  useEffect(() => { command.current = onCommand; stop.current = onStop }, [onCommand, onStop])
  useEffect(() => {
    let cancelled = false
    if (!enabled) {
      void desktop.listen(false).then(() => { if (!cancelled) { setStatus('off'); setListening(false); setProcessing(false); setCaption('') } })
      return () => { cancelled = true }
    }
    const keepCaption = (value: string, duration = 10000) => {
      clearTimeout(expiry.current); setCaption(value)
      expiry.current = window.setTimeout(() => { setCaption(''); desktop.caption(false) }, duration)
    }
    const off = desktop.onEvent((event) => {
      if (event.type === 'voice-status') { setStatus(event.status ?? 'off'); if (event.status === 'off') setListening(false) }
      else if (event.type === 'voice-wake') {
        clearTimeout(expiry.current); setError(''); setCaption('I’m listening…'); setListening(true); desktop.caption(true)
      } else if (event.type === 'voice-partial') setCaption(event.text ?? '')
      else if (event.type === 'voice-level') setLevel(event.level ?? 0)
      else if (event.type === 'voice-processing') { setProcessing(true); setListening(false); setCaption(event.text ?? 'Recognizing…') }
      else if (event.type === 'voice-final') {
        setProcessing(false); setListening(false); setLevel(0)
        const text = event.text?.trim() ?? ''
        const value = parseWake(text) ?? text
        keepCaption(text || 'I didn’t catch that. Say “Hey Kiwi” again.')
        if (value.trim()) command.current(value)
        else { setListening(true); setCaption('I’m listening…'); desktop.listenMode('armed') }
      } else if (event.type === 'voice-stop') { setProcessing(false); setListening(false); keepCaption('Stopped.', 3000); stop.current() }
      else if (event.type === 'voice-reset') { setProcessing(false); setListening(false); setLevel(0); keepCaption('Stopped.', 3000) }
      else if (event.type === 'voice-timeout') { setListening(false); setLevel(0); keepCaption(event.text ?? 'Say “Hey Kiwi” to start.', 3500) }
      else if (event.type === 'voice-error') { setProcessing(false); setError(event.message ?? 'Microphone unavailable.'); setListening(false); setStatus('error'); keepCaption(event.message ?? 'Microphone unavailable.', 15000); desktop.caption(true) }
    })
    void desktop.listen(true).then((value) => { if (!cancelled) { setStatus(value.status); if (value.message) setError(value.message) } }).catch((cause: Error) => { if (!cancelled) { setError(cause.message); setStatus('error') } })
    return () => { cancelled = true; clearTimeout(expiry.current); off(); void desktop.listen(false) }
  }, [enabled])
  useEffect(() => {
    if (enabled && busy) desktop.listenMode('busy')
    else if (enabled && wasBusy.current) desktop.listenMode('armed')
    wasBusy.current = busy
  }, [enabled, busy])
  return { status, listening, processing, caption, level, error }
}
