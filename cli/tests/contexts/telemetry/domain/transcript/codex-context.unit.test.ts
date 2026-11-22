import { describe, expect, it } from "vitest";
import { CodexContext } from "../../../../../src/contexts/telemetry/domain/transcript/codex-context.js";

describe("the directory a codex call was made in", () => {
  it("is the turn's, which is the latest word", () => {
    expect(new CodexContext({ cwd: "/session" }, { cwd: "/turn" }).cwd).toBe("/turn");
  });

  it("is the session's when the turn names none", () => {
    expect(new CodexContext({ cwd: "/session" }, { model: "m" }).cwd).toBe("/session");
  });
});
