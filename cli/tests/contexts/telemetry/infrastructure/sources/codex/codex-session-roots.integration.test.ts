import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codexSessionRoots } from "../../../../../../src/contexts/telemetry/infrastructure/sources/codex/codex-session-roots.js";

describe("where Codex keeps its session files", () => {
  it("is sessions/ and archived_sessions/ under CODEX_HOME when it is set", () => {
    expect(codexSessionRoots("/cfg/codex", "/home/p")).toEqual([
      join("/cfg/codex", "sessions"),
      join("/cfg/codex", "archived_sessions"),
    ]);
  });

  it("is under .codex in the home directory otherwise, an empty CODEX_HOME being none", () => {
    for (const unset of [undefined, ""]) {
      expect(codexSessionRoots(unset, "/home/p")).toEqual([
        join("/home/p", ".codex", "sessions"),
        join("/home/p", ".codex", "archived_sessions"),
      ]);
    }
  });
});
