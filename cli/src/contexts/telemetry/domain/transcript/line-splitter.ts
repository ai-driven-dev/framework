const NEWLINE = 0x0a;

/** Receives each complete line, and whether it ends at or after the offset counting began. */
export type EachTranscriptLine = (line: string, counted: boolean) => void;

/** Cuts bytes pushed in order into complete lines, split on byte 0x0a only. A line split
 * across pushes is kept in pieces and decoded once whole: byte 0x0a is never inside a UTF-8
 * sequence, so this decodes as the whole range would. Memory is up to about three copies of the
 * longest line (its pieces, the joined bytes, the decoded string). */
export class LineSplitter {
  private pieces: Buffer[] = [];
  private at: number;
  /** The end of the last complete line. */
  consumed: number;

  constructor(
    from: number,
    private readonly countFrom: number,
    private readonly each: EachTranscriptLine
  ) {
    this.at = from;
    this.consumed = from;
  }

  push(read: Buffer): void {
    let start = 0;
    for (let end = read.indexOf(NEWLINE); end !== -1; end = read.indexOf(NEWLINE, start)) {
      const line = Buffer.concat([...this.pieces, read.subarray(start, end)]).toString("utf8");
      const counted = this.consumed >= this.countFrom;
      this.each(line.endsWith("\r") ? line.slice(0, -1) : line, counted);
      this.pieces = [];
      start = end + 1;
      this.consumed = this.at + start;
    }
    // A copy: the caller may read into the same buffer again.
    this.pieces.push(Buffer.from(read.subarray(start)));
    this.at += read.length;
  }
}
