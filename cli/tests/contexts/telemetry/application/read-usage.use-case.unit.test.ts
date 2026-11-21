import { describe, expect, it } from "vitest";
import { ReadUsage } from "../../../../src/contexts/telemetry/application/read-usage.use-case.js";
import type { TranscriptPosition } from "../../../../src/contexts/telemetry/domain/transcript-position.js";
import type { UsageSource } from "../../../../src/contexts/telemetry/ports/usage-source.js";
import { aUsageRecord } from "../testing/usage-record.builder.js";

const END: TranscriptPosition = { offset: 2, size: 2, identity: "inode" };

interface Transcript {
  readonly lines: readonly (readonly [string, boolean])[];
  readonly modifiedAt?: number | null;
  readonly position?: TranscriptPosition | null;
  readonly skipped?: boolean;
  readonly unrecognised?: readonly string[];
}

/** What a tool's `decode` says of one line: `call:KEY` is a billed call, `ctx:X` sets the context
 * the next line is decoded with, `named` names a directory, `odd` is not recognised. */
function decodeLine(line: string, context: unknown) {
  if (line.startsWith("call:")) {
    const { repository_id: _, ...record } = aUsageRecord()
      .withKey(line.slice(5))
      .with({ session_id: String(context) })
      .build();
    return { records: [record], unrecognised: [] };
  }
  if (line.startsWith("ctx:")) return { records: [], unrecognised: [], context: line.slice(4) };
  if (line === "named") {
    return { records: [], unrecognised: [], named: { cwd: "/work/a", at: null } };
  }
  return { records: [], unrecognised: ["odd"] };
}

function readingOf(file: Transcript) {
  return {
    position: file.position === undefined ? END : file.position,
    restarted: false,
    skipped: file.skipped ?? false,
    modifiedAt: file.modifiedAt ?? null,
    ...(file.unrecognised ? { unrecognised: file.unrecognised } : {}),
  };
}

/** A tool whose lines say what they are, see `decodeLine`. */
function source(files: Readonly<Record<string, Transcript>>) {
  const seen: (TranscriptPosition | null)[] = [];
  const subject: UsageSource = {
    list: async () => Object.keys(files),
    read: async ({ path, since }, each) => {
      const file = files[path];
      if (file === undefined) throw new Error(`no transcript ${path}`);
      seen.push(since);
      for (const [line, counted] of file.lines) each(line, counted);
      return readingOf(file);
    },
    decode: decodeLine,
  };
  return { subject, seen };
}

const read = (files: Readonly<Record<string, Transcript>>, since = new Map()) =>
  new ReadUsage(source(files).subject).execute({ since });

describe("ReadUsage", () => {
  it("hands back each call with its file and where the file now ends", async () => {
    const reading = await read({ "/t/a": { lines: [["call:k1", true]] } });
    expect(reading.records.map((record) => record.key)).toEqual(["k1"]);
    expect([...reading.fileOf.values()]).toEqual(["/t/a"]);
    expect(reading.positions.get("/t/a")).toEqual(END);
  });

  it("decodes a line with the context the lines before it left", async () => {
    const reading = await read({
      "/t/a": {
        lines: [
          ["ctx:first", false],
          ["call:k1", true],
        ],
      },
    });
    expect(reading.records.map((record) => record.session_id)).toEqual(["first"]);
  });

  it("counts nothing from a line read again only for its context", async () => {
    const reading = await read({ "/t/a": { lines: [["call:k1", false]] } });
    expect(reading.records).toEqual([]);
  });

  it("keeps a file's old place and counts none of it when it changed under the read", async () => {
    const reading = await read({ "/t/a": { lines: [["call:k1", true]], position: null } });
    expect(reading.records).toEqual([]);
    expect(reading.positions.size).toBe(0);
  });

  it("names the file of each shape it did not recognise", async () => {
    const reading = await read({
      "/t/a": { lines: [["odd", true]], unrecognised: ["no decoder"] },
    });
    expect(reading.unrecognised).toEqual(["/t/a: odd", "/t/a: no decoder"]);
  });

  it("keeps the lines that name a directory without giving a call", async () => {
    const reading = await read({
      "/t/a": {
        lines: [
          ["named", true],
          ["call:k1", true],
        ],
      },
    });
    expect(reading.dropped).toEqual([{ line: "named", path: "/t/a", cwd: "/work/a", at: null }]);
  });

  it("reports the oldest write and the files it did not read", async () => {
    const reading = await read({
      "/t/a": { lines: [], modifiedAt: Date.parse("2026-10-02T00:00:00.000Z"), skipped: true },
      "/t/b": { lines: [], modifiedAt: Date.parse("2026-10-05T00:00:00.000Z") },
    });
    expect(reading.oldestTranscriptAt).toBe("2026-10-02T00:00:00.000Z");
    expect([...reading.skipped]).toEqual(["/t/a"]);
  });

  it("has no oldest write when no file says when it was written", async () => {
    expect((await read({ "/t/a": { lines: [] } })).oldestTranscriptAt).toBeNull();
  });

  it("starts each file where the last read stopped", async () => {
    const { subject, seen } = source({ "/t/a": { lines: [] } });
    await new ReadUsage(subject).execute({ since: new Map([["/t/a", END]]) });
    expect(seen[0]).toEqual(END);
  });
});
