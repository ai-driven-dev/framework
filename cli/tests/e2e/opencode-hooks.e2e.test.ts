/**
 * What OpenCode's own loader does with a translate output tree, which is only observable in a real
 * build. The fixture plugin is extended in a private copy of the source, never in the checked-in
 * one other suites share. OpenCode's plugin loader imports every file one level under
 * `.opencode/plugin/` in-process, so a script calling `process.exit` there kills the host
 * uncatchably.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  capturedRunOf,
  capturedSample,
  captureFile,
  SESSION,
} from "../contexts/tools/testing/hook-payload-captures.builder.js";
import {
  createTestEnv,
  FRAMEWORK_PATH,
  failedRunOf,
  runCli,
} from "../shared/testing/cli-sandbox.builder.js";

const execFileAsync = promisify(execFile);

// Imports its one argument as a module in THIS process, under a non-empty `process.argv`:
// the same shape a real host provides, inherited by what the import evaluates.
const IMPORT_HARNESS =
  'import(process.argv[2]).then(() => { console.log("HOST ALIVE"); process.exit(0); })' +
  ".catch((err) => { console.error(String(err)); process.exit(1); });\n";

// A `process.exit` at module scope, no export: OpenCode's loader catches a thrown error,
// never a process exit.
const HOSTILE_SCRIPT = "(() => {\n  process.exit(1);\n})();\n";

// A well-formed OpenCode plugin module: a function export, nothing else.
const BENIGN_PLUGIN_SCRIPT = "export const OpencodePlugin = async () => ({});\n";

async function importSurvives(
  harnessPath: string,
  modulePath: string
): Promise<{ exitCode: number; stdout: string }> {
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [harnessPath, pathToFileURL(modulePath).href, "some-non-empty-argv"],
      { timeout: 5000 }
    );
    return { exitCode: 0, stdout };
  } catch (error) {
    const { stdout, code } = failedRunOf(error);
    return { exitCode: code ?? 1, stdout };
  }
}

const HOOK_SCRIPT = `let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  require("node:fs").appendFileSync("marker.jsonl", input + "\\n");
  if (JSON.parse(input).hook_event_name !== "PostToolUse") return;
  process.stderr.write("fix the edit\\n");
  process.exitCode = 2;
});\n`;

// Concatenated, since biome reads a plain string holding "${...}" as a forgotten template
// literal.
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

async function waitForFile(path: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return existsSync(path);
}

// What PostToolUse's script reads per host: V1's driver hand-builds its call, V2's is captured.
const POST_TOOL_USE = {
  v1: { tool_name: "bash", tool_input: { command: "echo task" } },
  v2: { tool_name: "bash", tool_input: { command: "echo hi" } },
};

/** What OpenCode was captured sending, as JSON for the driver: the session's creation, then its
 * idle, and a finished shell call. The creation names the folder the hooks run in, so it names
 * `directory`. */
function capturedCalls(directory: string): { events: string; shell: string } {
  const log = capturedRunOf("opencode", "log", directory);
  const shell = capturedSample<{ tool: string }>(
    captureFile("opencode-v2", "execute.after"),
    (sample) => sample.payload.tool === "shell",
    "shell call"
  );
  return {
    events: JSON.stringify([log("session.created"), log("session.idle")]),
    shell: JSON.stringify(shell.payload),
  };
}

