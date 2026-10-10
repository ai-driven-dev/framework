import { tryParseJson } from "../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../kernel/reading/plain-object.js";
import { compareText } from "./text-order.js";

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

function isPosition(value: unknown): value is TranscriptPosition {
  const object = asPlainObject(value);
  return (
    object !== null &&
    Number.isInteger(object.offset) &&
    (object.offset as number) >= 0 &&
    Number.isInteger(object.size) &&
    (object.size as number) >= 0 &&
    typeof object.identity === "string"
  );
}

/** Where each transcript was read up to. Text that cannot be read is no positions at all,
 * which only means every transcript is read whole: the ledger takes a call once. */
export function parsePositions(text: string | null): Map<string, TranscriptPosition> {
  const positions = new Map<string, TranscriptPosition>();
  const parsed = tryParseJson(text ?? "");
  for (const [path, position] of Object.entries(
    parsed.ok ? (asPlainObject(parsed.value) ?? {}) : {}
  )) {
    if (isPosition(position)) positions.set(path, position);
  }
  return positions;
}

export function renderPositions(positions: ReadonlyMap<string, TranscriptPosition>): string {
  const sorted = [...positions.entries()].sort(([a], [b]) => compareText(a, b));
  return `${JSON.stringify(Object.fromEntries(sorted), null, 2)}\n`;
}
