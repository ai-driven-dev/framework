import { describe, expect, it } from "vitest";
import "../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import "../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import "../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import {
  type LocalCostToolReport,
  ReadLocalCostUseCase,
} from "../../../../src/contexts/telemetry/application/read-local-cost-use-case.js";
import type { RunJournal } from "../../../../src/contexts/telemetry/domain/ports/run-journal-reader.js";
import type {
  LocalCostCandidateRecord,
  SessionCostReader,
} from "../../../../src/contexts/telemetry/domain/ports/session-cost-reader.js";
import type { TelemetrySinkRecord } from "../../../../src/contexts/telemetry/domain/telemetry-sink-record.js";
import type { AiToolId } from "../../../../src/kernel/tool.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";
import { NULL_PERSON_IDENTITY_READER } from "../../../helpers/ports/in-memory-person-identity-reader.js";
import {
  InMemoryRunJournalReader,
  NULL_RUN_JOURNAL_READER,
} from "../../../helpers/ports/in-memory-run-journal-reader.js";
import { InMemoryTelemetrySink } from "../../../helpers/ports/in-memory-telemetry-sink.js";
import { StubTelemetryEvidenceReader } from "../../../helpers/ports/stub-telemetry-evidence-reader.js";

const PROJECT_ROOT = "/repo";
const SESSION_ID = "s-1";
const TURN_ID = "req_1";
const AT = new Date("2026-08-20T12:00:00Z");
const EVIDENCE_READER = new StubTelemetryEvidenceReader();

const CANDIDATE: LocalCostCandidateRecord = {
  kind: "request",
  vendor_id: SESSION_ID,
  vendor_field: "sessionId",
  turn_id: TURN_ID,
  turn_field: "requestId",
  model: "claude-sonnet-5",
  input_tokens: 10,
  output_tokens: 20,
  cache_read_tokens: 30,
  cache_creation_tokens: 40,
};

const STORED: TelemetrySinkRecord = {
  ...CANDIDATE,
  sink_schema_version: 2,
  provenance: "local-read",
  tool: "claude",
  step_attribution: "unattributed",
};

const NOT_ASKED = {
  status: "not-asked",
  recordsFound: 0,
  recordsStored: 0,
  sessionsFailed: 0,
} as const;

function notAsked(tool: AiToolId): LocalCostToolReport {
  return { tool, ...NOT_ASKED };
}

const CURSOR_NOT_COVERED: LocalCostToolReport = {
  tool: "cursor",
  status: "not-covered",
  recordsFound: 0,
  recordsStored: 0,
  sessionsFailed: 0,
  reason: "It writes no token count in any file it produces.",
};

const KILO_NOT_COVERED: LocalCostToolReport = {
  tool: "kilo",
  status: "not-covered",
  recordsFound: 0,
  recordsStored: 0,
  sessionsFailed: 0,
  reason: "Kilo telemetry has not been measured.",
};

function sessionJournal(vendorId: string, host = "claude-code"): RunJournal {
  return {
    boundaries: [],
    filesWritten: [],
    taskDeclarations: [],
    session: {
      type: "session_start",
      at: "2026-08-20T09:00:00Z",
      run_id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      tool: host,
      vendor_id: vendorId,
    },
  };
}

function journalNaming(...vendorIds: readonly string[]): InMemoryRunJournalReader {
  const reader = new InMemoryRunJournalReader();
  for (const vendorId of vendorIds) reader.set(vendorId, sessionJournal(vendorId));
  return reader;
}

type Answer = readonly LocalCostCandidateRecord[] | "absent" | Error;

function readerAnswering(answers: ReadonlyMap<string, Answer>): SessionCostReader {
  return {
    read: async (sessionId: string) => {
      const answer = answers.get(sessionId) ?? "absent";
      if (answer instanceof Error) throw answer;
      if (answer === "absent") return { records: [], sessionFound: false };
      return { records: answer, sessionFound: true };
    },
  };
}

function claudeOnly(reader: SessionCostReader): ReadonlyMap<AiToolId, SessionCostReader> {
  return new Map([["claude", reader]]);
}

async function sweep(
  readers: ReadonlyMap<AiToolId, SessionCostReader>,
  journals: InMemoryRunJournalReader | typeof NULL_RUN_JOURNAL_READER,
  sink = new InMemoryTelemetrySink()
) {
  const useCase = new ReadLocalCostUseCase(
    sink,
    readers,
    journals,
    NULL_PERSON_IDENTITY_READER,
    EVIDENCE_READER
  );
  return useCase.execute({ projectRoot: PROJECT_ROOT, env: {}, at: AT });
}

