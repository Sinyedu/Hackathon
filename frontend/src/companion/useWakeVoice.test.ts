import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { DesktopEvent } from './desktop'

const fake = vi.hoisted(() => ({ listeners: new Set<(e: DesktopEvent) => void>(), listen: vi.fn(async () => ({ status: 'armed' })), mode: vi.fn(), caption: vi.fn() }))
vi.mock('./desktop', () => ({ desktop: { listen: fake.listen, listenMode: fake.mode, caption: fake.caption, onEvent: (callback: (event: DesktopEvent) => void) => { fake.listeners.add(callback); return () => fake.listeners.delete(callback) } } }))
import { useWakeVoice } from './useWakeVoice'
const emit = (event: DesktopEvent) => act(() => { for (const callback of fake.listeners) callback(event) })
beforeEach(() => { fake.listeners.clear(); vi.clearAllMocks() })

it('arms without a button and waits through wake-only until a verified command arrives', async () => {
  const command = vi.fn()
  const { result } = renderHook(() => useWakeVoice(true, false, command, vi.fn()))
  await waitFor(() => expect(result.current.status).toBe('armed'))
  expect(fake.listen).toHaveBeenCalledWith(true)
  expect(fake.mode).not.toHaveBeenCalled() // Do not overwrite native wake/listening state at startup.
  emit({ type: 'voice-wake' })
  expect(result.current.listening).toBe(true)
  expect(command).not.toHaveBeenCalled()
  emit({ type: 'voice-partial', text: 'what time' })
  expect(result.current.caption).toBe('what time')
  emit({ type: 'voice-processing', text: 'what time is it' })
  expect(result.current.processing).toBe(true)
  emit({ type: 'voice-final', text: 'What time is it?' })
  expect(command).toHaveBeenCalledExactlyOnceWith('What time is it?')
  expect(result.current.processing).toBe(false)
  emit({ type: 'voice-processing', text: 'an unfinished recording' })
  emit({ type: 'voice-reset' })
  expect(result.current.processing).toBe(false)
  expect(result.current.listening).toBe(false)
})

it('does not execute hypotheses; strips an addressed final and honours stop', async () => {
  const command = vi.fn(), stop = vi.fn()
  renderHook(() => useWakeVoice(true, false, command, stop))
  emit({ type: 'voice-partial', text: 'open notepad' })
  expect(command).not.toHaveBeenCalled()
  emit({ type: 'voice-final', text: 'Hey Kiwi, open notepad' })
  expect(command).toHaveBeenCalledExactlyOnceWith('open notepad')
  emit({ type: 'voice-stop' })
  expect(stop).toHaveBeenCalledOnce()
})

it('releases the listener on disable and ignores later events', async () => {
  const command = vi.fn()
  const { rerender } = renderHook(({ enabled }) => useWakeVoice(enabled, false, command, vi.fn()), { initialProps: { enabled: true } })
  rerender({ enabled: false })
  await waitFor(() => expect(fake.listen).toHaveBeenCalledWith(false))
  emit({ type: 'voice-final', text: 'open calculator' })
  expect(command).not.toHaveBeenCalled()
})
