import { describe, expect, it } from 'vitest'
import { errorMessage } from './errors'

describe('errorMessage', () => {
  it('explains network failures (fetch throws TypeError)', () => expect(errorMessage(new TypeError('Failed to fetch'))).toMatch(/cannot reach the backend/i))
  it('passes through Error messages from the API', () => expect(errorMessage(new Error('Unsupported file type'))).toBe('Unsupported file type'))
  it('falls back for unknown values', () => expect(errorMessage('boom')).toBe('Something went wrong'))
})
