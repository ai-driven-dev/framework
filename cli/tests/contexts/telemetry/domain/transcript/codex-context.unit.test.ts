import { describe, expect, it } from "vitest";
import { CodexContext } from "../../../../../src/contexts/telemetry/domain/transcript/codex-context.js";

describe("the directory of a Codex context", () => {
  it("is the latest turn's, before the session's", () => {
    expect(new CodexContext({ cwd: "/session" }, { cwd: "/turn" }).cwd).toBe("/turn");
  });

  it("is the session's when the turn names none", () => {
    expect(new CodexContext({ cwd: "/session" }, { model: "m" }).cwd).toBe("/session");
  });

  it("is unknown when neither names one, or one is empty", () => {
    expect(new CodexContext().cwd).toBeNull();
    expect(new CodexContext({ cwd: "" }, { cwd: "" }).cwd).toBeNull();
  });
});
