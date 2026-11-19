import { describe, expect, it } from "vitest";
import { antigravityAgentTools } from "../../../../../../src/contexts/tools/domain/profiles/antigravity/agent-tools.js";

describe("antigravityAgentTools", () => {
  it("grants every agy tool to an agent that declares no tools", () => {
    expect(antigravityAgentTools(null)).toEqual([
      "read_file",
      "edit_file",
      "write_file",
      "run_command",
      "manage_task",
      "search_web",
    ]);
  });

  it("maps each Claude grant to its agy tools, once each, dropping one with no equivalent", () => {
    expect(antigravityAgentTools(["Read", "Grep", "Bash", "Task"])).toEqual([
      "read_file",
      "run_command",
      "manage_task",
    ]);
  });

  it.each([
    ["Read", ["read_file"]],
    ["Glob", ["read_file"]],
    ["Grep", ["read_file"]],
    ["Edit", ["edit_file"]],
    ["MultiEdit", ["edit_file"]],
    ["Write", ["write_file"]],
    ["Bash", ["run_command", "manage_task"]],
    ["WebSearch", ["search_web"]],
    ["WebFetch", ["search_web"]],
  ])("maps a %s grant to %j", (claude, agy) => {
    expect(antigravityAgentTools([claude])).toEqual(agy);
  });

  it("orders the agy tools the same whatever the declared order", () => {
    expect(antigravityAgentTools(["WebFetch", "Write", "Bash", "Edit", "Read"])).toEqual([
      "read_file",
      "edit_file",
      "write_file",
      "run_command",
      "manage_task",
      "search_web",
    ]);
  });

  it("grants nothing when no declared tool has an agy equivalent, never the full list", () => {
    expect(antigravityAgentTools(["Task", "TodoWrite"])).toEqual([]);
  });
});
