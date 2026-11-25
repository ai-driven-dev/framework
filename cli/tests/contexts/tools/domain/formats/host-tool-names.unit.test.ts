import { describe, expect, it } from "vitest";
import { hostToolNames } from "../../../../../src/contexts/tools/domain/formats/host-tool-names.js";

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
