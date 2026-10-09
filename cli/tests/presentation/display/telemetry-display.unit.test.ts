import { describe, expect, it } from "vitest";
import type { DeclareResult } from "../../../src/contexts/telemetry/application/declare-task-use-case.js";
import type { IngestResult } from "../../../src/contexts/telemetry/application/ingest-usage-use-case.js";
import type { ShowResult } from "../../../src/contexts/telemetry/application/show-task-binding-use-case.js";
import {
  printDeclareResult,
  printIdentityResult,
  printIngestResult,
  printTaskBinding,
} from "../../../src/presentation/display/telemetry-display.js";
import { CapturingOutput } from "../../helpers/ports/capturing-output.js";

function shown(result: Parameters<typeof printIdentityResult>[1]): CapturingOutput {
  const output = new CapturingOutput(false);
  printIdentityResult(output, result);
  return output;
}

describe("printIdentityResult", () => {
  it("says who the measurement names, and how to stop", () => {
    const output = shown({ status: "set", personId: "person-a" });
    expect(output.at("success")[0]).toContain('"person-a"');
    expect(output.at("success")[0]).toContain("--off");
  });

  it("says the person axis is not set when nobody is named", () => {
    expect(shown({ status: "unset" }).at("info")[0]).toContain("not set");
  });

  it("says the identity was removed", () => {
    expect(shown({ status: "removed" }).at("success")[0]).toContain("removed");
  });

  it("explains what an identity is when one is refused", () => {
    expect(shown({ status: "refused" }).at("error")[0]).toContain("one line");
  });
});

const NOT_STORED = {
  "outside-repo": 0,
  "never-seen-alive": 0,
  "no-consent": 0,
  "unreadable-consent": 0,
  "no-cwd": 0,
  undated: 0,
};
const INGESTED: IngestResult = {
  refused: false,
  filesRead: 1,
  added: 1,
  updated: 0,
  unrecognised: 0,
  skippedLedgerLines: 0,
  snapshots: 0,
  notStored: NOT_STORED,
  oldestTranscriptAt: null,
};
const linesOf = (print: (output: CapturingOutput) => void): string[] => {
  const output = new CapturingOutput(false);
  print(output);
  return output.lines;
};

describe("printIngestResult", () => {
  it("says what was read, in the singular and the plural", () => {
    expect(linesOf((o) => printIngestResult(o, INGESTED))).toEqual([
      "Read 1 transcript: 1 call added, 0 updated.",
    ]);
    expect(linesOf((o) => printIngestResult(o, { ...INGESTED, filesRead: 2, added: 3 }))).toEqual([
      "Read 2 transcripts: 3 calls added, 0 updated.",
    ]);
  });

  it("says nothing was read under AIDD_TELEMETRY=0", () => {
    expect(linesOf((o) => printIngestResult(o, { ...INGESTED, refused: true }))).toEqual([
      "AIDD_TELEMETRY=0: nothing was read and nothing was stored.",
    ]);
  });

  it("warns of shapes not recognised and ledger lines dropped, and counts snapshots", () => {
    const lines = linesOf((o) =>
      printIngestResult(o, { ...INGESTED, unrecognised: 2, skippedLedgerLines: 1, snapshots: 2 })
    );
    expect(lines).toEqual([
      "Read 1 transcript: 1 call added, 0 updated.",
      "2 shapes not recognised and not counted.",
      "1 ledger line was not a record and dropped.",
      "2 branch declarations snapshotted.",
    ]);
    expect(
      linesOf((o) =>
        printIngestResult(o, { ...INGESTED, unrecognised: 1, skippedLedgerLines: 2, snapshots: 1 })
      )
    ).toEqual([
      "Read 1 transcript: 1 call added, 0 updated.",
      "1 shape not recognised and not counted.",
      "2 ledger lines were not a record and dropped.",
      "1 branch declaration snapshotted.",
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
      "Not stored: 1 call from a project that has not opted in.",
      "Not stored: 2 calls with no usable time.",
    ]);
  });
});

