/** Turn a thrown value into a message; network failures get a friendlier hint. */
export function errorMessage(error: unknown): string {
  if (error instanceof TypeError) return 'Cannot reach the backend. Is it running and is the URL correct?'
  return error instanceof Error ? error.message : 'Something went wrong'
}
