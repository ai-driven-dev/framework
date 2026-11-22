import { describe, expect, it } from "vitest";
import type { IngestUsageResult } from "../../../../src/contexts/telemetry/application/ingest-usage.use-case.js";
import { printIngestResult } from "../../../../src/presentation/presenters/telemetry/telemetry-read.presenter.js";
import { CapturingOutput } from "../../../shared/testing/capturing-output.fake.js";
import { linesOf } from "../../../shared/testing/printed-lines.builder.js";

const UNRECOGNISED =
  " not recognised by this read: a call missing a counter is kept with that counter unknown; a line that is no usage line is never a call.";

const NOT_STORED = {
  "outside-repo": 0,
  "never-seen-alive": 0,
  "no-consent": 0,
  "consent-closed": 0,
  "unreadable-consent": 0,
  "no-cwd": 0,
  undated: 0,
};
const INGESTED: IngestUsageResult = {
  refused: false,
  filesRead: 1,
  added: 1,
  updated: 0,
  unrecognised: 0,
  skippedLedgerLines: 0,
  snapshots: 0,
  notStored: NOT_STORED,
  consentLogDamaged: false,
  oldestTranscriptAt: null,
};
describe("printing an ingest result", () => {
  it("says what was read, in the singular and the plural", () => {
    expect(linesOf((o) => printIngestResult(o, INGESTED))).toEqual([
      "Read 1 transcript: 1 call added, 0 updated.",
    ]);
    expect(linesOf((o) => printIngestResult(o, { ...INGESTED, filesRead: 2, added: 3 }))).toEqual([
      "Read 2 transcripts: 3 calls added, 0 updated.",
    ]);
  });

  it("groups thousands in every count of its first line", () => {
    expect(
      linesOf((o) => printIngestResult(o, { ...INGESTED, added: 1_000, updated: 2_000 }))[0]
    ).toBe("Read 1 transcript: 1,000 calls added, 2,000 updated.");
  });

  it("says nothing was read under AIDD_TELEMETRY=0", () => {
    expect(linesOf((o) => printIngestResult(o, { ...INGESTED, refused: true }))).toEqual([
      "AIDD_TELEMETRY=0: nothing was read and nothing was stored.",
    ]);
  });

  it("counts snapshots, then warns of shapes not recognised and ledger lines kept", () => {
    const lines = linesOf((o) =>
      printIngestResult(o, { ...INGESTED, unrecognised: 2, skippedLedgerLines: 1, snapshots: 2 })
    );
    expect(lines).toEqual([
      "Read 1 transcript: 1 call added, 0 updated.",
      "2 branch declarations snapshotted.",
      `2 shapes${UNRECOGNISED}`,
      "1 ledger line is not a record, kept as found.",
    ]);
    expect(
      linesOf((o) =>
        printIngestResult(o, { ...INGESTED, unrecognised: 1, skippedLedgerLines: 2, snapshots: 1 })
      )
    ).toEqual([
      "Read 1 transcript: 1 call added, 0 updated.",
      "1 branch declaration snapshotted.",
      `1 shape${UNRECOGNISED}`,
      "2 ledger lines are not a record, kept as found.",
    ]);
  });

  it("lists the calls it did not store, by reason", () => {
    const lines = linesOf((o) =>
      printIngestResult(o, {
        ...INGESTED,
        notStored: { ...NOT_STORED, "no-consent": 1, undated: 2 },
      })
    );
    expect(lines.slice(1)).toEqual([
      "Not stored by this read: 1 call from a clone with no consent at that time.",
      "Not stored by this read: 2 calls with no usable time.",
    ]);
    const output = new CapturingOutput(false);
    printIngestResult(output, {
      ...INGESTED,
      unrecognised: 1,
      notStored: { ...NOT_STORED, "no-cwd": 1 },
    });
    expect(output.at("info")).toEqual([
      "Not stored by this read: 1 call with no working directory.",
    ]);
    expect(output.at("warn")).toEqual([`1 shape${UNRECOGNISED}`]);
  });

  it("says a closed consent was closed, and never that the clone has not opted in", () => {
    const lines = linesOf((o) =>
      printIngestResult(o, {
        ...INGESTED,
        notStored: { ...NOT_STORED, "consent-closed": 1 },
      })
    );
    expect(lines.slice(1)).toEqual([
      "Not stored by this read: 1 call from a clone whose consent was closed; run `aidd telemetry on` in it to measure again.",
    ]);
    expect(lines.join("\n")).not.toContain("has not opted in");
  });

  it("warns on every run while the consent log is damaged, and names forget as the way out", () => {
    const lines = linesOf((o) => printIngestResult(o, { ...INGESTED, consentLogDamaged: true }));
    expect(lines.slice(1)).toHaveLength(1);
    expect(lines[1]).toContain("ledger/consents.jsonl");
    expect(lines[1]).toContain("`aidd telemetry forget --yes`, then `aidd telemetry on`");
    expect(lines[1]).toContain("nothing from before is stored");
    expect(lines[1]).not.toContain("remove that line");
    expect(linesOf((o) => printIngestResult(o, INGESTED))).toHaveLength(1);
  });

  it("words an unreadable consent as the git config, the git directory or the consent log", () => {
    const lines = linesOf((o) =>
      printIngestResult(o, {
        ...INGESTED,
        notStored: { ...NOT_STORED, "unreadable-consent": 1 },
      })
    );
    expect(lines.slice(1)).toEqual([
      "Not stored by this read: 1 call from a clone whose consent cannot be read: its git config, its git directory, or a damaged ledger/consents.jsonl.",
    ]);
    expect(lines.join("\n")).not.toContain("config.json");
  });

  it("warns, not informs, of a damaged consent log and of ledger lines kept", () => {
    const output = new CapturingOutput(false);
    printIngestResult(output, { ...INGESTED, consentLogDamaged: true, skippedLedgerLines: 1 });
    expect(output.at("warn")).toHaveLength(2);
    expect(output.at("info")).toEqual([]);
  });
});
