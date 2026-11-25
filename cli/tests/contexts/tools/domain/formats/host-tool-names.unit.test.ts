import { describe, expect, it } from "vitest";
import {
  hostToolNames,
  hostToolNamesMatching,
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

  it("selects each tool a regular expression matches, as Claude reads a matcher", () => {
    expect(hostToolNamesMatching("Edit.*", tools)).toEqual(["edit_file"]);
    expect(hostToolNamesMatching("^(Write|Bash)$", tools)).toEqual(["write_file", "run_command"]);
  });

  it("reads a tool's name whatever its case, as the bridges do", () => {
    expect(hostToolNamesMatching("bash|EDIT", tools)).toEqual(["run_command", "edit_file"]);
    expect(hostToolNamesMatching("edit.*", tools)).toEqual(["edit_file"]);
  });

  it("selects nothing for a regular expression no mapped tool matches", () => {
    expect(hostToolNamesMatching("mcp__.*", tools)).toEqual([]);
  });
});
