import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_MS = 30_000

/** Tap-to-record microphone capture. Needs HTTPS or localhost (browser rule for getUserMedia). */
export function useRecorder(onFinished: (audio: Blob) => void) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const callback = useRef(onFinished)
  useEffect(() => {
    callback.current = onFinished
  }, [onFinished])

  const supported =
    typeof MediaRecorder !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia

  const stop = useCallback(() => {
    window.clearTimeout(timer.current)
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        if (chunks.length > 0) callback.current(new Blob(chunks, { type: rec.mimeType }))
      }
      recorder.current = rec
      rec.start()
      setRecording(true)
      timer.current = window.setTimeout(stop, MAX_MS)
    } catch {
      setError('Microphone unavailable. Allow access in the browser, or type your question.')
    }
  }, [stop])

  useEffect(() => () => stop(), [stop])
  return { supported, recording, error, start, stop }
}