async function readOne(
  sink: InMemoryTelemetrySink,
  candidates: readonly LocalCostCandidateRecord[]
): Promise<number> {
  const result = await new ReadLocalCostUseCase(
    sink,
    claudeOnly(readerAnswering(new Map([[SESSION_ID, candidates]]))),
    NULL_RUN_JOURNAL_READER,
    NULL_PERSON_IDENTITY_READER,
    EVIDENCE_READER
  ).execute({ projectRoot: PROJECT_ROOT, env: {}, at: AT, sessionId: SESSION_ID });
  const claude = result.toolReports.find((report) => report.tool === "claude");
  if (claude === undefined) throw new Error("no claude report");
  return claude.recordsStored;
}

function claudeReport(reports: readonly LocalCostToolReport[]): LocalCostToolReport {
  const claude = reports.find((report) => report.tool === "claude");
  if (claude === undefined) throw new Error("no claude report");
  return claude;
}

describe("which sessions a sweep reads", () => {
  it("names every session the journal anchors and skips a run file that anchors none", async () => {
    const journals = journalNaming("s-a");
    journals.set("torn", { boundaries: [], filesWritten: [], taskDeclarations: [] });
    journals.set("s-b", sessionJournal("s-b"));

    const result = await sweep(claudeOnly(readerAnswering(new Map())), journals);

    expect(result.sessions.map((session) => session.sessionId)).toStrictEqual(["s-a", "s-b"]);
  });

  it("answers not-asked for every tool, and nothing more, when the journal names no session", async () => {
    const result = await sweep(claudeOnly(readerAnswering(new Map())), NULL_RUN_JOURNAL_READER);

    expect(result).toStrictEqual({
      sessions: [],
      toolReports: [
        notAsked("claude"),
        notAsked("cursor"),
        notAsked("copilot"),
        notAsked("opencode"),
        notAsked("kilo"),
        notAsked("codex"),
      ],
    });
  });

  it("states the refusal in the words a person can act on", async () => {
    const refused = new StubTelemetryEvidenceReader();
    refused.enabled = false;
    const useCase = new ReadLocalCostUseCase(
      new InMemoryTelemetrySink(),
      claudeOnly(readerAnswering(new Map([[SESSION_ID, [CANDIDATE]]]))),
      journalNaming(SESSION_ID),
      NULL_PERSON_IDENTITY_READER,
      refused
    );

    const result = await useCase.execute({ projectRoot: PROJECT_ROOT, env: {}, at: AT });

    expect(result).toStrictEqual({
      sessions: [],
      toolReports: [
        notAsked("claude"),
        notAsked("cursor"),
        notAsked("copilot"),
        notAsked("opencode"),
        notAsked("kilo"),
        notAsked("codex"),
      ],
      refusedReason:
        "measurement is refused — AIDD_TELEMETRY=0 or the project switch is off; nothing read, " +
        "nothing stored",
    });
  });
});

describe("one session's answers, tool by tool", () => {
  it("lists every tool once, in registry order, each with its own answer", async () => {
    const result = await sweep(
      claudeOnly(readerAnswering(new Map([[SESSION_ID, [CANDIDATE]]]))),
      journalNaming(SESSION_ID)
    );

    expect(result.sessions).toStrictEqual([
      {
        sessionId: SESSION_ID,
        toolReports: [
          { tool: "claude", status: "found", recordsFound: 1, recordsStored: 1, sessionsFailed: 0 },
          CURSOR_NOT_COVERED,
          notAsked("copilot"),
          notAsked("opencode"),
          KILO_NOT_COVERED,
          notAsked("codex"),
        ],
      },
    ]);
  });

  it("reports not-found, never unreadable, for a covered tool that was given no reader", async () => {
    const result = await sweep(new Map(), journalNaming(SESSION_ID));

    expect(claudeReport(result.toolReports)).toStrictEqual({
      tool: "claude",
      status: "not-found",
      recordsFound: 0,
      recordsStored: 0,
      sessionsFailed: 0,
    });
  });

  it("carries no failure field at all for a tool whose every session read cleanly", async () => {
    const result = await sweep(
      claudeOnly(readerAnswering(new Map([[SESSION_ID, [CANDIDATE]]]))),
      journalNaming(SESSION_ID)
    );

    expect(claudeReport(result.toolReports)).toStrictEqual({
      tool: "claude",
      status: "found",
      recordsFound: 1,
      recordsStored: 1,
      sessionsFailed: 0,
    });
  });
});

