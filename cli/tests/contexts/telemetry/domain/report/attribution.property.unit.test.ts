import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { SessionDeclaration } from "../../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import { attribute } from "../../../../../src/contexts/telemetry/domain/report/attribution.js";

const START = Date.parse("2026-10-01T00:00:00.000Z");
const at = (minute: number) => new Date(START + minute * 60_000).toISOString();
const declaration = (session: string, task: string | null, minute: number): SessionDeclaration => ({
  session_id: session,
  task,
  ticket: null,
  none: task === null,
  declared_at: at(minute),
  by: "command",
});

const declarations = fc
  .uniqueArray(fc.integer({ min: 0, max: 600 }), { maxLength: 6 })
  .chain((minutes) =>
    fc.tuple(
      ...minutes.map((minute) =>
        fc.record({
          session: fc.constantFrom("s1", "s2"),
          task: fc.constantFrom("t-1", "t-2", null),
          minute: fc.constant(minute),
        })
      )
    )
  )
  .map((entries) => entries.map(({ session, task, minute }) => declaration(session, task, minute)));

const call = fc.record({
  session_id: fc.constantFrom("s1", "s2"),
  at: fc.integer({ min: 0, max: 700 }).map(at),
  git_branch: fc.constant(null),
  repository_id: fc.constant("r-a"),
});

const noBranches = new Map();

describe("what a billed call belongs to", () => {
  it("names a task only when a declaration of its session named one", async () => {
    await fc.assert(
      fc.property(declarations, call, (declared, record) => {
        const verdict = attribute(record, {
          declarations: declared,
          carries: [],
          branches: noBranches,
        });

        if (verdict.state === "attributed") {
          expect(
            declared.some(
              (entry) =>
                entry.session_id === record.session_id &&
                entry.task === verdict.task &&
                Date.parse(entry.declared_at) <= Date.parse(record.at)
            )
          ).toBe(true);
        }
      })
    );
  });

  it("is not moved by what another session declared", async () => {
    await fc.assert(
      fc.property(declarations, call, (declared, record) => {
        const own = declared.filter((entry) => entry.session_id === record.session_id);
        const facts = (entries: readonly SessionDeclaration[]) => ({
          declarations: entries,
          carries: [],
          branches: noBranches,
        });

        expect(attribute(record, facts(declared))).toEqual(attribute(record, facts(own)));
      })
    );
  });
});
