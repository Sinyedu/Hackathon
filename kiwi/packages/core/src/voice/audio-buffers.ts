export const totalLength = (chunks: Float32Array[]): number =>
  chunks.reduce((total, chunk) => total + chunk.length, 0);

export function concatFrames(chunks: Float32Array[]): Float32Array {
  const out = new Float32Array(totalLength(chunks));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
