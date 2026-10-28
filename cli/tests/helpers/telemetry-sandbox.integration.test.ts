import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { createTelemetrySandbox } from "./telemetry-sandbox.js";

describe("the telemetry sandbox's git environment", () => {
  const saved = { claude: process.env.CLAUDE_CODE_SESSION_ID, codex: process.env.CODEX_THREAD_ID };
  afterEach(() => {
    for (const [name, value] of [
      ["CLAUDE_CODE_SESSION_ID", saved.claude],
      ["CODEX_THREAD_ID", saved.codex],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("hands a git hook no session of the process running the tests", () => {
    process.env.CLAUDE_CODE_SESSION_ID = "runner-claude-session";
    process.env.CODEX_THREAD_ID = "runner-codex-thread";
    const box = createTelemetrySandbox();
    try {
      expect(box.gitEnv.CLAUDE_CODE_SESSION_ID).toBe("");
      expect(box.gitEnv.CODEX_THREAD_ID).toBe("");
    } finally {
      rmSync(box.root, { recursive: true, force: true });
    }
  });
});
