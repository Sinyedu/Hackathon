import { useCallback, useEffect, useRef, useState } from 'react'
import { traceSpan, voiceRequestId } from '../lib/trace'

const MAX_MS = 30_000

/** Tap-to-record microphone capture. Needs HTTPS or localhost (browser rule for getUserMedia). */
export function useRecorder(onFinished: (audio: Blob, requestId: string) => void) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const callback = useRef(onFinished)
  // Live input loudness 0..1, read per animation frame by the visualiser (a ref avoids re-renders).
  const level = useRef(0)
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
      const requestId = voiceRequestId()
      const captureStart = performance.now()
      const audio = new AudioContext()
      const analyser = audio.createAnalyser()
      analyser.fftSize = 256
      audio.createMediaStreamSource(stream).connect(analyser)
      const samples = new Uint8Array(analyser.fftSize)
      let frame = 0
      const measure = () => {
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        for (const s of samples) sum += ((s - 128) / 128) ** 2
        level.current = Math.min(1, Math.sqrt(sum / samples.length) * 4)
        frame = requestAnimationFrame(measure)
      }
      measure()
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
      rec.onstop = () => {
        cancelAnimationFrame(frame)
        level.current = 0
        void audio.close()
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        traceSpan('capture', captureStart, requestId)
        if (chunks.length > 0) callback.current(new Blob(chunks, { type: rec.mimeType }), requestId)
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
  return { supported, recording, error, level, start, stop }
}
