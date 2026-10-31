/**
 * Point at things on the page while the agent explains them: outline the element and highlight
 * keywords inside it. Uses the CSS Custom Highlight API, so React's DOM is never modified.
 * Where that API is missing the outline still works and the keywords are simply not marked.
 */
const CLASS = 'agent-spot'
const KEY = 'agent-key'

interface HighlightRegistry { set(name: string, value: unknown): void; delete(name: string): void }
const registry = (): HighlightRegistry | undefined => (CSS as unknown as { highlights?: HighlightRegistry }).highlights

export function clearSpotlight(): void {
  document.querySelectorAll(`.${CLASS}`).forEach((el) => el.classList.remove(CLASS))
  registry()?.delete(KEY)
}

function markTerms(roots: Element[], terms: string[]): void {
  const api = registry()
  const HighlightCtor = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight
  if (!api || !HighlightCtor || terms.length === 0) return
  const wanted = terms.map((t) => t.toLowerCase()).filter(Boolean)
  const ranges: Range[] = []
  for (const root of roots) {
    // React renders "24 case" as several text nodes, so search the joined text and map back to nodes.
    const nodes: { node: Text; start: number }[] = []
    let joined = ''
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      nodes.push({ node: node as Text, start: joined.length })
      joined += node.textContent ?? ''
    }
    const lower = joined.toLowerCase()
    const locate = (offset: number) => nodes.findLast((n) => n.start <= offset)
    for (const term of wanted) {
      for (let at = lower.indexOf(term); at !== -1; at = lower.indexOf(term, at + term.length)) {
        const from = locate(at)
        const to = locate(at + term.length - 1)
        if (!from || !to) continue
        const range = document.createRange()
        range.setStart(from.node, at - from.start)
        range.setEnd(to.node, at + term.length - to.start)
        ranges.push(range)
      }
    }
  }
  api.set(KEY, new HighlightCtor(...ranges)) // one registration for all elements: a second set() would replace the first
}

/** Returns false when nothing on the page matches (the step is then spoken without pointing). */
export function spotlight(selector: string, terms: string[] = []): boolean {
  clearSpotlight()
  const found = [...document.querySelectorAll(selector)]
  if (!found.length) return false
  found.forEach((el) => el.classList.add(CLASS))
  found[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
  markTerms(found, terms)
  return true
}
