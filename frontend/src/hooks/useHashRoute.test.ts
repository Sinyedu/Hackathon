import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useHashRoute } from './useHashRoute'

beforeEach(() => { window.location.hash = '' })

describe('useHashRoute', () => {
  it('reads the reconciliation id from #/r/<id>', () => {
    window.location.hash = '/r/abc-123'
    expect(renderHook(() => useHashRoute()).result.current.id).toBe('abc-123')
  })

  it('is null on the scan page', () => {
    expect(renderHook(() => useHashRoute()).result.current.id).toBeNull()
  })

  it('updates the hash on open and follows hashchange events', () => {
    const { result } = renderHook(() => useHashRoute())
    act(() => result.current.open('xyz'))
    expect(window.location.hash).toBe('#/r/xyz')
    act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')) })
    expect(result.current.id).toBe('xyz')
    act(() => result.current.open(null))
    act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')) })
    expect(result.current.id).toBeNull()
  })
})