describe("printDeclareResult", () => {
  const declaration = {
    task: "checkout",
    ticket: "P-1",
    none: false,
    declared_at: "",
    by: "command" as const,
  };
  const declared = (
    over: Partial<Extract<DeclareResult, { status: "declared" }>>
  ): DeclareResult => ({
    status: "declared",
    declaration,
    sessionId: "0123456789",
    branch: { status: "bound", branch: "feat/x" },
    ...over,
  });

  it("says what was declared, and what it bound", () => {
    expect(linesOf((o) => printDeclareResult(o, declared({})))).toEqual([
      'Declared task "checkout" (ticket P-1).',
      "Session 01234567 is bound from now on.",
      "Branch feat/x is bound.",
    ]);
  });

  it("says why a branch was left alone, and warns when nothing was bound", () => {
    const lines = linesOf((o) =>
      printDeclareResult(
        o,
        declared({
          sessionId: null,
          declaration: { ...declaration, task: null, ticket: null, none: true },
          branch: { status: "untouched", reason: "default-branch", branch: "main" },
        })
      )
    );
    expect(lines).toEqual([
      "Declared no task.",
      "No Claude session here: nothing was bound to a session.",
      "Branch left untouched: main is the default branch.",
      "Nothing was bound: no session and no working branch.",
    ]);
    expect(
      linesOf((o) =>
        printDeclareResult(
          o,
          declared({ branch: { status: "untouched", reason: "detached", branch: null } })
        )
      )
    ).toContain("Branch left untouched: HEAD is detached.");
  });

  it("explains each refusal", () => {
    const refusal = (reason: Extract<DeclareResult, { status: "refused" }>["reason"]) =>
      linesOf((o) => printDeclareResult(o, { status: "refused", reason }))[0];
    expect(refusal("environment")).toBe("AIDD_TELEMETRY=0: nothing was declared.");
    expect(refusal("no-consent")).toContain("has not opted in");
    expect(refusal("outside-repository")).toContain("Not inside a git repository");
    expect(refusal("unreadable-consent")).toContain("cannot be parsed");
    expect(refusal("unidentified-repository")).toContain("no remote and no commit");
  });
});

describe("printTaskBinding", () => {
  const shown = (over: Partial<Extract<ShowResult, { status: "shown" }>>): ShowResult => ({
    status: "shown",
    sessionId: "0123456789",
    branch: "feat/x",
    role: "working",
    binding: { state: "unbound" },
    ...over,
  });
  const bound = (
    source: "branch" | "session-declared" | "session-carried",
    over: { none?: boolean; task?: string | null } = {}
  ): ShowResult =>
    shown({
      binding: {
        state: "bound",
        source,
        task: over.task === undefined ? "checkout" : over.task,
        ticket: null,
        none: over.none ?? false,
        carriedFrom: "9876543210",
        declaredAt: "2026-10-09T10:00:00.000Z",
      },
    });

  it("says nothing is bound, and where", () => {
    expect(linesOf((o) => printTaskBinding(o, shown({})))[0]).toBe(
      "Nothing is bound: branch feat/x and session 01234567. Declare with `aidd telemetry task <name>`."
    );
    expect(linesOf((o) => printTaskBinding(o, shown({ sessionId: null })))[0]).toContain(
      "no session"
    );
    expect(
      linesOf((o) => printTaskBinding(o, shown({ role: "default", branch: "main" })))[0]
    ).toContain("the default branch main, which is never bound");
    expect(
      linesOf((o) => printTaskBinding(o, shown({ role: "detached", branch: null })))[0]
    ).toContain("a detached HEAD, which is never bound");
  });

  it("says what it is bound to and where that comes from", () => {
    expect(linesOf((o) => printTaskBinding(o, bound("branch")))[0]).toBe(
      'Bound to task "checkout", declared on branch feat/x at 2026-10-09T10:00:00.000Z.'
    );
    expect(linesOf((o) => printTaskBinding(o, bound("session-declared")))[0]).toBe(
      'Bound to task "checkout", declared in session 01234567 at 2026-10-09T10:00:00.000Z.'
    );
    expect(linesOf((o) => printTaskBinding(o, bound("session-carried")))[0]).toBe(
      'Bound to task "checkout", carried into session 01234567 from session 98765432.'
    );
    expect(
      linesOf((o) => printTaskBinding(o, bound("branch", { none: true, task: null })))[0]
    ).toContain("Bound to no task (declared none)");
  });

  it("explains a refusal", () => {
    expect(
      linesOf((o) => printTaskBinding(o, { status: "refused", reason: "environment" }))[0]
    ).toBe("AIDD_TELEMETRY=0: nothing was declared.");
  });
});
