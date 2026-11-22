import { describe, expect, it } from "vitest";
import { DeclaredBindings } from "../../../../../src/contexts/telemetry/application/report/declared-bindings.js";
import { InMemoryIdentity } from "../../testing/in-memory-identity.fake.js";
import { InMemorySessions } from "../../testing/in-memory-sessions.fake.js";
import { InMemorySnapshots } from "../../testing/in-memory-snapshots.fake.js";

describe("gathering the declared bindings", () => {
  it("gathers what people declared, wherever each kind is kept", async () => {
    const sessions = new InMemorySessions();
    await sessions.append("s1", {
      task: "Fix",
      ticket: null,
      none: false,
      declared_at: "2026-10-09T00:00:00.000Z",
      by: "command",
    });
    const identity = new InMemoryIdentity();
    identity.personId = "Ada Example";
    const { facts, person } = await new DeclaredBindings(
      sessions,
      new InMemorySnapshots(),
      identity
    ).read();
    expect(facts.declarations).toHaveLength(1);
    expect(facts.carries).toEqual([]);
    expect([...facts.branches]).toEqual([]);
    expect(person).toBe("Ada Example");
  });
});
