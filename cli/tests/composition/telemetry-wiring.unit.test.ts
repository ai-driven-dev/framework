import { describe, expect, it } from "vitest";
import {
  caseInsensitiveFileSystem,
  declaringSessionOf,
} from "../../src/composition/contexts/telemetry.js";

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
    ["Claude Code's", { CLAUDE_CODE_SESSION_ID: "b" }, "b"],
    ["none, outside a session", {}, null],
    ["none, when Claude Code's is empty", { CLAUDE_CODE_SESSION_ID: "" }, null],
  ] as const)("is %s", (_name, env, expected) => {
    expect(declaringSessionOf(env)).toBe(expected);
  });
});