describe("opencode's generated event bridge, against the real build", () => {
  it("imports safely and executes SessionStart, Stop and PostToolUse through V1 server and V2 setup", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("oc-hooks-bridge");
    try {
      const sourceDir = join(tempDir, "source");
      await cp(FRAMEWORK_PATH, sourceDir, { recursive: true });

      const hooksDir = join(sourceDir, "plugins", "aidd-test", "hooks");
      await writeFile(join(hooksDir, "marker.js"), HOOK_SCRIPT, "utf-8");
      await writeFile(
        join(hooksDir, "hooks.json"),
        JSON.stringify({
          hooks: {
            PreToolUse: [{ hooks: [{ type: "command", command: `${ROOT}/hooks/check.sh` }] }],
            SessionStart: [
              { hooks: [{ type: "command", command: `node ${ROOT}/hooks/marker.js` }] },
            ],
            Stop: [{ hooks: [{ type: "command", command: `node ${ROOT}/hooks/marker.js` }] }],
            PostToolUse: [
              {
                matcher: "Bash",
                hooks: [{ type: "command", command: `node ${ROOT}/hooks/marker.js` }],
              },
            ],
          },
        }),
        "utf-8"
      );

      const outDir = join(tempDir, "dist");
      await mkdir(outDir, { recursive: true });
      const build = await runCli(
        ["translate", sourceDir, "--to", "opencode", "--as", "flat", "--out", outDir],
        projectDir,
        fakeHome
      );
      expect(build.exitCode).toBe(0);

      const bridgePath = join(outDir, ".opencode", "plugin", "aidd-test-hooks.js");
      expect(existsSync(bridgePath)).toBe(true);

      // A live, non-empty argv is the shape a real host provides.
      const harnessPath = join(tempDir, "import-only.mjs");
      await writeFile(harnessPath, IMPORT_HARNESS, "utf-8");
      const { stdout } = await execFileAsync(
        process.execPath,
        [harnessPath, pathToFileURL(bridgePath).href, "some-non-empty-argv"],
        { cwd: outDir, timeout: 5000 }
      );
      expect(stdout).toContain("HOST ALIVE");
      expect(existsSync(join(outDir, "marker.jsonl"))).toBe(false);

      // Driven in its own child, so the marker file lands relative to a cwd this test
      // controls.
      const driverPath = join(tempDir, "drive-session-idle.mjs");
      await writeFile(
        driverPath,
        `import assert from "node:assert/strict";
         const { default: plugin } = await import(${JSON.stringify(pathToFileURL(bridgePath).href)});
         assert.equal(plugin.id, "aidd-test-hooks");
         const events = JSON.parse(process.argv[4]);
         if (process.argv[3] === "v1") {
           const hooks = await plugin.server({ directory: process.argv[2] });
           for (const event of events) await hooks.event({ event });
           const output = { output: "done" };
           await hooks["tool.execute.after"](
             { tool: "bash", sessionID: ${JSON.stringify(SESSION)}, args: { command: "echo task" } }, output);
           assert.equal(output.output, "done\\n\\nfix the edit");
         } else {
           const hooks = {};
           const register = (domain) => async (name, callback) => { hooks[domain + "." + name] = callback; return { dispose: async () => {} }; };
           const cleanup = await plugin.setup({
             location: { directory: process.argv[2] },
             tool: { hook: register("tool") },
             session: {
               hook: register("session"),
               get: async ({ sessionID }) => ({ id: sessionID }),
               synthetic: async () => {},
             },
           });
           assert.equal(cleanup, undefined);
           await hooks["session.prompt"]({ sessionID: ${JSON.stringify(SESSION)}, messageID: "msg1", prompt: { text: "task" } });
           const result = JSON.parse(process.argv[5]);
           await hooks["tool.execute.after"](result);
           assert.deepEqual(result.result.content.at(-1), { type: "text", text: "fix the edit" });
           await hooks["session.experimental.idle"]({ sessionID: ${JSON.stringify(SESSION)}, background: [] });
         }
        `,
        "utf-8"
      );
      for (const host of ["v1", "v2"] as const) {
        const directory = join(outDir, host);
        await mkdir(directory);
        // Only what OpenCode was captured sending: the session's creation, then its idle. The
        // creation names the folder the hooks run in, so it names this one.
        const { events, shell } = capturedCalls(directory);
        await execFileAsync(process.execPath, [driverPath, directory, host, events, shell], {
          timeout: 5000,
        });
        const marker = join(directory, "marker.jsonl");
        expect(await waitForFile(marker, 4000)).toBe(true);
        const calls = (await readFile(marker, "utf-8"))
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        expect(calls.map((call) => call.hook_event_name).sort()).toEqual([
          "PostToolUse",
          "SessionStart",
          "Stop",
        ]);
        expect(calls.every((call) => call.cwd === directory)).toBe(true);
        expect(calls.find((call) => call.hook_event_name === "PostToolUse")).toMatchObject({
          session_id: SESSION,
          ...POST_TOOL_USE[host],
        });
      }
    } finally {
      await cleanup();
    }
  });
});

describe("opencode flat build: nothing hostile lands where the loader imports it", () => {
  it("relocates a hook script out of .opencode/plugin/; whatever remains survives import with a live argv", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("oc-hooks-guard");
    try {
      const sourceDir = join(tempDir, "source");
      await cp(FRAMEWORK_PATH, sourceDir, { recursive: true });

      const hooksDir = join(sourceDir, "plugins", "aidd-test", "hooks");
      await writeFile(join(hooksDir, "hostile.js"), HOSTILE_SCRIPT, "utf-8");
      await writeFile(join(hooksDir, "opencode-plugin.js"), BENIGN_PLUGIN_SCRIPT, "utf-8");

      const harnessPath = join(tempDir, "import-harness.mjs");
      await writeFile(harnessPath, IMPORT_HARNESS, "utf-8");

      const outDir = join(tempDir, "dist");
      await mkdir(outDir, { recursive: true });
      const build = await runCli(
        ["translate", sourceDir, "--to", "opencode", "--as", "flat", "--out", outDir],
        projectDir,
        fakeHome
      );
      expect(build.exitCode).toBe(0);

      // (a) namespaced under .opencode/hooks/<plugin>/, never under .opencode/plugin/.
      expect(existsSync(join(outDir, ".opencode", "hooks", "aidd-test", "hostile.js"))).toBe(true);
      expect(existsSync(join(outDir, ".opencode", "plugin", "hostile.js"))).toBe(false);

      // (b) exactly the renamed loader entry remains, not zero files, which would make the
      // import loop below pass over nothing, and it survives import with a live argv.
      const pluginDir = join(outDir, ".opencode", "plugin");
      const remaining = existsSync(pluginDir) ? await readdir(pluginDir) : [];
      expect(remaining).toEqual(["aidd-test.js"]);

      for (const name of remaining) {
        const result = await importSurvives(harnessPath, join(pluginDir, name));
        expect(result.stdout, name).toContain("HOST ALIVE");
        expect(result.exitCode, name).toBe(0);
      }
    } finally {
      await cleanup();
    }
  });
});
