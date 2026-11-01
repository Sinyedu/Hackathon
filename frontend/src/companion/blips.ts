let context: AudioContext | null = null
let timer: number | undefined
export function stopBlips() { clearTimeout(timer); if (context?.state === 'running') void context.suspend() }
export function blipReply(text: string, done: () => void) {
  stopBlips()
  context ??= new AudioContext()
  const audio = context
  void audio.resume()
  let index = 0
  const tick = () => {
    const character = text[index++]
    if (!character) { done(); return }
    if (/\w/.test(character)) {
      const oscillator = audio.createOscillator(), gain = audio.createGain(), filter = audio.createBiquadFilter()
      oscillator.type = 'triangle'; oscillator.frequency.value = 240 * 2 ** (((character.charCodeAt(0) % 7) - 3) / 12)
      filter.type = 'lowpass'; filter.frequency.value = 1800
      gain.gain.setValueAtTime(0, audio.currentTime); gain.gain.linearRampToValueAtTime(.075, audio.currentTime + .004)
      gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .045)
      oscillator.connect(filter).connect(gain).connect(audio.destination)
      oscillator.start(); oscillator.stop(audio.currentTime + .05)
      oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); gain.disconnect() }
    }
    timer = window.setTimeout(tick, /[.!?]/.test(character) ? 240 : character === ',' ? 120 : 34)
  }
  tick()
}
