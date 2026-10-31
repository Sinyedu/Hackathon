import { useEffect, useRef, useState } from 'react'

/** An utterance ends only after this much silence, so thinking pauses don't cut you off. */
export const SILENCE_MS = 3000
const MIN_MS = 600
const MAX_MS = 30_000
const MIN_LEVEL = 0.04

/**
 * Hands-free listening: segments speech locally by volume and hands each utterance to onUtterance.
 * The start threshold adapts to room noise. Nothing leaves the browser except what onUtterance
 * sends to the local backend (Whisper).
 */
export function useHandsFree(enabled: boolean, paused: boolean, onUtterance: (audio: Blob) => void) {
  const [error, setError] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const pausedRef = useRef(paused)
  const handler = useRef(onUtterance)
  useEffect(() => {
    pausedRef.current = paused
    handler.current = onUtterance
  })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let cleanup = () => {}
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop())
        const ctx = new AudioContext()
        const resume = () => void ctx.resume() // browsers keep audio suspended until the page has had a click/tap
        resume()
        window.addEventListener('pointerdown', resume, { once: true })
        window.addEventListener('keydown', resume, { once: true })
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        ctx.createMediaStreamSource(stream).connect(analyser)
        const buf = new Uint8Array(analyser.fftSize)
        let rec: MediaRecorder | null = null
        let chunks: Blob[] = []
        let startedAt = 0
        let lastLoud = 0
        let floor = 0.01 // running estimate of room noise
        const begin = () => {
          chunks = []
          const mine = new MediaRecorder(stream)
          rec = mine
          mine.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
          mine.onstop = () => {
            setCapturing(false)
            if (Date.now() - startedAt >= MIN_MS && chunks.length > 0) handler.current(new Blob(chunks, { type: mine.mimeType }))
          }
          startedAt = Date.now()
          lastLoud = startedAt
          mine.start()
          setCapturing(true)
        }
        const timer = window.setInterval(() => {
          analyser.getByteTimeDomainData(buf)
          let sum = 0
          for (const v of buf) sum += ((v - 128) / 128) ** 2
          const level = Math.sqrt(sum / buf.length)
          const threshold = Math.max(MIN_LEVEL, floor * 3)
          const now = Date.now()
          if (!rec) floor = floor * 0.95 + Math.min(level, threshold) * 0.05
          if (level > threshold) lastLoud = now
          if (!rec && level > threshold && !pausedRef.current) begin()
          if (rec && (now - lastLoud > SILENCE_MS || now - startedAt > MAX_MS || pausedRef.current)) {
            const done = rec
            rec = null
            if (done.state === 'recording') done.stop()
          }
        }, 100)
        cleanup = () => {
          window.clearInterval(timer)
          window.removeEventListener('pointerdown', resume)
          window.removeEventListener('keydown', resume)
          if (rec?.state === 'recording') rec.stop()
          stream.getTracks().forEach((t) => t.stop())
          void ctx.close()
        }
      })
      .catch(() => setError('Microphone unavailable. Allow access, or type your question.'))
    return () => {
      cancelled = true
      cleanup()
    }
  }, [enabled])

  return { error: enabled ? error : null, capturing: enabled && capturing }
}
