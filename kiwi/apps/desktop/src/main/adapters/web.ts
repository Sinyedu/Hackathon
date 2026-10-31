import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { checkUrl, type Fallible, type WebPort } from '@kiwi/core';

type FetchLike = typeof fetch;
type LookupLike = (hostname: string) => Promise<{ address: string }[]>;

const MAX_REDIRECTS = 5;
const defaultLookup: LookupLike = (hostname) => dnsLookup(hostname, { all: true });

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

const privateRanges = new BlockList();
for (const [network, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
] as const) {
  privateRanges.addSubnet(network, bits, 'ipv4');
}
for (const [network, bits] of [
  ['fc00::', 7],
  ['fe80::', 10],
  ['64:ff9b::', 96], // NAT64
] as const) {
  privateRanges.addSubnet(network, bits, 'ipv6');
}
privateRanges.addAddress('::1', 'ipv6');
privateRanges.addAddress('::', 'ipv6');

/**
 * True for loopback, private, link-local, unique-local, unspecified and NAT64 addresses. BlockList
 * converts IPv4-mapped IPv6 (::ffff:a.b.c.d or ::ffff:xxxx:xxxx) to IPv4 before checking the IPv4 ranges.
 */
export function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '');
  const family = isIP(ip);
  return family === 0 ? true : privateRanges.check(ip, family === 6 ? 'ipv6' : 'ipv4');
}

async function isPublicHost(hostname: string, lookup: LookupLike): Promise<boolean> {
  if (PRIVATE_HOST.test(hostname)) return false;
  try {
    const addresses = await lookup(hostname.replace(/^\[|\]$/g, ''));
    return addresses.length > 0 && addresses.every((entry) => !isPrivateAddress(entry.address));
  } catch {
    return false;
  }
}

/**
 * Fetches a public web address. Every redirect hop is checked again, and each hostname is resolved
 * and rejected if any answer is a private address. (A hostname that changes its answer between this
 * check and the connection, DNS rebinding, is not prevented.)
 */
async function get(
  url: string,
  fetchImpl: FetchLike,
  lookup: LookupLike,
): Promise<Fallible<{ response: Response }>> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const checked = checkUrl(current);
    if (!checked.ok) return { ok: false, message: checked.message };
    if (!(await isPublicHost(new URL(checked.value).hostname, lookup))) {
      return { ok: false, message: 'Local network addresses are not allowed.' };
    }
    let response: Response;
    try {
      response = await fetchImpl(checked.value, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'Kiwi/0.1 (+local assistant)' },
        redirect: 'manual',
      });
    } catch {
      return { ok: false, message: 'The request timed out or failed. Check your connection.' };
    }
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, checked.value).href;
      continue;
    }
    return response.ok
      ? { ok: true, response }
      : { ok: false, message: `The site answered with HTTP ${response.status}.` };
  }
  return { ok: false, message: 'The page redirected too many times.' };
}

export function createWebPort(
  fetchImpl: FetchLike = fetch,
  lookup: LookupLike = defaultLookup,
): WebPort {
  return {
    async search(query) {
      const result = await get(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        fetchImpl,
        lookup,
      );
      if (!result.ok) return result;
      const urls = parseSearchResults(await readCapped(result.response), 3);
      return urls.length > 0
        ? { ok: true, urls }
        : { ok: false, message: 'The search returned no results.' };
    },
    async fetchText(url) {
      const result = await get(url, fetchImpl, lookup);
      if (!result.ok) return result;
      const type = result.response.headers.get('content-type') ?? '';
      if (!/text\/html|text\/plain/.test(type))
        return { ok: false, message: 'That page is not readable text.' };
      return { ok: true, text: stripHtml(await readCapped(result.response)) };
    },
    async fetchJson(url) {
      if (!new URL(url).hostname.endsWith('.open-meteo.com'))
        return { ok: false, message: 'That service is not allowed.' };
      const result = await get(url, fetchImpl, lookup);
      if (!result.ok) return result;
      return { ok: true, json: (await result.response.json()) as unknown };
    },
  };
}
