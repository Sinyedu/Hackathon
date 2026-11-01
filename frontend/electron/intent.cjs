const sites = { github: 'https://github.com', youtube: 'https://youtube.com', google: 'https://google.com', discord: 'https://discord.com/app', steam: 'https://store.steampowered.com', spotify: 'https://open.spotify.com', gmail: 'https://mail.google.com' }
function spokenNumber(value) {
  if (/^\d{1,3}$/.test(value)) return Number(value)
  const words = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
  const parts = value.toLowerCase().split(/[- ]/)
  if (parts.some((part) => !(part in words)) || parts.length > 2) return NaN
  if (parts.length === 2 && (words[parts[0]] < 20 || words[parts[0]] % 10 || words[parts[1]] > 9)) return NaN
  return parts.reduce((sum, part) => sum + words[part], 0)
}
function intentOf(raw) {
  const text = raw.trim().replace(/^(?:(?:hey|hi|okay|ok)[, ]+)?kiwi[,!:.\s]*/i, '').trim()
    .replace(/^(?:(?:can|could|would) you |please )/i, '').replace(/\s+(?:for me(?: please)?|please)[.!?]*$/i, '').replace(/[.!?]+$/, '')
    .replace(/^open(?=git\s*hub\b)/i, 'open ').replace(/\bgit\s+hub\b/gi, 'GitHub')
  if (/^(stop|cancel|be quiet|stop talking)[.!]?$/i.test(text)) return { type: 'stop' }
  if (/\b(?:build|create|make)\b.{0,100}\b(?:website|landing page|web page)\b/i.test(text) && /^(?:(?:open vs code and )?(?:build|create|make))\b/i.test(text)) return { type: 'build', description: text }
  const timer = text.match(/^(?:set|start) (?:a )?(\d{1,3}|[a-z]+(?:[- ][a-z]+)?)[ -](second|minute|hour)s?(?: timer)?$/i)
  if (timer && Number.isFinite(spokenNumber(timer[1]))) return { type: 'timer', seconds: spokenNumber(timer[1]) * ({ second: 1, minute: 60, hour: 3600 }[timer[2].toLowerCase()]) }
  const search = text.match(/^(?:search(?: the web)? for|google) (.{1,400})$/i)
  if (search) return { type: 'url', url: `https://www.google.com/search?q=${encodeURIComponent(search[1])}`, label: 'your search' }
  const music = text.match(/^play (.{1,300})$/i)
  if (music && !/^pause|next|previous$/i.test(music[1])) return { type: 'url', url: `https://music.youtube.com/search?q=${encodeURIComponent(music[1])}`, label: `a music search for ${music[1]}` }
  const open = text.match(/^(?:open|launch|start) (.{1,200}?)[.!]?$/i)
  if (open) {
    const names = open[1].toLowerCase().replace(/^the /, '').split(/\s*(?:,| and )\s*/)
    if (names.every((name) => sites[name])) return { type: 'urls', urls: names.map((name) => sites[name]), label: names.join(', ') }
    if (['notepad', 'calculator', 'files', 'file explorer', 'vs code', 'vscode', 'visual studio code'].includes(names[0]) && names.length === 1) return { type: 'app', app: names[0] }
    try { const url = new URL(/^https?:\/\//i.test(open[1]) ? open[1] : `https://${open[1]}`); if (url.hostname.includes('.') && !url.username && !url.password && url.protocol === 'https:') return { type: 'url', url: url.href, label: url.hostname } } catch { /* conversational request */ }
  }
  const theme = text.match(/^(?:switch to|set|use|turn on) (?:the )?(dark|light) (?:mode|theme)[.!]?$/i)
  if (theme) return { type: 'theme', dark: theme[1].toLowerCase() === 'dark' }
  if (/^(?:turn (?:the )?volume (?:up|down)|volume (?:up|down)|mute(?: (?:the )?volume)?|(?:play|pause)(?: (?:the )?music)?|next track|previous track)[.!]?$/i.test(text)) {
    return { type: 'media', command: /volume up/i.test(text) ? 'up' : /volume down/i.test(text) ? 'down' : /mute/i.test(text) ? 'mute' : /next/i.test(text) ? 'next' : /previous/i.test(text) ? 'previous' : 'playpause' }
  }
  if (/^(?:what time is it|what is the time)[?!]?$/i.test(text)) return { type: 'time' }
  if (/^(?:what can you do|help|commands)[?!]?$/i.test(text)) return { type: 'help' }
  return { type: 'chat', text }
}
module.exports = { intentOf }
