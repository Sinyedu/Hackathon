import { describe, expect, it } from 'vitest'
import { isValidQuantity, normalizeQuantity } from './quantity'

describe('isValidQuantity', () => {
  it.each(['0', '24', ' 7 ', '2.5', '2,5'])('accepts %j', (text) => expect(isValidQuantity(text)).toBe(true))
  it.each(['', 'abc', '-1', '1.', '.5', '1e3', '1 2', '2,5,1'])('rejects %j', (text) => expect(isValidQuantity(text)).toBe(false))
})

describe('normalizeQuantity', () => {
  it('turns a decimal comma into a point and trims', () => expect(normalizeQuantity(' 2,5 ')).toBe('2.5'))
  it('leaves integers as strings, never numbers', () => expect(normalizeQuantity('24')).toBe('24'))
})
