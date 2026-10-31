import { describe, expect, it } from 'vitest';
import { createWebPort, isPrivateAddress, parseSearchResults, stripHtml } from './web';

const createWebPortForTest = (
  fetchImpl: typeof fetch,
  lookup = publicDns,
): ReturnType<typeof createWebPort> => createWebPort(fetchImpl, lookup);
const publicDns = (): Promise<{ address: string }[]> =>
  Promise.resolve([{ address: '93.184.216.34' }]);

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
    const web = createWebPortForTest(() => Promise.resolve(html('<p>Hi there</p>')));
    expect(await web.fetchText('https://a.test')).toEqual({ ok: true, text: 'Hi there' });
  });

  it('refuses local network and non-http addresses', async () => {
    const web = createWebPortForTest(() => Promise.reject(new Error('should not fetch')));
    expect(await web.fetchText('http://localhost:3000')).toMatchObject({ ok: false });
    expect(await web.fetchText('http://192.168.1.1/admin')).toMatchObject({ ok: false });
    expect(await web.fetchText('file:///etc/passwd')).toMatchObject({ ok: false });
  });

  it('rejects non-text content and failures', async () => {
    const binary = createWebPortForTest(() =>
      Promise.resolve(new Response('x', { headers: { 'content-type': 'application/pdf' } })),
    );
    expect(await binary.fetchText('https://a.test/f.pdf')).toMatchObject({ ok: false });
    const down = createWebPortForTest(() => Promise.reject(new TypeError('offline')));
    expect(await down.fetchText('https://a.test')).toMatchObject({ ok: false });
  });

  it('only fetches JSON from open-meteo', async () => {
    const web = createWebPortForTest(() => Promise.resolve(Response.json({ a: 1 })));
    expect(await web.fetchJson('https://api.open-meteo.com/v1/forecast')).toEqual({
      ok: true,
      json: { a: 1 },
    });
    expect(await web.fetchJson('https://evil.test/data')).toMatchObject({ ok: false });
  });

  it('caps very large pages', async () => {
    const big = 'a'.repeat(3_000_000);
    const web = createWebPortForTest(() => Promise.resolve(html(`<p>${big}</p>`)));
    const result = await web.fetchText('https://a.test');
    expect(result.ok && result.text.length < 1_100_000).toBe(true);
  });

  it('re-checks every redirect hop and refuses a redirect to a private address', async () => {
    let calls = 0;
    const web = createWebPortForTest(() => {
      calls += 1;
      return Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { location: 'http://169.254.169.254/latest/meta-data' },
        }),
      );
    });
    expect(await web.fetchText('https://a.test')).toMatchObject({ ok: false });
    expect(calls).toBe(1);
  });

  it('follows a safe redirect and stops after too many', async () => {
    const web = createWebPortForTest((url) =>
      Promise.resolve(
        (typeof url === 'string' ? url : '').endsWith('/final')
          ? html('<p>ok</p>')
          : new Response(null, { status: 301, headers: { location: '/final' } }),
      ),
    );
    expect(await web.fetchText('https://a.test/start')).toEqual({ ok: true, text: 'ok' });
    const loop = createWebPortForTest(() =>
      Promise.resolve(new Response(null, { status: 302, headers: { location: '/again' } })),
    );
    expect(await loop.fetchText('https://a.test')).toMatchObject({
      ok: false,
      message: expect.stringContaining('too many') as string,
    });
  });

  it('rejects hostnames that resolve to private addresses', async () => {
    const web = createWebPortForTest(
      () => Promise.reject(new Error('should not fetch')),
      () => Promise.resolve([{ address: '10.0.0.5' }]),
    );
    expect(await web.fetchText('https://sneaky.test')).toMatchObject({ ok: false });
    const mixed = createWebPortForTest(
      () => Promise.reject(new Error('no')),
      () => Promise.resolve([{ address: '93.184.216.34' }, { address: '::ffff:127.0.0.1' }]),
    );
    expect(await mixed.fetchText('https://mixed.test')).toMatchObject({ ok: false });
  });
});

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '192.168.0.9',
    '172.16.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:10.0.0.1',
    '0.0.0.0',
  ])('%s is private', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['93.184.216.34', '8.8.8.8', '2606:4700::1111', '172.32.0.1'])('%s is public', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});
