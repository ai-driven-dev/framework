import { parseStoredUsage, type StoredUsage, usageId } from "../stored-usage.js";
import { compareText } from "../text-order.js";
import { foldUsage } from "../usage-fold.js";

/** What one day's file holds. */
export interface DayRead {
  readonly records: readonly StoredUsage[];
  readonly skippedLines: number;
  /** A record's repository id was replaced by the one of now. */
  readonly renamed: boolean;
}

/** A day's read, with the partition it came from. */
export interface DayPart extends DayRead {
  readonly partition: string;
}

function underIdOfNow(read: StoredUsage, ids: ReadonlyMap<string, string>): StoredUsage {
  const now = ids.get(read.repository_id);
  return now === undefined ? read : { ...read, repository_id: now };
}

/** One day's file, its records under the repository ids of now. */
export function readDay(text: string, ids: ReadonlyMap<string, string>): DayRead {
  const records: StoredUsage[] = [];
  let skippedLines = 0;
  let renamed = false;
  for (const line of text.split("\n")) {
    if (line === "") continue;
    const read = parseStoredUsage(line);
    if (read === null) {
      skippedLines += 1;
      continue;
    }
    const record = underIdOfNow(read, ids);
    if (record !== read) renamed = true;
    records.push(record);
  }
  return { records, skippedLines, renamed };
}

/** The lines of a day's file that are no record, each once: kept as they are. */
export function keptLines(text: string | null): ReadonlySet<string> {
  const lines = (text ?? "").split("\n");
  return new Set(lines.filter((line) => line !== "" && parseStoredUsage(line) === null));
}

/** What a day's file holds once rewritten: its records, then the lines kept. `null` when
 * nothing is left to hold. */
export function dayContent(records: readonly StoredUsage[], kept: Iterable<string>): string | null {
  const lines = [
    ...records.map((record) => JSON.stringify(record)),
    ...[...kept].sort(compareText),
  ];
  return lines.length === 0 ? null : `${lines.join("\n")}\n`;
}

/** A call found in two days leaves both unsettled: it is rewritten to one. */
function noteRepeat(
  seen: { readonly heldIn: Map<string, string>; readonly unsettled: Set<string> },
  record: StoredUsage,
  partition: string
): void {
  const { heldIn, unsettled } = seen;
  const id = usageId(record);
  const first = heldIn.get(id);
  if (first === undefined) heldIn.set(id, partition);
  else unsettled.add(first).add(partition);
}

/** The days read, folded into one record per call, and what is wrong with them. */
export function mergeDays(parts: readonly DayPart[]): {
  readonly records: readonly StoredUsage[];
  readonly skippedLines: number;
  readonly damaged: ReadonlySet<string>;
  readonly unsettled: ReadonlySet<string>;
} {
  const found: StoredUsage[] = [];
  const damaged = new Set<string>();
  const unsettled = new Set<string>();
  const heldIn = new Map<string, string>();
  let skippedLines = 0;
  for (const part of parts) {
    skippedLines += part.skippedLines;
    if (part.skippedLines > 0) damaged.add(part.partition);
    if (part.renamed) unsettled.add(part.partition);
    for (const record of part.records) {
      found.push(record);
      noteRepeat({ heldIn, unsettled }, record, part.partition);
    }
  }
  return { records: foldUsage(found), skippedLines, damaged, unsettled };
}
