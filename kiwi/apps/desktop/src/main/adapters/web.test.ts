import { describe, expect, it } from 'vitest';
import { createWebPort, parseSearchResults, stripHtml } from './web';

const html = (body: string): Response =>
  new Response(body, { headers: { 'content-type': 'text/html' } });

describe('stripHtml', () => {
  it('drops scripts, styles and tags and decodes entities', () => {
    expect(
      stripHtml('<style>x{}</style><p>Hello &amp; <b>welcome</b></p><script>evil()</script>'),
    ).toBe('Hello & welcome');
  });
});

describe('parseSearchResults', () => {
  it('unwraps DuckDuckGo redirect links and keeps http(s) only', () => {
    const page = `
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fa.test%2Fx&amp;rut=1">A</a>
      <a class="result__a" href="//duckduckgo.com/l/?uddg=javascript%3Aalert(1)">B</a>
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fb.test">C</a>`;
    expect(parseSearchResults(page, 3)).toEqual(['https://a.test/x', 'https://b.test/']);
  });
});

describe('createWebPort', () => {
  it('fetches readable text', async () => {
    const web = createWebPort(() => Promise.resolve(html('<p>Hi there</p>')));
    expect(await web.fetchText('https://a.test')).toEqual({ ok: true, text: 'Hi there' });
  });

  it('refuses local network and non-http addresses', async () => {
    const web = createWebPort(() => Promise.reject(new Error('should not fetch')));
    expect(await web.fetchText('http://localhost:3000')).toMatchObject({ ok: false });
    expect(await web.fetchText('http://192.168.1.1/admin')).toMatchObject({ ok: false });
    expect(await web.fetchText('file:///etc/passwd')).toMatchObject({ ok: false });
  });

  it('rejects non-text content and failures', async () => {
    const binary = createWebPort(() =>
      Promise.resolve(new Response('x', { headers: { 'content-type': 'application/pdf' } })),
    );
    expect(await binary.fetchText('https://a.test/f.pdf')).toMatchObject({ ok: false });
    const down = createWebPort(() => Promise.reject(new TypeError('offline')));
    expect(await down.fetchText('https://a.test')).toMatchObject({ ok: false });
  });

  it('only fetches JSON from open-meteo', async () => {
    const web = createWebPort(() => Promise.resolve(Response.json({ a: 1 })));
    expect(await web.fetchJson('https://api.open-meteo.com/v1/forecast')).toEqual({
      ok: true,
      json: { a: 1 },
    });
    expect(await web.fetchJson('https://evil.test/data')).toMatchObject({ ok: false });
  });

  it('caps very large pages', async () => {
    const big = 'a'.repeat(3_000_000);
    const web = createWebPort(() => Promise.resolve(html(`<p>${big}</p>`)));
    const result = await web.fetchText('https://a.test');
    expect(result.ok && result.text.length < 1_100_000).toBe(true);
  });
});
