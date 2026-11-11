import { describe, expect, it } from "vitest";
import { getAllRegisteredTools } from "../../../src/contexts/tools/domain/registry.js";
import "../../../src/runtime/wiring/framework.js";

describe("the tools the real composition registers", () => {
  it("come out in alphabetical order, the order the setup and doctor flows walk them", () => {
    expect([...getAllRegisteredTools().keys()]).toEqual([
      "antigravity",
      "claude",
      "codex",
      "copilot",
      "cursor",
      "kilo",
      "opencode",
      "vscode",
    ]);
  });
});
