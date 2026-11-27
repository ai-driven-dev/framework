import { describe, expect, it } from "vitest";
import {
  hostToolNames,
  hostToolNamesMatching,
  matcherNamesNoToolWarning,
} from "../../../../../src/contexts/tools/domain/formats/host-tool-names.js";

const renames = new Map([
  ["Read", "read_file"],
  ["Write", "write_file"],
]);

describe("a host's tool names", () => {
  it("renames each Claude tool to the host's name, in order", () => {
    expect(hostToolNames(["Write", "Read"], renames)).toEqual(["write_file", "read_file"]);
  });

  it("drops a Claude tool the host has no name for", () => {
    expect(hostToolNames(["Read", "Task"], renames)).toEqual(["read_file"]);
  });

  it("names a host tool once when several Claude tools map to it", () => {
    expect(hostToolNames(["Write", "Write"], renames)).toEqual(["write_file"]);
  });

  it("keeps a name the caller passes through, unrenamed", () => {
    expect(hostToolNames(["mcp__x", "Read"], renames, (name) => name.startsWith("mcp__"))).toEqual([
      "mcp__x",
      "read_file",
    ]);
  });
});

describe("a host's tool names for a plugin's matcher", () => {
  const tools = new Map([
    ["Write", "write_file"],
    ["Edit", "edit_file"],
    ["Bash", "run_command"],
  ]);

  it("renames plain names split on a bar, in the matcher's order", () => {
    expect(hostToolNamesMatching("Edit|Write", tools)).toEqual(["edit_file", "write_file"]);
  });

  it("reads a name whatever its case, as the bridges read a matcher", () => {
    expect(hostToolNamesMatching("bash|EDIT", tools)).toEqual(["run_command", "edit_file"]);
  });
});

describe("the warning for a matcher naming no tool the host has", () => {
  it("names the event, the matcher and the host", () => {
    expect(matcherNamesNoToolWarning("Kiro", "PostToolUse", "Delete")).toBe(
      "PostToolUse matcher 'Delete' names no Kiro tool, group skipped"
    );
  });
});
