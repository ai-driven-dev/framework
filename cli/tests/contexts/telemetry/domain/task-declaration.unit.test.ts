import { describe, expect, it } from "vitest";
import {
  declarationOf,
  parseSessionCarry,
  parseSessionDeclaration,
  renderSessionDeclaration,
  requestOf,
  SESSION_DECLARATION_FIELDS,
} from "../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";

const NOW = new Date("2026-10-09T10:00:00.000Z");

describe("a task request", () => {
  it("trims the name and the ticket and parses neither", () => {
    expect(requestOf("  checkout-fix ", " PROJ 12 / odd ")).toEqual({
      kind: "task",
      task: "checkout-fix",
      ticket: "PROJ 12 / odd",
    });
  });

  it("has no ticket when it is blank", () => {
    expect(requestOf("t", "   ")).toEqual({ kind: "task", task: "t", ticket: null });
    expect(requestOf("t", undefined)).toEqual({ kind: "task", task: "t", ticket: null });
  });

  it("is nothing without a name", () => {
    expect(requestOf(undefined, "PROJ-1")).toBeNull();
    expect(requestOf("   ", undefined)).toBeNull();
  });
});

describe("a declaration", () => {
  it("is stamped with the moment and the declarer it was made by", () => {
    expect(
      declarationOf({ kind: "task", task: "t", ticket: "P-1" }, NOW, "hook-intercept")
    ).toEqual({
      task: "t",
      ticket: "P-1",
      none: false,
      declared_at: "2026-10-09T10:00:00.000Z",
      by: "hook-intercept",
    });
  });

  it("declares no task as none, with neither task nor ticket", () => {
    expect(declarationOf({ kind: "none" }, NOW, "command")).toEqual({
      task: null,
      ticket: null,
      none: true,
      declared_at: "2026-10-09T10:00:00.000Z",
      by: "command",
    });
  });
});

describe("a session declaration line", () => {
  const declaration = declarationOf({ kind: "task", task: "t", ticket: null }, NOW, "command");

  it("is written with the fields of the format, in order, and read back whole", () => {
    const line = renderSessionDeclaration("s-1", declaration);
    expect(Object.keys(JSON.parse(line))).toEqual([...SESSION_DECLARATION_FIELDS]);
    expect(parseSessionDeclaration(line)).toEqual({ session_id: "s-1", ...declaration });
  });

  it.each([
    ["not json", "{oops"],
    ["not an object", "[1]"],
    [
      "an extra field",
      JSON.stringify({
        session_id: "s",
        task: "t",
        ticket: null,
        none: false,
        declared_at: "2026-10-09T10:00:00.000Z",
        by: "command",
        extra: 1,
      }),
    ],
    [
      "a missing field",
      JSON.stringify({
        session_id: "s",
        task: "t",
        none: false,
        declared_at: "2026-10-09T10:00:00.000Z",
        by: "command",
      }),
    ],
    [
      "an empty session id",
      JSON.stringify({
        session_id: "",
        task: "t",
        ticket: null,
        none: false,
        declared_at: "2026-10-09T10:00:00.000Z",
        by: "command",
      }),
    ],
    [
      "a time that is not one",
      JSON.stringify({
        session_id: "s",
        task: "t",
        ticket: null,
        none: false,
        declared_at: "soon",
        by: "command",
      }),
    ],
    [
      "an unknown declarer",
      JSON.stringify({
        session_id: "s",
        task: "t",
        ticket: null,
        none: false,
        declared_at: "2026-10-09T10:00:00.000Z",
        by: "robot",
      }),
    ],
    [
      "none that is not a boolean",
      JSON.stringify({
        session_id: "s",
        task: "t",
        ticket: null,
        none: "no",
        declared_at: "2026-10-09T10:00:00.000Z",
        by: "command",
      }),
    ],
    [
      "a task that is not text",
      JSON.stringify({
        session_id: "s",
        task: 3,
        ticket: null,
        none: false,
        declared_at: "2026-10-09T10:00:00.000Z",
        by: "command",
      }),
    ],
    [
      "a ticket that is not text",
      JSON.stringify({
        session_id: "s",
        task: "t",
        ticket: 3,
        none: false,
        declared_at: "2026-10-09T10:00:00.000Z",
        by: "command",
      }),
    ],
  ])("is skipped with %s", (_name, line) => {
    expect(parseSessionDeclaration(line)).toBeNull();
  });
});

describe("a carry line", () => {
  const good = { session_id: "b", from: "a", at: "2026-10-09T10:00:00.000Z" };

  it("is read whole", () => {
    expect(parseSessionCarry(JSON.stringify(good))).toEqual(good);
  });

  it.each([
    ["not json", "nope"],
    ["an extra field", JSON.stringify({ ...good, extra: 1 })],
    ["no origin", JSON.stringify({ session_id: "b", at: good.at })],
    ["an empty origin", JSON.stringify({ ...good, from: "" })],
    ["an empty session", JSON.stringify({ ...good, session_id: "" })],
    ["an origin that is not text", JSON.stringify({ ...good, from: 7 })],
    ["a time that is not text", JSON.stringify({ ...good, at: 1760004000000 })],
    ["a field renamed", JSON.stringify({ session_id: "b", origin: "a", at: good.at })],
    ["a time that is not one", JSON.stringify({ ...good, at: "later" })],
  ])("is skipped with %s", (_name, line) => {
    expect(parseSessionCarry(line)).toBeNull();
  });
});
