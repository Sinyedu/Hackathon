(async () => {
  const result = { url: location.origin, secureContext: isSecureContext, mascotPresent: !!document.querySelector('.kiwi-mascot'), audio: {} }
  const bounded = (promise) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))])
  const tasks = []
  const observer = new PerformanceObserver((entries) => tasks.push(...entries.getEntries().map((e) => e.duration)))
  observer.observe({ type: 'longtask', buffered: true })
  result.paint = performance.getEntriesByType('paint').map(({ name, startTime }) => ({ name, startTime }))
  try { result.audio.permission = (await bounded(navigator.permissions.query({ name: 'microphone' }))).state } catch { result.audio.permission = 'unavailable' }
  try {
    const devices = await bounded(navigator.mediaDevices.enumerateDevices())
    result.audio.inputs = devices.filter((d) => d.kind === 'audioinput').length
    result.audio.outputs = devices.filter((d) => d.kind === 'audiooutput').length
  } catch (error) { result.audio.deviceError = error.name }
  const context = new AudioContext()
  result.audio.contextState = context.state
  result.audio.contextSampleRate = context.sampleRate
  await bounded(context.close()).catch(() => {})
  result.audio.mediaRecorder = typeof MediaRecorder !== 'undefined'
  result.audio.voices = speechSynthesis.getVoices().length
  result.audio.wakeIndicator = document.querySelector('.wake-toggle')?.textContent
  result.audio.firstFailingStage = result.audio.inputs === 0 ? 'capture: no microphone inputs enumerated' : result.audio.permission === 'denied' ? 'permission: microphone denied' : 'live capture needs a spoken microphone trial; parser rejects Hey Kiwi (see voice diagnostic)'
  const frames = []
  const began = performance.now()
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 10500)
    let previous = began
    function step(now) {
      frames.push(now - previous); previous = now
      if (now - began < 10000) requestAnimationFrame(step)
      else { clearTimeout(timeout); resolve() }
    }
    requestAnimationFrame(step)
  })
  result.idleFrameCallbackFps = frames.length / ((performance.now() - began) / 1000)
  result.idleCallbackGapsOver25ms = frames.filter((ms) => ms > 25).length
  result.longestTaskMs = Math.max(0, ...tasks)
  result.note = 'rAF callback cadence is a proxy, not a DevTools paint-cost or compositor dropped-frame measurement. No microphone recording performed.'
  observer.disconnect()
  return result
})()
