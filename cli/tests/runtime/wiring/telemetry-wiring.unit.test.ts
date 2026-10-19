import { describe, expect, it } from "vitest";
import {
  caseInsensitiveFileSystem,
  declaringSessionOf,
} from "../../../src/runtime/wiring/telemetry.js";

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