describe("the strongest answer a tool gave across a sweep", () => {
  it("ranks empty above not-found, whichever session came first", async () => {
    const result = await sweep(
      claudeOnly(
        readerAnswering(
          new Map<string, Answer>([
            ["s-a", "absent"],
            ["s-b", []],
          ])
        )
      ),
      journalNaming("s-a", "s-b")
    );

    expect(claudeReport(result.toolReports).status).toBe("empty");
  });

  it("ranks found above empty, so a session that billed nothing cannot hide one that did", async () => {
    const result = await sweep(
      claudeOnly(
        readerAnswering(
          new Map<string, Answer>([
            ["s-a", []],
            ["s-b", [{ ...CANDIDATE, vendor_id: "s-b" }]],
          ])
        )
      ),
      journalNaming("s-a", "s-b")
    );

    expect(claudeReport(result.toolReports)).toStrictEqual({
      tool: "claude",
      status: "found",
      recordsFound: 1,
      recordsStored: 1,
      sessionsFailed: 0,
    });
  });

  it("ranks not-found above not-asked, so a session that never asked cannot outrank one that looked", async () => {
    const journals = new InMemoryRunJournalReader();
    journals.set("s-a", sessionJournal("s-a", "codex"));
    journals.set("s-b", sessionJournal("s-b"));

    const result = await sweep(
      claudeOnly(readerAnswering(new Map<string, Answer>([["s-b", "absent"]]))),
      journals
    );

    expect(claudeReport(result.toolReports)).toStrictEqual({
      tool: "claude",
      status: "not-found",
      recordsFound: 0,
      recordsStored: 0,
      sessionsFailed: 0,
    });
  });

  it("keeps the first of two unreadable sessions as the reason and the last as the failure", async () => {
    const result = await sweep(
      claudeOnly(
        readerAnswering(
          new Map<string, Answer>([
            ["s-a", new Error("first")],
            ["s-b", new Error("second")],
          ])
        )
      ),
      journalNaming("s-a", "s-b")
    );

    expect(claudeReport(result.toolReports)).toStrictEqual({
      tool: "claude",
      status: "unreadable",
      recordsFound: 0,
      recordsStored: 0,
      sessionsFailed: 2,
      reason: "first",
      failureReason: "second",
    });
  });

  it("ranks found above unreadable and still counts the session it could not read", async () => {
    const result = await sweep(
      claudeOnly(
        readerAnswering(
          new Map<string, Answer>([
            ["s-a", new Error("boom")],
            ["s-b", [{ ...CANDIDATE, vendor_id: "s-b" }]],
          ])
        )
      ),
      journalNaming("s-a", "s-b")
    );

    expect(claudeReport(result.toolReports)).toStrictEqual({
      tool: "claude",
      status: "found",
      recordsFound: 1,
      recordsStored: 1,
      sessionsFailed: 1,
      failureReason: "boom",
    });
  });
});

describe("what counts as a correction of a stored turn", () => {
  it("stores a reading that adds a counter the stored line never had", async () => {
    const sink = new InMemoryTelemetrySink();
    const { cache_creation_tokens: _dropped, ...withoutCacheCreation } = STORED;
    await sink.appendRecord(withoutCacheCreation, AT);

    expect(await readOne(sink, [CANDIDATE])).toBe(1);
  });

  it("drops a reading that lost a counter the stored line has, however large the rest", async () => {
    const sink = new InMemoryTelemetrySink();
    await sink.appendRecord(STORED, AT);
    const { cache_read_tokens: _dropped, ...withoutCacheRead } = CANDIDATE;

    expect(await readOne(sink, [{ ...withoutCacheRead, output_tokens: 900 }])).toBe(0);
  });

  it("drops a reading that grew one counter but shrank another", async () => {
    const sink = new InMemoryTelemetrySink();
    await sink.appendRecord(STORED, AT);

    expect(await readOne(sink, [{ ...CANDIDATE, output_tokens: 900, input_tokens: 5 }])).toBe(0);
  });

  it("measures a correction against the largest stored reading, not the latest", async () => {
    const sink = new InMemoryTelemetrySink();
    await sink.appendRecord({ ...STORED, output_tokens: 900 }, AT);
    await sink.appendRecord(STORED, AT);

    expect(await readOne(sink, [{ ...CANDIDATE, output_tokens: 500 }])).toBe(0);
  });

  it("measures a correction against the largest stored reading, not the earliest", async () => {
    const sink = new InMemoryTelemetrySink();
    await sink.appendRecord(STORED, AT);
    await sink.appendRecord({ ...STORED, output_tokens: 900 }, AT);

    expect(await readOne(sink, [{ ...CANDIDATE, output_tokens: 500 }])).toBe(0);
  });

  it("measures against the earliest of two equally large stored readings", async () => {
    const sink = new InMemoryTelemetrySink();
    await sink.appendRecord(STORED, AT);
    await sink.appendRecord({ ...STORED, input_tokens: 20, output_tokens: 10 }, AT);

    expect(await readOne(sink, [{ ...CANDIDATE, output_tokens: 21 }])).toBe(1);
  });

  it("never lets a session total correct a request line that shares its turn id", async () => {
    const sink = new InMemoryTelemetrySink();
    await sink.appendRecord(STORED, AT);
    const sessionTotal: LocalCostCandidateRecord = {
      kind: "session",
      vendor_id: SESSION_ID,
      vendor_field: "sessionId",
      turn_id: TURN_ID,
      turn_field: "requestId",
      input_tokens: 100,
      output_tokens: 200,
      cache_read_tokens: 300,
      cache_creation_tokens: 400,
    };

    expect(await readOne(sink, [sessionTotal])).toBe(0);
  });

  it("drops a turn already stored from an export, without a local-read line to measure against", async () => {
    const sink = new InMemoryTelemetrySink();
    await sink.appendRecord({ ...STORED, provenance: "export" }, AT);

    expect(await readOne(sink, [{ ...CANDIDATE, output_tokens: 900 }])).toBe(0);
  });
});

