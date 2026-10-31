import { afterEach, describe, expect, it, vi } from 'vitest'
import { API, answerSession, approveSession, createSession, uploadSession } from './session'

const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))

afterEach(() => vi.unstubAllGlobals())

describe('session api client', () => {
  it('POSTs to the session routes under the API base', async () => {
    const fetchMock = vi.fn(() => reply({ id: 's1' }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(createSession()).resolves.toMatchObject({ id: 's1' })
    expect(fetchMock).toHaveBeenCalledWith(`${API}/api/session`, { method: 'POST' })
  })

  it('surfaces the backend detail message on errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply({ detail: 'Unsupported file type' }, 415)))
    await expect(approveSession('s1')).rejects.toThrow('Unsupported file type')
  })

  it('falls back to the status code when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('oops', { status: 500 }))))
    await expect(approveSession('s1')).rejects.toThrow('Request failed (500)')
  })

  it('propagates network failures as TypeError so the UI can explain them', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(createSession()).rejects.toBeInstanceOf(TypeError)
  })

  it('sends answers as JSON', async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => reply({ id: 's1' }))
    vi.stubGlobal('fetch', fetchMock)
    await answerSession('s1', 'l2', 'tomato', true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API}/api/session/s1/answer`)
    expect(JSON.parse(init?.body as string)).toEqual({ line_id: 'l2', catalog_item_id: 'tomato', yes: true })
  })

  it('uploads files as multipart form fields the backend expects', async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => reply({ id: 's1' }))
    vi.stubGlobal('fetch', fetchMock)
    const po = new File(['a'], 'purchase_order.png', { type: 'image/png' })
    const dn = new File(['b'], 'delivery_note.png', { type: 'image/png' })
    await uploadSession('s1', { purchase_order: po, delivery_note: dn })
    const body = fetchMock.mock.calls[0][1]?.body as FormData
    expect((body.get('purchase_order') as File).name).toBe('purchase_order.png')
    expect((body.get('delivery_note') as File).name).toBe('delivery_note.png')
  })
})
