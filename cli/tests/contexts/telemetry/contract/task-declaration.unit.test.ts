import { describe, expect, it } from "vitest";
import { DECLARED_BY } from "../../../../src/contexts/telemetry/contract/task-declaration.js";

describe("who declares a task", () => {
  it("offers each way once, spelled as a command-line choice", () => {
    expect(new Set(DECLARED_BY).size).toBe(DECLARED_BY.length);
    for (const by of DECLARED_BY) expect(by).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
  });
});
