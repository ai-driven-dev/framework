const MAGIC = 0xfd2fb528;
/** Bytes of the dictionary id, by its two-bit flag. */
const DICTIONARY_ID_BYTES = [0, 1, 2, 4] as const;
/** Bytes of the content size, by its two-bit flag; flag 0 means one byte on a single segment. */
const CONTENT_SIZE_BYTES = [0, 2, 4, 8] as const;
/** The longest header up to the end of its content size: magic 4, descriptor 1, window 1,
 * dictionary id 4, size 8. */
export const FRAME_HEADER_BYTES = 18;

/** The decompressed size the first zstd frame of `header` declares (RFC 8878, 3.1.1.1), `null`
 * when it declares none or the bytes hold no complete header. zlib is not trusted to say a
 * frame was cut: Node 22's ends one quietly, short. */
export function declaredContentSize(header: Buffer): number | null {
  if (header.length < 6 || header.readUInt32LE(0) !== MAGIC) return null;
  const descriptor = header.readUInt8(4);
  const singleSegment = (descriptor & 0b0010_0000) !== 0;
  const flag = descriptor >> 6;
  const width = flag === 0 && singleSegment ? 1 : CONTENT_SIZE_BYTES[flag];
  const at = 5 + (singleSegment ? 0 : 1) + DICTIONARY_ID_BYTES[descriptor & 0b11];
  if (width === 0 || header.length < at + width) return null;
  if (width === 1) return header.readUInt8(at);
  if (width === 2) return header.readUInt16LE(at) + 256;
  if (width === 4) return header.readUInt32LE(at);
  return Number(header.readBigUInt64LE(at));
}
