/** Where a previous read of one transcript stopped, and the file it stopped in. */
export interface TranscriptPosition {
  /** Bytes consumed: the end of the last complete line. */
  readonly offset: number;
  /** The file's size when read. */
  readonly size: number;
  /** Device and inode, or the nearest equivalent: names the file, not its path. */
  readonly identity: string;
}

export interface TranscriptStat {
  readonly size: number;
  readonly identity: string;
}

/** Where to read from. A file that shrank or changed identity is no longer the one the
 * position describes, so it is read whole. */
export function resumeOffset(
  since: TranscriptPosition | null,
  now: TranscriptStat
): { readonly offset: number; readonly restarted: boolean } {
  if (since === null) return { offset: 0, restarted: false };
  if (now.identity !== since.identity || now.size < since.size) {
    return { offset: 0, restarted: true };
  }
  return { offset: since.offset, restarted: false };
}
