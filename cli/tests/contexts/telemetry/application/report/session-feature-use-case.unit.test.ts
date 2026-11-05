import { expect, it, vi } from "vitest";
import { DirectoryResolver } from "../../../../../src/contexts/telemetry/application/directory-resolver.js";
import type { IngestResult } from "../../../../../src/contexts/telemetry/application/ingest-usage-use-case.js";
import { ReportLedger } from "../../../../../src/contexts/telemetry/application/report/repository-uncertainty.js";
import { SessionConsent } from "../../../../../src/contexts/telemetry/application/report/session-consent.js";
import { SessionFeatureUseCase } from "../../../../../src/contexts/telemetry/application/report/session-feature-use-case.js";
import type { UsageLedger } from "../../../../../src/contexts/telemetry/domain/ports/usage-ledger.js";
import {
  cloneOf,
  FakeConsents,
  FakeLocator,
  grantedBy,
  InMemoryConsentHistory,
  InMemoryLedger,
  InMemoryResolutions,
} from "../../../../helpers/ports/in-memory-telemetry.js";

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
    new ReportLedger(ledger),
    { read: unexpected },
    { permits: unexpected }
  );

  await expect(useCase.snapshot("codex")).rejects.toThrow("telemetry is disabled");
  expect(exclusively).not.toHaveBeenCalled();
});

it("withdraws a feature after an observed origin change without losing consented usage", async () => {
  const cwd = "/work/repo";
  const clone = cloneOf(`${cwd}/.git`);
  const locator = new FakeLocator();
  const source = new FakeConsents();
  const history = new InMemoryConsentHistory();
  const ledger = new InMemoryLedger();
  let now = "2026-10-07T09:30:00.000Z";
  const repository = {
    status: "repository" as const,
    root: cwd,
    mainRoot: cwd,
    clone,
    remote: null,
    rootCommit: "repo-a",
  };
  locator.directories.set(cwd, repository);
  source.cloneSays(clone, grantedBy(clone));
  history.consented(clone, "2026-10-07T09:00:00.000Z");
  const directories = new DirectoryResolver(locator, source, new InMemoryResolutions(), history, {
    caseInsensitiveFileSystem: false,
    now: () => new Date(now),
  });
  const remembered = await directories.open();
  await remembered.resolve(cwd, now);
  await remembered.close();
  now = "2026-10-07T11:00:00.000Z";
  ledger.records = [
    {
      tool: "codex",
      tool_version: null,
      key: "request",
      session_id: "session",
      agent: "main",
      at: "2026-10-07T10:00:00.000Z",
      model: null,
      input: 42,
      output: 9,
      cache_read: null,
      cache_write: null,
      cache_write_1h: null,
      reasoning: null,
      cwd,
      git_branch: "work",
      repository_id: "repo-a",
    },
  ];
  const facts = {
    declarations: [
      {
        session_id: "session",
        task: "work",
        ticket: "owner/repo#7",
        none: false,
        declared_at: "2026-10-07T09:00:00.000Z",
        by: "command" as const,
      },
    ],
    carries: [],
    branches: new Map(),
  };
  const useCase = new SessionFeatureUseCase(
    { execute: async () => ({ refused: false }) as IngestResult },
    new ReportLedger(ledger, directories),
    { read: async () => facts },
    new SessionConsent(ledger, directories, history)
  );
  expect((await useCase.snapshot("codex")).get("session")).toMatchObject({
    repositoryId: "repo-a",
    feature: { state: "confirmed", feature: "owner/repo#7" },
  });

  now = "2026-10-07T12:00:00.000Z";
  locator.directories.set(cwd, { ...repository, rootCommit: "repo-b" });
  const admission = (await useCase.snapshot("codex")).get("session");
  expect(admission).toEqual({ cwd, repositoryId: null, feature: { state: "ambiguous" } });
  if (!admission) throw new Error("Missing session admission");
  expect(await useCase.permits(admission, "2026-10-07T10:00:00.000Z", undefined, now)).toBe(
    "allow"
  );
  expect(ledger.records[0]).toMatchObject({ input: 42, output: 9 });
});
