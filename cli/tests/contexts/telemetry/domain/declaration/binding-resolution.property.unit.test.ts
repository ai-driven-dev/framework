import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { resolveBinding } from "../../../../../src/contexts/telemetry/domain/declaration/binding-resolution.js";
import type {
  SessionCarry,
  SessionDeclaration,
} from "../../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";

const START = Date.parse("2026-10-01T00:00:00.000Z");
const at = (minute: number) => new Date(START + minute * 60_000).toISOString();
const SESSIONS = ["s1", "s2", "s3"] as const;
const session = fc.constantFrom(...SESSIONS);

/** Declarations and carries made at distinct minutes, so no two entries tie. */
const facts = fc
  .uniqueArray(fc.integer({ min: 0, max: 600 }), { minLength: 0, maxLength: 8 })
  .chain((minutes) =>
    fc.tuple(
      ...minutes.map((minute) =>
        fc.oneof(
          fc.record({
            kind: fc.constant("declaration" as const),
            minute: fc.constant(minute),
            session: session,
            task: fc.constantFrom("t-1", "t-2", null),
          }),
          fc.record({
            kind: fc.constant("carry" as const),
            minute: fc.constant(minute),
            session: session,
            from: session,
          })
        )
      )
    )
  )
  .map((entries) => ({
    declarations: entries.flatMap((entry): SessionDeclaration[] =>
      entry.kind === "declaration"
        ? [
            {
              session_id: entry.session,
              task: entry.task,
              ticket: null,
              none: entry.task === null,
              declared_at: at(entry.minute),
              by: "command",
            },
          ]
        : []
    ),
    carries: entries.flatMap((entry): SessionCarry[] =>
      entry.kind === "carry" && entry.from !== entry.session
        ? [{ session_id: entry.session, from: entry.from, at: at(entry.minute) }]
        : []
    ),
  }));

const ask = fc.record({ sessionId: session, minute: fc.integer({ min: 0, max: 700 }) });

describe("what a session is bound to", () => {
  it("ignores every declaration and carry made after the instant asked", async () => {
    await fc.assert(
      fc.property(facts, ask, ({ declarations, carries }, { sessionId, minute }) => {
        const asked = { sessionId, at: new Date(at(minute)), branch: null };
        const later = (entry: string) => Date.parse(entry) > Date.parse(at(minute));

        const whole = resolveBinding({ ...asked, declarations, carries });
        const past = resolveBinding({
          ...asked,
          declarations: declarations.filter((entry) => !later(entry.declared_at)),
          carries: carries.filter((entry) => !later(entry.at)),
        });

        expect(whole).toEqual(past);
      })
    );
  });

  it("gives the same binding whatever order the entries were read in", async () => {
    await fc.assert(
      fc.property(facts, ask, ({ declarations, carries }, { sessionId, minute }) => {
        const asked = { sessionId, at: new Date(at(minute)), branch: null };

        expect(
          resolveBinding({
            ...asked,
            declarations: [...declarations].reverse(),
            carries: [...carries].reverse(),
          })
        ).toEqual(resolveBinding({ ...asked, declarations, carries }));
      })
    );
  });

  it("binds a session to its own latest declaration before any carry or branch", async () => {
    await fc.assert(
      fc.property(facts, ask, ({ declarations, carries }, { sessionId, minute }) => {
        const own = declarations
          .filter(
            (entry) =>
              entry.session_id === sessionId &&
              Date.parse(entry.declared_at) <= Date.parse(at(minute))
          )
          .sort((a, b) => Date.parse(a.declared_at) - Date.parse(b.declared_at))
          .at(-1);
        const branch = {
          branch: "feat/x",
          task: "from-branch",
          ticket: null,
          none: false,
          declared_at: at(0),
        };

        const binding = resolveBinding({
          sessionId,
          at: new Date(at(minute)),
          declarations,
          carries,
          branch,
        });

        if (own !== undefined) {
          expect(binding).toMatchObject({
            state: "bound",
            source: "session-declared",
            task: own.task,
          });
        }
      })
    );
  });
});
