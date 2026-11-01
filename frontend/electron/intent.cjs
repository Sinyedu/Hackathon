const { desktopApps, localAppName, closableName, displayName } = require('./apps.cjs')
const { queryWords } = require('./files.cjs')
const { isShellName, isVagueName } = require('./installed-apps.cjs')
const ordinals = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 }
const sites = { github: 'https://github.com', youtube: 'https://youtube.com', google: 'https://google.com', discord: 'https://discord.com/app', steam: 'https://store.steampowered.com', spotify: 'https://open.spotify.com', gmail: 'https://mail.google.com' }
function browserTarget(value) {
  const target = value?.trim()
  if (!target) return { url: 'about:blank', label: 'a new Firefox tab' }
  const name = target.toLowerCase().replace(/^the\s+/, '')
  if (sites[name]) return { url: sites[name], label: name }
  try {
    const url = new URL(/^https?:\/\//i.test(target) ? target : `https://${target}`)
    if (url.protocol === 'https:' && url.hostname.includes('.') && !url.username && !url.password) return { url: url.href, label: url.hostname }
  } catch { /* Ordinary words become a search, never a program or shell command. */ }
  return { url: `https://www.google.com/search?q=${encodeURIComponent(target)}`, label: `a Firefox search for ${target}` }
}
function spokenNumber(value) {
  if (/^\d{1,3}$/.test(value)) return Number(value)
  const words = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
  const parts = value.toLowerCase().split(/[- ]/)
  if (parts.some((part) => !(part in words)) || parts.length > 2) return NaN
  if (parts.length === 2 && (words[parts[0]] < 20 || words[parts[0]] % 10 || words[parts[1]] > 9)) return NaN
  return parts.reduce((sum, part) => sum + words[part], 0)
}
// Speech-to-text hears "Kiwi" in many ways. Close sounds count as the wake word; anything else ("Kevin") does not.
const WAKE_OPENERS = new Set(['hey', 'hay', 'hi', 'hei', 'heya', 'hello', 'okay', 'ok'])
const KIWI_HEARD = new Set(['kiwi', 'kiwis', 'kiwie', 'kiwii', 'kiwee', 'kiwy', 'kewi', 'qiwi', 'quiwi', 'keewee', 'keewie', 'keywe', 'keewi'])
const wordOf = (value) => (value || '').toLowerCase().replace(/[^a-z']/g, '').replace(/'s$/, 's')
/** Words taken by "kiwi", "kee wee" or "key we" at position i, or 0 when the words there are not the wake name. */
function kiwiWords(words, i) {
  if (KIWI_HEARD.has(wordOf(words[i]))) return 1
  return words[i + 1] && KIWI_HEARD.has(wordOf(words[i]) + wordOf(words[i + 1])) ? 2 : 0
}
/** { found, openerSeen, rest }: the text after a leading "hey kiwi" (the opener is optional, as in "Kiwi, stop"). */
function leadingWake(text) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const opener = WAKE_OPENERS.has(wordOf(words[0])) ? 1 : 0
  const length = kiwiWords(words, opener)
  if (!length) return { found: false, openerSeen: false, rest: text.trim() }
  return { found: true, openerSeen: opener === 1, rest: words.slice(opener + length).join(' ').replace(/^[\s,!:.?-]+/, '') }
}
function intentOf(raw) {
  const text = leadingWake(raw).rest.trim()
    .replace(/^go (?=(?:open|find|launch|start|check)\b)/i, '').replace(/^(?:(?:can|could|would) you |please )/i, '').replace(/\s+(?:for me(?: please)?|please)[.!?]*$/i, '').replace(/[.!?]+$/, '')
    .replace(/^open(?=git\s*hub\b)/i, 'open ').replace(/\bgit\s+hub\b/gi, 'GitHub')
  if (/^(?:stop|cancel|be quiet)(?: (?:that|it|talking|listening|the task|the command|please))?[.!]?$/i.test(text)) return { type: 'stop' }
  if (/\b(?:build|create|make)\b.{0,100}\b(?:website|landing page|web page)\b/i.test(text) && /^(?:(?:open vs code and )?(?:build|create|make))\b/i.test(text)) return { type: 'build', description: text }
  const timer = text.match(/^(?:set|start) (?:a )?(\d{1,3}|[a-z]+(?:[- ][a-z]+)?)[ -](second|minute|hour)s?(?: timer)?$/i)
  if (timer && Number.isFinite(spokenNumber(timer[1]))) return { type: 'timer', seconds: spokenNumber(timer[1]) * ({ second: 1, minute: 60, hour: 3600 }[timer[2].toLowerCase()]) }
  const search = text.match(/^(?:search(?: the web)? for|google) (.{1,400})$/i)
  if (search) return { type: 'url', url: `https://www.google.com/search?q=${encodeURIComponent(search[1])}`, label: 'your search' }
  const music = text.match(/^play (.{1,300})$/i)
  if (music && !/^pause|next|previous$/i.test(music[1])) return { type: 'url', url: `https://music.youtube.com/search?q=${encodeURIComponent(music[1])}`, label: `a music search for ${music[1]}` }
  const firefoxTab = text.match(/^(?:open\s+)?(?:a\s+)?new\s+(?:tab\s+in\s+firefox|firefox\s+tab)(?:\s+(?:to|for)\s+(.+))?$/i)
  if (firefoxTab) return { type: 'firefox-tab', ...browserTarget(firefoxTab[1]) }
  if (/^(?:open|launch|start)\s+firefox\s+in\s+(?:a\s+)?new\s+tab$/i.test(text)) return { type: 'firefox-tab', ...browserTarget() }
  // Files and folders: read-only lookup in the user's own folders, and a few named apps to close.
  // "find my weather app" means open it; a file search never ends in "app".
  const findApp = text.match(/^(?:find|locate|look for|get)\s+(?:me\s+)?(?:my\s+|the\s+)?(.{2,40}?)\s+app(?:lication)?$/i)
  if (findApp) return isShellName(findApp[1]) ? { type: 'refused', message: 'I do not open shells or system tools like PowerShell, Command Prompt or the registry editor.' } : { type: 'open-named', names: [findApp[1].toLowerCase()] }
  const found = text.match(/^(?:find|locate|look for)\s+(?:my\s+|the\s+|a\s+)?(?:files?\s+|documents?\s+)?(.{1,100})$/i) || text.match(/^where(?:'s| is| are)\s+(?:my\s+|the\s+)?(.{1,100}?)(?:\s+(?:files?|documents?))?$/i)
  if (found && queryWords(found[1]).length) return { type: 'find-files', query: found[1].trim() }
  const nth = text.match(/^open\s+(?:the\s+|number\s+)?(first|second|third|fourth|fifth|[1-8])(?:\s+(?:one|result|file))?$/i)
  if (nth) return { type: 'open-found', index: ordinals[nth[1].toLowerCase()] ?? Number(nth[1]) }
  const file = text.match(/^open\s+(?:my\s+|the\s+)?(?:file|document)\s+(?!explorer\b)(.{1,100})$/i)
  if (file && queryWords(file[1]).length) return { type: 'open-file', query: file[1].trim() }
  const folder = text.match(/^(?:open|show)\s+(?:my\s+|the\s+)?(downloads|documents|desktop|pictures|videos|music|screenshots)(?:\s+folder)?$/i)
  if (folder) return { type: 'folder', name: folder[1].toLowerCase() }
  // New empty files only, in Documents, Desktop or Downloads. Never edits or overwrites anything.
  const made = text.match(/^(?:make|create|new|add)(?: me)?\s+(?:an?\s+|new\s+)*(?:(word|text|txt|markdown|md|notepad)\s+)?(?:file|document|doc|note)(?:\s+(?:called|named)\s+(.{1,60}?))?(?:\s+(?:in|on|at|to|into)\s+(?:my|the)?\s*(documents|desktop|downloads)(?:\s+folder)?)?$/i)
  if (made) return { type: 'new-file', kind: { word: 'word', text: 'text', txt: 'text', notepad: 'text', markdown: 'markdown', md: 'markdown' }[(made[1] || 'word').toLowerCase()], name: made[2]?.trim() || '', folder: (made[3] || 'documents').toLowerCase() }
  const close = text.match(/^(?:close|quit|exit)\s+(?:the\s+|my\s+)?(.{1,60}?)(?:\s+app)?$/i)
  const closing = close ? closableName(close[1].toLowerCase()) : null
  if (closing) return { type: 'close-app', app: closing }
  if (close && !isShellName(close[1])) return { type: 'refused', message: `I can only close a short list of apps (Chrome, Edge, Firefox, Discord, Spotify, Steam, Notepad, …), not “${close[1].trim()}”.` }
  // Weather: the Windows Weather app, or a web search for a named place. The place is only ever URL-encoded.
  // "check my email" opens the Mail app; Kiwi has no access to message contents.
  if (/^(?:check|open|show)\s+(?:my\s+)?(?:e-?mails?|inbox)$/i.test(text)) return { type: 'open-named', names: ['mail'] }
  const weather = text.match(/^(?:(?:open|show|check|get)(?: me)?(?: the)?|what(?:'s| is)(?: the)?|how(?:'s| is)(?: the)?|the)?\s*weather(?: like)?(?: (?:today|now|outside|right now))?(?: (?:in|for|at) ([\p{L}\p{N} '.-]{1,60}))?$/iu)
  if (weather) return { type: 'weather', place: weather[1]?.trim() || null }
  // Writing to someone: Kiwi copies the text and opens the chat app. It never types into another app or sends.
  const draft = parseDraft(text)
  if (draft) return { type: 'draft-message', to: draft.to, text: draft.text, app: 'discord' }
  const open = text.match(/^(?:open|launch|start) (.{1,200}?)[.!]?$/i)
  if (open) {
    // "in the browser" / "website" forces the web version; otherwise an installed desktop app wins.
    const webOnly = /\s+(?:in|on)\s+(?:the\s+|my\s+)?(?:browser|web)$|\s+(?:website|web version)$/i.test(open[1])
    const names = open[1].toLowerCase().replace(/^the /, '').replace(/\s+(?:in|on)\s+(?:the\s+|my\s+)?(?:browser|web)$|\s+(?:website|web version|app)$/, '').split(/\s*(?:,| and )\s*/)
    const targets = names.map((name) => (desktopApps[name] && !webOnly ? { kind: 'app', key: name } : sites[name] ? { kind: 'url', url: sites[name] } : null))
    if (targets.every(Boolean)) {
      if (targets.some((target) => target.kind === 'app')) return { type: 'launch', targets, label: names.map(displayName).join(', ') }
      return { type: 'urls', urls: targets.map((target) => target.url), label: names.map(displayName).join(', ') }
    }
    const local = names.length === 1 ? localAppName(names[0]) : null
    if (local) return { type: 'app', app: local }
    try { const url = new URL(/^https?:\/\//i.test(open[1]) ? open[1] : `https://${open[1]}`); if (url.hostname.includes('.') && !url.username && !url.password && url.protocol === 'https:') return { type: 'url', url: url.href, label: url.hostname } } catch { /* conversational request */ }
    // Anything else is a name to look up among the apps installed on this PC (resolved when it runs), never a command.
    if (names.some(isShellName)) return { type: 'refused', message: 'I do not open shells or system tools like PowerShell, Command Prompt or the registry editor.' }
    if (names.some(isVagueName)) return { type: 'clarify', message: 'Which app should I open? Say its name, for example “open Obsidian”.' }
    if (names.every((name) => /^[\p{L}\p{N}][\p{L}\p{N} &.+'’-]{1,59}$/u.test(name))) return { type: 'open-named', names: names.map(spokenAppName) }
  }
  const theme = text.match(/^(?:switch to|set|use|turn on) (?:the )?(dark|light) (?:mode|theme)[.!]?$/i)
  if (theme) return { type: 'theme', dark: theme[1].toLowerCase() === 'dark' }
  if (/^(?:turn (?:the )?volume (?:up|down)|volume (?:up|down)|mute(?: (?:the )?volume)?|(?:play|pause)(?: (?:the )?music)?|next track|previous track)[.!]?$/i.test(text)) {
    return { type: 'media', command: /volume up/i.test(text) ? 'up' : /volume down/i.test(text) ? 'down' : /mute/i.test(text) ? 'mute' : /next/i.test(text) ? 'next' : /previous/i.test(text) ? 'previous' : 'playpause' }
  }
  if (/^(?:what time is it|what is the time)[?!]?$/i.test(text)) return { type: 'time' }
  if (/^(?:what can you do|help|commands)[?!]?$/i.test(text)) return { type: 'help' }
  return { type: 'unsupported', text }
}
function verifiedVoiceText(nativeText, verifiedText) {
  const heard = leadingWake(verifiedText)
  if (/^hey\s+kiwi\b/i.test(nativeText) && !heard.found) throw new Error('I did not hear “Hey Kiwi” clearly. Please try again.')
  return verifiedText
}
/**
 * "send a message to X", "open Discord and write my friend a message", `send "hi" to this user 123 through discord`.
 * Returns the recipient (or null) and the message text (or ''), which Kiwi only ever copies to the clipboard.
 */
function parseDraft(input) {
  const text = input.replace(/^(?:open|launch|start) discord(?: and| then)\s+/i, '')
  const verb = text.match(/^(?:write|draft|compose|send|type|dm|message|text|tell)\b\s*(.*)$/i)
  if (!verb) return null
  let rest = verb[1]
  const quoted = rest.match(/["“”‘]([^"“”]{1,1000})["”’]/)
  let body = quoted ? quoted[1].trim() : ''
  if (quoted) rest = rest.replace(quoted[0], ' ')
  const said = rest.match(/\s*(?:,|:|\bsaying\b|\bthat says\b|\band say\b|\bto say\b)\s+(.{1,1000})$/i)
  if (said && !body) { body = said[1].trim(); rest = rest.slice(0, said.index) }
  rest = rest.replace(/\b(?:on|in|via|through) discord\b/gi, ' ').replace(/\s+/g, ' ').trim()
  const noun = /\b(?:message|msg|dm|text)\b/i.test(rest) || /^(?:message|dm|text|tell)$/i.test(text.split(/\s/)[0])
  const named = rest.match(/(?:^|\s)(?:to|for)\s+(?:(?:my|this|the)\s+)?(?:(?:friend|user|person|buddy)\s+)?@?([\p{L}\p{N}_.'-]{1,40})(?=$|\s|,)/iu)
    || (/^(?:dm|message|text|tell)\b/i.test(text) ? rest.match(/^(?:(?:my|this|the)\s+)?(?:(?:friend|user|person)\s+)?@?([\p{L}\p{N}_.'-]{1,40})(?=$|\s|,)/iu) : null)
    || (/^type\b/i.test(text) && !noun ? rest.match(/^@?([\p{L}\p{N}_.'-]{1,40})$/iu) : null)
  const friend = /\b(?:my|a) friend\b/i.test(rest)
  if (!noun && !named) return null
  if (!named && !friend && !noun) return null
  if (named && /^(?:a|an|my|the|this|message|msg|dm|text)$/i.test(named[1])) return friend || noun ? { to: null, text: body } : null
  return { to: named ? named[1] : null, text: body }
}

/** "my mail", "email", "weather up": tidy a spoken app name before it is looked up. */
function spokenAppName(name) {
  const tidy = name.replace(/^my\s+/i, '').replace(/\s+up$/i, '').trim()
  return /^(?:e-?mails?|mails|inbox)$/i.test(tidy) ? 'mail' : tidy
}

module.exports = { intentOf, verifiedVoiceText, leadingWake, sites }
