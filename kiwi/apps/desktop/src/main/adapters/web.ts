import { checkUrl, type Fallible, type WebPort } from '@kiwi/core';

type FetchLike = typeof fetch;

const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_000_000;
const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|.*\.local$)/i;

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSearchResults(html: string, limit: number): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/class="result__a"[^>]*href="([^"]+)"/g)) {
    const href = (match[1] ?? '').replace(/&amp;/g, '&');
    const target = new URL(href, 'https://duckduckgo.com').searchParams.get('uddg') ?? href;
    const checked = checkUrl(target);
    if (checked.ok && !urls.includes(checked.value)) urls.push(checked.value);
    if (urls.length === limit) break;
  }
  return urls;
}

async function readCapped(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  while (bytes < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    text += decoder.decode(value, { stream: true });
  }
  await reader.cancel();
  return text.slice(0, MAX_BYTES);
}

async function get(url: string, fetchImpl: FetchLike): Promise<Fallible<{ response: Response }>> {
  const checked = checkUrl(url);
  if (!checked.ok) return { ok: false, message: checked.message };
  if (PRIVATE_HOST.test(new URL(checked.value).hostname)) {
    return { ok: false, message: 'Local network addresses are not allowed.' };
  }
  try {
    const response = await fetchImpl(checked.value, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Kiwi/0.1 (+local assistant)' },
      redirect: 'follow',
    });
    return response.ok
      ? { ok: true, response }
      : { ok: false, message: `The site answered with HTTP ${response.status}.` };
  } catch {
    return { ok: false, message: 'The request timed out or failed. Check your connection.' };
  }
}

export function createWebPort(fetchImpl: FetchLike = fetch): WebPort {
  return {
    async search(query) {
      const result = await get(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        fetchImpl,
      );
      if (!result.ok) return result;
      const urls = parseSearchResults(await readCapped(result.response), 3);
      return urls.length > 0
        ? { ok: true, urls }
        : { ok: false, message: 'The search returned no results.' };
    },
    async fetchText(url) {
      const result = await get(url, fetchImpl);
      if (!result.ok) return result;
      const type = result.response.headers.get('content-type') ?? '';
      if (!/text\/html|text\/plain/.test(type))
        return { ok: false, message: 'That page is not readable text.' };
      return { ok: true, text: stripHtml(await readCapped(result.response)) };
    },
    async fetchJson(url) {
      if (!new URL(url).hostname.endsWith('.open-meteo.com'))
        return { ok: false, message: 'That service is not allowed.' };
      const result = await get(url, fetchImpl);
      if (!result.ok) return result;
      return { ok: true, json: (await result.response.json()) as unknown };
    },
  };
}
