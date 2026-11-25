import { expect, it } from "vitest";
import type {
  SessionCarry,
  TaskDeclaration,
} from "../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import type { SessionBindingStore } from "../../../../src/contexts/telemetry/ports/bindings/session-binding-store.js";
import { type ContractSubject, describeSubject } from "./contract-subject.builder.js";

export interface SessionBindingSubject extends ContractSubject {
  readonly store: SessionBindingStore;
  /** Makes `carry` one the store holds: the port only reads carries, another writer makes them. */
  seedCarry(carry: SessionCarry): Promise<void>;
}

function declaration(overrides: Partial<TaskDeclaration> = {}): TaskDeclaration {
  return {
    task: "write the contract",
    ticket: "T-1",
    none: false,
    declared_at: "2026-10-07T10:00:00.000Z",
    by: "command",
    ...overrides,
  };
}

/** What the session binding store promises, stated once and run against every implementation. */
export function describeSessionBindingStoreContract(
  subjectName: string,
  makeSubject: () => Promise<SessionBindingSubject>
): void {
  describeSubject(`when the session binding store is ${subjectName}`, makeSubject, (subject) => {
    it("holds no declaration and no carry before the first one", async () => {
      expect(await subject().store.declarations()).toEqual([]);
      expect(await subject().store.carries()).toEqual([]);
    });

    it("answers each appended declaration with its session, in the order they were made", async () => {
      await subject().store.append("s1", declaration({ task: "first" }));
      await subject().store.append("s2", declaration({ task: "second", by: "hook-intercept" }));
      await subject().store.append("s1", declaration({ task: "third" }));

      const held = await subject().store.declarations();

      expect(held.map((entry) => [entry.session_id, entry.task, entry.by])).toEqual([
        ["s1", "first", "command"],
        ["s2", "second", "hook-intercept"],
        ["s1", "third", "command"],
      ]);
    });

    it("keeps a declaration of no task as it was made", async () => {
      const none = declaration({ task: null, ticket: null, none: true });
      await subject().store.append("s1", none);

      expect(await subject().store.declarations()).toEqual([{ session_id: "s1", ...none }]);
    });

    it("keeps the ticket and the time a declaration was made with", async () => {
      await subject().store.append("s1", declaration({ ticket: "T-2" }));

      const [held] = await subject().store.declarations();

      expect([held?.ticket, held?.declared_at]).toEqual(["T-2", "2026-10-07T10:00:00.000Z"]);
    });

    it("answers the carries it holds, apart from the declarations", async () => {
      const carry = { session_id: "s2", from: "s1", at: "2026-10-07T11:00:00.000Z" };
      await subject().seedCarry(carry);
      await subject().store.append("s1", declaration());

      expect(await subject().store.carries()).toEqual([carry]);
      expect(await subject().store.declarations()).toHaveLength(1);
    });
  });
}
