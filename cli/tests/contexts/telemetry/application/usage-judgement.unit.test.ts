import { describe, expect, it } from "vitest";
import type { ReadUsageResult } from "../../../../src/contexts/telemetry/application/read-usage.use-case.js";
import { startResolutionRun } from "../../../../src/contexts/telemetry/application/resolution-run.js";
import { judgeReading } from "../../../../src/contexts/telemetry/application/usage-judgement.js";
import type { UsageRecord } from "../../../../src/contexts/telemetry/contract/usage-record.js";
import { ConsentLog } from "../../../../src/contexts/telemetry/domain/consent/consent-log.js";
import { RememberedResolutions } from "../../../../src/contexts/telemetry/domain/remembered-resolutions.js";
import { tokenOf } from "../testing/clone.builder.js";
import { FakeConsents } from "../testing/fake-consents.fake.js";
import { FakeLocator } from "../testing/fake-locator.fake.js";
import { A, repository } from "../testing/ingest-usage-setup.builder.js";
import { aUsageRecord } from "../testing/usage-record.builder.js";

const DIR = "/work/a";
const AT = "2026-03-01T00:00:00.000Z";

function runWith(directory: ReturnType<typeof repository> | undefined) {
  const locator = new FakeLocator();
  if (directory) locator.directories.set(DIR, directory);
  return startResolutionRun(
    {
      remembered: new RememberedResolutions(new Map()),
      consents: new ConsentLog({
        events: [{ kind: "open", token: tokenOf(A), clone: A, at: "2026-01-01T00:00:00.000Z" }],
        damaged: false,
      }),
      unreadable: new Set(),
    },
    {
      locate: (cwd) => locator.locate(cwd),
      readClone: (clone) => new FakeConsents().readClone(clone),
      environment: { caseInsensitiveFileSystem: false, now: () => new Date(AT) },
    }
  );
}

function reading(
  records: readonly UsageRecord[],
  dropped: ReadUsageResult["dropped"] = []
): ReadUsageResult {
  return {
    calls: records.map((record) => ({ record, path: "/t/1.jsonl" })),
    dropped,
    positions: new Map(),
    unrecognised: [],
    oldestTranscriptAt: null,
    skipped: new Set(),
    unreadable: [],
  };
}

describe("judging what a reading holds", () => {
  it("stores a call of a live consenting clone and notes the repository as alive", async () => {
    const call = aUsageRecord().with({ cwd: DIR, at: AT }).build();
    const verdicts = await judgeReading(runWith(repository(DIR)), reading([call]));
    expect(verdicts.toStore).toHaveLength(1);
    expect([...verdicts.live.values()]).toEqual([DIR]);
  });

  it("counts a call made nowhere under its reason", async () => {
    const call = aUsageRecord().with({ cwd: null, at: AT }).build();
    const verdicts = await judgeReading(runWith(undefined), reading([call]));
    expect(verdicts.notStored["no-cwd"]).toBe(1);
    expect(verdicts.toStore).toEqual([]);
  });

  it("leaves out a call with no day of a directory that consents, to be said in a report", async () => {
    const call = aUsageRecord().with({ cwd: DIR, at: "not a date" }).build();
    const verdicts = await judgeReading(runWith(repository(DIR)), reading([call]));
    expect(verdicts.notStored.undated).toBe(1);
    expect(verdicts.leftOut).toEqual([{ reason: "undated", of: `claude-code\u0000${call.key}` }]);
  });

  it("leaves out a line no reader recognised when its directory consents", async () => {
    const dropped = [{ line: "{?}", cwd: DIR, at: AT, path: "/t/1.jsonl" }];
    const verdicts = await judgeReading(runWith(repository(DIR)), reading([], dropped));
    expect(verdicts.leftOut).toEqual([{ reason: "unrecognised", of: "{?}" }]);
  });
});
