import { describe, expect, it } from "vitest";
import type { DeclareTaskResult } from "../../../../src/contexts/telemetry/application/declaration/declare-task.use-case.js";
import type { ReadTelemetryStatusResult } from "../../../../src/contexts/telemetry/application/read-telemetry-status.use-case.js";
import {
  printDeclareResult,
  printTelemetryStatus,
} from "../../../../src/presentation/display/telemetry/telemetry-task-display.js";
import { linesOf } from "../../../shared/testing/printed-lines.builder.js";

describe("printDeclareResult", () => {
  const declaration = {
    task: "checkout",
    ticket: "P-1",
    none: false,
    declared_at: "",
    by: "command" as const,
  };
  const declared = (
    over: Partial<Extract<DeclareTaskResult, { status: "declared" }>>
  ): DeclareTaskResult => ({
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
    const refusal = (reason: Extract<DeclareTaskResult, { status: "refused" }>["reason"]) =>
      linesOf((o) => printDeclareResult(o, { status: "refused", reason }))[0];
    expect(refusal("environment")).toBe("AIDD_TELEMETRY=0: nothing was declared.");
    expect(refusal("no-consent")).toBe(
      "This clone has not opted in to measurement, so no task was declared. Run `aidd telemetry on` here first."
    );
    expect(refusal("turned-off")).toBe(
      "Measurement was turned off in this clone, so no task was declared. Run `aidd telemetry on` here to measure it again."
    );
    expect(refusal("outside-repository")).toContain("Not inside a git repository");
    expect(refusal("unreadable-consent")).toContain("cannot be read");
    expect(refusal("unidentified-repository")).toContain("no remote and no commit");
  });
});

describe("printTelemetryStatus", () => {
  const shown = (
    over: Partial<Extract<ReadTelemetryStatusResult, { status: "shown" }>>
  ): ReadTelemetryStatusResult => ({
    status: "shown",
    since: "2026-10-01T08:30:00.000Z",
    sessionId: "0123456789",
    branch: "feat/x",
    role: "working",
    binding: { state: "unbound" },
    personId: null,
    ...over,
  });
  const bound = (
    source: "branch" | "session-declared" | "session-carried",
    over: { none?: boolean; task?: string | null } = {}
  ): ReadTelemetryStatusResult =>
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

  it("says last who the measurement names, whatever the work is bound to", () => {
    for (const result of [shown({ personId: "Ada Example" }), bound("branch")]) {
      const lines = linesOf((o) => printTelemetryStatus(o, result));
      expect(lines).toHaveLength(3);
    }
    expect(linesOf((o) => printTelemetryStatus(o, shown({ personId: "Ada Example" })))[2]).toBe(
      'Measured as "Ada Example".'
    );
    expect(linesOf((o) => printTelemetryStatus(o, shown({})))[2]).toBe(
      "Measured anonymously. To be named, run `aidd telemetry identity <id>`."
    );
  });

  it("says first since when the clone is measured", () => {
    expect(linesOf((o) => printTelemetryStatus(o, shown({})))[0]).toBe(
      "This clone is measured since 2026-10-01."
    );
  });

  it("says nothing is bound, and where", () => {
    expect(linesOf((o) => printTelemetryStatus(o, shown({})))[1]).toBe(
      "Nothing is bound: branch feat/x and session 01234567. Declare with `aidd telemetry task <name>`."
    );
    expect(linesOf((o) => printTelemetryStatus(o, shown({ sessionId: null })))[1]).toContain(
      "no session"
    );
    expect(
      linesOf((o) => printTelemetryStatus(o, shown({ role: "default", branch: "main" })))[1]
    ).toContain("the default branch main, which is never bound");
    expect(
      linesOf((o) => printTelemetryStatus(o, shown({ role: "detached", branch: null })))[1]
    ).toContain("a detached HEAD, which is never bound");
  });

  it("says what it is bound to and where that comes from", () => {
    expect(linesOf((o) => printTelemetryStatus(o, bound("branch")))[1]).toBe(
      'Bound to task "checkout", declared on branch feat/x at 2026-10-09T10:00:00.000Z.'
    );
    expect(linesOf((o) => printTelemetryStatus(o, bound("session-declared")))[1]).toBe(
      'Bound to task "checkout", declared in session 01234567 at 2026-10-09T10:00:00.000Z.'
    );
    expect(linesOf((o) => printTelemetryStatus(o, bound("session-carried")))[1]).toBe(
      'Bound to task "checkout", carried into session 01234567 from session 98765432.'
    );
    expect(
      linesOf((o) => printTelemetryStatus(o, bound("branch", { none: true, task: null })))[1]
    ).toContain("Bound to no task (declared none)");
  });

  it("explains a refusal", () => {
    expect(
      linesOf((o) => printTelemetryStatus(o, { status: "refused", reason: "no-consent" }))
    ).toEqual(["Not measured: this clone has not run `aidd telemetry on`."]);
    expect(
      linesOf((o) => printTelemetryStatus(o, { status: "refused", reason: "turned-off" }))
    ).toEqual([
      "Not measured: measurement was turned off in this clone. Run `aidd telemetry on` to measure it again.",
    ]);
  });
});
