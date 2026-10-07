/**
 * The bridge is only observable in a real translate output tree. The fixture plugin is
 * extended in a private copy of the source, never in the checked-in one other suites share.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "./helpers.js";

const execFileAsync = promisify(execFile);

const HOOK_SCRIPT = `let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  require("node:fs").appendFileSync("marker.jsonl", input + "\\n");
});\n`;

// Concatenated, since biome reads a plain string holding "${...}" as a forgotten template
// literal.
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

const IMPORT_ONLY_HARNESS =
  'import(process.argv[2]).then(() => { console.log("HOST ALIVE"); process.exit(0); })' +
  ".catch((err) => { console.error(String(err)); process.exit(1); });\n";

async function waitForFile(path: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return existsSync(path);
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
      await writeFile(harnessPath, IMPORT_ONLY_HARNESS, "utf-8");
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
         const events = [null, { type: "server.connected" },
           { type: "session.idle", properties: { sessionID: "s1" } },
           { type: "message.part.updated", properties: { sessionID: "s1", part: {
             type: "tool", tool: "Bash", state: { status: "completed", input: { command: "echo task" } }
           } } }];
         if (process.argv[3] === "v1") {
           const hooks = await plugin.server({ directory: process.argv[2] });
           for (const event of events) await hooks.event({ event });
         } else {
           const call = { sessionID: "s1", assistantMessageID: "msg1", id: "call1" };
           const stale = { ...call, id: "stale" };
           const v2Events = [null, { type: "server.connected" },
             { type: "session.tool.input.started", data: { ...stale, name: "Bash" } },
             { type: "session.tool.called", data: { ...stale, input: { command: "echo stale" }, executed: false } },
             { type: "session.execution.interrupted", data: { sessionID: "s1", reason: "shutdown" } },
             { type: "session.tool.success", data: { ...stale, content: [], executed: false } },
             { type: "session.tool.input.started", data: { ...call, name: "Bash" } },
             { type: "session.tool.called", data: { ...call, input: { command: "echo task" }, executed: false } },
             { type: "session.tool.success", data: { ...call, content: [], executed: false } },
             { type: "session.tool.success", data: { ...call, content: [], executed: false } },
             { type: "session.execution.succeeded", data: { sessionID: "s1" } }];
           let signal;
           let closed = false;
           let done;
           const processed = new Promise((resolve) => { done = resolve; });
           const cleanup = await plugin.setup({ location: { directory: process.argv[2] }, event: {
             subscribe(options) {
               signal = options.signal;
               return (async function* () {
                 try {
                   for (const event of v2Events) yield event;
                   done();
                   await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
                   throw new Error("subscription aborted");
                 } finally { closed = true; }
               })();
             }
           } });
           assert.equal(typeof cleanup, "function");
           await processed;
           cleanup();
           await new Promise((resolve) => setImmediate(resolve));
           assert.equal(signal.aborted, true);
           assert.equal(closed, true);
         }
        `,
        "utf-8"
      );
      for (const host of ["v1", "v2"]) {
        const directory = join(outDir, host);
        await mkdir(directory);
        await execFileAsync(process.execPath, [driverPath, directory, host], { timeout: 5000 });
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
          session_id: "s1",
          tool_name: "Bash",
          tool_input: { command: "echo task" },
        });
      }
    } finally {
      await cleanup();
    }
  });
});
