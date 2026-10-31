const QUANTITY = /^\d+(?:[.,]\d+)?$/

export function isValidQuantity(text: string): boolean {
  return QUANTITY.test(text.trim())
}

/** "2,5" -> "2.5" for the API (decimal string, never a float). */
export function normalizeQuantity(text: string): string {
  return text.trim().replace(',', '.')
}
