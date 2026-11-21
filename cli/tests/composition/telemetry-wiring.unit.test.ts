import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  caseInsensitiveFileSystem,
  claudeConfigDir,
  claudeProjectsRoot,
  codexSessionRoots,
  declaringSessionOf,
} from "../../src/composition/telemetry.js";

describe("which file systems answer one directory to several spellings", () => {
  it.each([
    ["darwin", true],
    ["win32", true],
    ["linux", false],
    ["freebsd", false],
  ] as const)("%s: %s", (platform, expected) => {
    expect(caseInsensitiveFileSystem(platform)).toBe(expected);
  });
});

describe("the session a declaration binds", () => {
  it.each([
    [
      "the one a hook names, over Claude Code's",
      { AIDD_TELEMETRY_SESSION_ID: "a", CLAUDE_CODE_SESSION_ID: "b" },
      "a",
    ],
    ["Claude Code's, when no hook names one", { CLAUDE_CODE_SESSION_ID: "b" }, "b"],
    [
      "Claude Code's, when the one named is empty",
      { AIDD_TELEMETRY_SESSION_ID: "", CLAUDE_CODE_SESSION_ID: "b" },
      "b",
    ],
    ["none, outside a session", {}, null],
    [
      "none, when both are empty",
      { AIDD_TELEMETRY_SESSION_ID: "", CLAUDE_CODE_SESSION_ID: "" },
      null,
    ],
  ] as const)("is %s", (_name, env, expected) => {
    expect(declaringSessionOf(env)).toBe(expected);
  });
});

describe("where Claude Code keeps its transcripts", () => {
  it("is projects/ under the configured directory when there is one", () => {
    expect(claudeProjectsRoot("/cfg/claude", "/home/p")).toBe(join("/cfg/claude", "projects"));
  });

  it("is projects/ under .claude in the home directory otherwise", () => {
    expect(claudeProjectsRoot(undefined, "/home/p")).toBe(join("/home/p", ".claude", "projects"));
  });

  it("reads an empty configured directory as none", () => {
    expect(claudeProjectsRoot("", "/home/p")).toBe(join("/home/p", ".claude", "projects"));
  });
});

describe("where Claude Code keeps its configuration", () => {
  it("is the configured directory, else .claude in the home directory", () => {
    expect(claudeConfigDir("/cfg/claude", "/home/p")).toBe("/cfg/claude");
    expect(claudeConfigDir(undefined, "/home/p")).toBe(join("/home/p", ".claude"));
    expect(claudeConfigDir("", "/home/p")).toBe(join("/home/p", ".claude"));
  });
});

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
