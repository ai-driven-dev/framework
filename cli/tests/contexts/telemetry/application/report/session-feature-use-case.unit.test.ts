import { expect, it, vi } from "vitest";
import type { IngestResult } from "../../../../../src/contexts/telemetry/application/ingest-usage-use-case.js";
import { SessionFeatureUseCase } from "../../../../../src/contexts/telemetry/application/report/session-feature-use-case.js";
import type { UsageLedger } from "../../../../../src/contexts/telemetry/domain/ports/usage-ledger.js";

it("refuses synchronization before reading the ledger when telemetry is disabled", async () => {
  const unexpected = (): never => {
    throw new Error("Unexpected read");
  };
  const exclusively = vi.fn(unexpected);
  const ledger: UsageLedger = {
    exclusively,
    leftOut: { add: unexpected, counts: unexpected },
    load: unexpected,
    save: unexpected,
    leaveOutRequestless: unexpected,
    positions: unexpected,
    savePositions: unexpected,
  };
  const refused: IngestResult = {
    refused: true,
    filesRead: 0,
    added: 0,
    updated: 0,
    unrecognised: 0,
    skippedLedgerLines: 0,
    snapshots: 0,
    notStored: {
      "outside-repo": 0,
      "never-seen-alive": 0,
      "no-consent": 0,
      "consent-closed": 0,
      "unreadable-consent": 0,
      "no-cwd": 0,
      undated: 0,
    },
    consentLogDamaged: false,
    oldestTranscriptAt: null,
  };
  const useCase = new SessionFeatureUseCase(
    { execute: async () => refused },
    ledger,
    { read: unexpected },
    { permits: unexpected }
  );

  await expect(useCase.snapshot("codex")).rejects.toThrow("telemetry is disabled");
  expect(exclusively).not.toHaveBeenCalled();
});