class CountingSink extends InMemoryTelemetrySink {
  vendorReads = 0;
  listingFails = false;

  override async readRecordsForVendor(vendorId: string): Promise<readonly TelemetrySinkRecord[]> {
    this.vendorReads += 1;
    return super.readRecordsForVendor(vendorId);
  }

  override async listDayFiles(): Promise<readonly string[]> {
    if (this.listingFails) throw new Error("day files unlistable");
    return super.listDayFiles();
  }
}

describe("housekeeping around a sweep", () => {
  it("never consults the sink for a session whose reader returned nothing", async () => {
    const sink = new CountingSink();

    await readOne(sink, []);

    expect(sink.vendorReads).toBe(0);
  });

  it("warns, in its own words, when the day files cannot be listed, and still answers", async () => {
    const sink = new CountingSink();
    sink.listingFails = true;
    const logger = new CapturingLogger();
    const useCase = new ReadLocalCostUseCase(
      sink,
      claudeOnly(readerAnswering(new Map([[SESSION_ID, [CANDIDATE]]]))),
      journalNaming(SESSION_ID),
      NULL_PERSON_IDENTITY_READER,
      EVIDENCE_READER,
      undefined,
      logger
    );

    const result = await useCase.execute({ projectRoot: PROJECT_ROOT, env: {}, at: AT });

    expect(logger.warnMessages).toStrictEqual([
      "telemetry read: retention prune failed - day files unlistable",
    ]);
    expect(claudeReport(result.toolReports).recordsStored).toBe(1);
  });

  it("warns once per day file it could not delete, naming the file and the cause", async () => {
    const sink = new InMemoryTelemetrySink();
    for (const day of ["2026-01-01", "2026-01-02", "2026-08-20"]) {
      await sink.appendRecord(STORED, new Date(`${day}T00:00:00Z`));
    }
    sink.undeletable.add("2026-01-01.jsonl");
    const logger = new CapturingLogger();
    const useCase = new ReadLocalCostUseCase(
      sink,
      claudeOnly(readerAnswering(new Map())),
      journalNaming(SESSION_ID),
      NULL_PERSON_IDENTITY_READER,
      EVIDENCE_READER,
      undefined,
      logger,
      1
    );

    await useCase.execute({ projectRoot: PROJECT_ROOT, env: {}, at: AT });

    expect(logger.warnMessages).toStrictEqual([
      "telemetry read: could not delete 2026-01-01.jsonl - cannot delete 2026-01-01.jsonl",
    ]);
    expect(sink.deletedFiles).toStrictEqual(["2026-01-02.jsonl"]);
  });

  it("leaves a dated record unattributed when no journal exists to place it in a step", async () => {
    const sink = new InMemoryTelemetrySink();

    await readOne(sink, [{ ...CANDIDATE, event_timestamp: "2026-08-20T10:02:00Z" }]);

    const [stored] = [...sink.files.values()].flat();
    expect(stored).toMatchObject({ step_attribution: "unattributed", step: undefined });
  });
});
