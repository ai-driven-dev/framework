import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { cliPath } from "./helpers.js";

/**
 * Opt-in (`AGENTS_RUNTIME_SMOKE=1`): installs the four agents into a throwaway project, then
 * asks each installed host which agents it loaded. It runs the person's real, signed-in hosts,
 * so it reads their own HOME. Claude Code, Copilot and OpenCode answer without inference;
 * Cursor and Codex need one short model turn.
 */
const describeRuntime = process.env.AGENTS_RUNTIME_SMOKE === "1" ? describe : describe.skip;
const ROLES = ["aidd-dev-executor", "aidd-dev-explorer", "aidd-dev-reviewer", "aidd-dev-validator"];
const run = promisify(execFile);
const TIMEOUT = 240_000;

function installed(binary: string): boolean {
  return (process.env.PATH ?? "")
    .split(delimiter)
    .some((directory) => directory !== "" && existsSync(join(directory, binary)));
}

/** Combined output, whatever the exit code: hosts report unknown agents on stderr. Stdin is
 * closed, since `codex exec` otherwise waits for more prompt on it. */
function output(binary: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve) => {
    // OpenCode resolves its project from PWD, not the process directory.
    const env = { ...process.env, PWD: cwd };
    const child = spawn(binary, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let text = "";
    child.stdout.on("data", (chunk) => {
      text += chunk;
    });
    child.stderr.on("data", (chunk) => {
      text += chunk;
    });
    const timer = setTimeout(() => child.kill(), TIMEOUT - 10_000);
    child.on("close", () => {
      clearTimeout(timer);
      resolve(text);
    });
  });
}

async function project(ide: string, provider: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `aidd-agents-runtime-${ide}-`));
  await run("git", ["init", "-q"], { cwd: root });
  await run(
    process.execPath,
    [cliPath(), "agents", "install", "--ide", ide, "--provider", provider],
    {
      cwd: root,
    }
  );
  return root;
}

const expectAllRoles = (text: string) => {
  for (const role of ROLES) expect(text).toContain(role);
};

describeRuntime("E2E: hosts load the installed agents", () => {
  it.skipIf(!installed("claude"))(
    "Claude Code lists them for an unknown --agent",
    async () => {
      const root = await project("claude-code", "anthropic");
      expectAllRoles(await output("claude", ["-p", "ok", "--agent", "aidd-dev-unknown"], root));
    },
    TIMEOUT
  );

  it.skipIf(!installed("copilot"))(
    "Copilot lists them for an unknown --agent",
    async () => {
      const root = await project("copilot", "anthropic");
      expectAllRoles(
        await output("copilot", ["-p", "ok", "--agent", "aidd-dev-unknown", "-s"], root)
      );
    },
    TIMEOUT
  );

  it.skipIf(!installed("opencode"))(
    "OpenCode lists them through its agent API",
    async () => {
      const root = await project("opencode", "anthropic");
      const listed = await output("opencode", ["api", "agent.list"], root);
      expectAllRoles(listed);
    },
    TIMEOUT
  );

  it.skipIf(!installed("cursor-agent"))(
    "Cursor names them, unquoted, in its subagent catalog",
    async (context) => {
      const root = await project("cursor", "anthropic");
      const prompt =
        "Call the Task tool with subagent type exactly aidd-dev-unknown and prompt hi. If it errors, reply with the full error text verbatim.";
      const events = await output(
        "cursor-agent",
        ["-p", "--trust", "--output-format", "stream-json", prompt],
        root
      );
      if (events.includes("usage limit")) context.skip("Cursor account usage limit reached");
      for (const role of ROLES) expect(events).toMatch(new RegExp(`\\\\"${role}\\\\"`));
    },
    TIMEOUT
  );

  it.skipIf(!installed("codex"))(
    "Codex spawns one with the installed prompt and model",
    async () => {
      const root = await project("codex", "openai");
      const started = Date.now();
      await output(
        "codex",
        [
          "exec",
          "--skip-git-repo-check",
          "-c",
          `projects."${root}".trust_level="trusted"`,
          "Spawn exactly one agent of type aidd-dev-explorer with the task: reply ok. Then reply done.",
        ],
        root
      );
      const sessions = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "sessions");
      const rollouts: string[] = [];
      for (const entry of await readdir(sessions, { recursive: true }))
        if (entry.endsWith(".jsonl")) rollouts.push(join(sessions, entry));
      const recent = [];
      for (const path of rollouts) if ((await stat(path)).mtimeMs >= started) recent.push(path);
      const child = (await Promise.all(recent.map((path) => readFile(path, "utf8")))).find((text) =>
        text.includes('"agent_role":"aidd-dev-explorer"')
      );
      expect(child, "no Codex session ran as aidd-dev-explorer").toBeDefined();
      expect(child).toContain("Keep sources unchanged");
      expect(child).toContain('"model":"gpt-6-luna"');
    },
    TIMEOUT
  );
});
