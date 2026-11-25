import { expect, it } from "vitest";
import type { TranscriptPosition } from "../../../../src/contexts/telemetry/domain/transcript-position.js";
import type { UsageSource } from "../../../../src/contexts/telemetry/ports/usage-source.js";
import { type ContractSubject, describeSubject } from "./contract-subject.builder.js";

/** Read whatever its age. */
const EVERYTHING = Number.NEGATIVE_INFINITY;
const FIRST_SESSION = "first";
const SECOND_SESSION = "second";
const FIRST_LINES = ["line one", "line two"];
const APPENDED_LINES = ["line three", "line four"];

export interface UsageSourceSubject extends ContractSubject {
  readonly source: UsageSource;
  /** Keeps a transcript with these complete lines, in the place its tool keeps it, and returns its path. */
  write(session: string, lines: readonly string[]): Promise<string>;
  append(path: string, lines: readonly string[]): Promise<void>;
  /** Makes `path` last written at `epochMs`. */
  touch(path: string, epochMs: number): Promise<void>;
}

async function countedLines(
  source: UsageSource,
  path: string,
  since: TranscriptPosition | null,
  writtenFrom = EVERYTHING
) {
  const counted: string[] = [];
  const read = await source.read({ path, since, writtenFrom }, (line, isCounted) => {
    if (isCounted) counted.push(line);
  });
  if (read.position === null) throw new Error(`${path} changed under the read`);
  return { counted, read, position: read.position };
}

/** What a usage source promises about listing and reading transcripts, stated once and run
 * against every implementation. A tool that re-reads earlier lines to rebuild its context hands
 * them on as not counted, so only the counted lines are compared. */
export function describeUsageSourceContract(
  subjectName: string,
  makeSubject: () => Promise<UsageSourceSubject>
): void {
  describeSubject(`when the usage source is ${subjectName}`, makeSubject, (subject) => {
    it("lists nothing while the tool keeps no transcript", async () => {
      expect(await subject().source.list()).toEqual({ paths: [], unreadable: [] });
    });

    it("lists every transcript the tool keeps", async () => {
      const first = await subject().write(FIRST_SESSION, FIRST_LINES);
      const second = await subject().write(SECOND_SESSION, FIRST_LINES);

      expect([...(await subject().source.list()).paths].sort()).toEqual([first, second].sort());
    });

    it("hands over every line of a transcript read from the start, in order", async () => {
      const path = await subject().write(FIRST_SESSION, FIRST_LINES);
      const { counted, read } = await countedLines(subject().source, path, null);

      expect(counted).toEqual(FIRST_LINES);
      expect(read.skipped).toBe(false);
      expect(read.restarted).toBe(false);
    });

    it("hands over nothing when read again from the position it gave", async () => {
      const path = await subject().write(FIRST_SESSION, FIRST_LINES);
      const { position } = await countedLines(subject().source, path, null);
      const again = await countedLines(subject().source, path, position);

      expect(again.counted).toEqual([]);
    });

    it("hands over only the lines written after the position it gave", async () => {
      const path = await subject().write(FIRST_SESSION, FIRST_LINES);
      const { position } = await countedLines(subject().source, path, null);
      await subject().append(path, APPENDED_LINES);

      expect((await countedLines(subject().source, path, position)).counted).toEqual(
        APPENDED_LINES
      );
    });

    it("does not read a transcript last written before the instant it is asked to read from", async () => {
      const path = await subject().write(FIRST_SESSION, FIRST_LINES);
      const writtenAt = Date.parse("2026-10-07T10:00:00.000Z");
      await subject().touch(path, writtenAt);
      const skipped = await countedLines(subject().source, path, null, writtenAt + 1);

      expect(skipped.counted).toEqual([]);
      expect(skipped.read.skipped).toBe(true);
    });

    it("reads a transcript last written at or after the instant it is asked to read from", async () => {
      const path = await subject().write(FIRST_SESSION, FIRST_LINES);
      const writtenAt = Date.parse("2026-10-07T10:00:00.000Z");
      await subject().touch(path, writtenAt);
      const read = await countedLines(subject().source, path, null, writtenAt);

      expect(read.counted).toEqual(FIRST_LINES);
      expect(read.read.skipped).toBe(false);
    });
  });
}
