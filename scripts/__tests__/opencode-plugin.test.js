const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const PLUGIN_SOURCE = path.resolve(
  __dirname,
  "../../plugins/aidd-telemetry/hooks/opencode-plugin.js"
);

const CLEAN_ENV = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_"))
);

// Removed when the file finishes: a suite that seeds a repository per run and never sweeps
// fills the machine's temp volume until mkdtemp itself fails with ENOSPC.
const tempDirs = [];
test.after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function makeTempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

// Mirrors what a real install delivers: OpenCode's loader scans `plugin/` one level deep, so
// the build puts this plugin's own module there alone, renamed after the plugin, and every
// other hook script under `hooks/<plugin>/` (opencode-paths.ts) - not the source tree, where
// they are siblings, so this exercises the split layout the loader actually sees.
function makeInstalledRepo() {
  const repo = makeTempDir("aidd-opencode-plugin-repo-");
  execFileSync("git", ["init", "-q"], { cwd: repo, env: CLEAN_ENV });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repo, env: CLEAN_ENV });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: repo, env: CLEAN_ENV });
  fs.mkdirSync(path.join(repo, "aidd_docs", "runs"), { recursive: true });
  fs.mkdirSync(path.join(repo, ".aidd"), { recursive: true });
  fs.writeFileSync(
    path.join(repo, ".aidd", "config.json"),
    JSON.stringify({ telemetry: { enabled: true, endpoint: "http://127.0.0.1:4318" } })
  );
  const pluginDir = path.join(repo, ".opencode", "plugin");
  const scriptsDir = path.join(repo, ".opencode", "hooks", "aidd-telemetry");
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.copyFileSync(
    path.resolve(__dirname, "../../cli/assets/configs/opencode/opencode-events.js.txt"),
    path.join(repo, ".opencode", "hooks", "opencode-events.js")
  );
  const hooksSrc = path.dirname(PLUGIN_SOURCE);
  for (const entry of fs.readdirSync(hooksSrc, { withFileTypes: true })) {
    if (entry.name === "hooks.json") continue;
    const loaderEntry = entry.name === path.basename(PLUGIN_SOURCE);
    const target = loaderEntry
      ? path.join(pluginDir, "aidd-telemetry.js")
      : path.join(scriptsDir, entry.name);
    fs.cpSync(path.join(hooksSrc, entry.name), target, { recursive: true });
  }
  // A byte-identical `.mjs` twin, for these tests alone.
  //
  // An install carries the plugin as `.js`, forced rather than chosen: OpenCode auto-discovers
  // `{plugin,plugins}/*.{ts,js}` and nothing else, and loads the file with its own runtime,
  // which does not consult Node's `type` field.
  //
  // Plain Node does consult it, and there is none to consult: nothing up this tree declares
  // one, so Node reaches the file as typeless, finds ESM syntax, and reparses. Naming the
  // extension explicitly is what these tests do instead, and it is the only difference.
  const esmTwin = path.join(pluginDir, "aidd-telemetry.mjs");
  fs.copyFileSync(path.join(pluginDir, "aidd-telemetry.js"), esmTwin);
  return { repo, pluginDir, esmTwin };
}

function runsDirOf(repo) {
  return path.join(repo, "aidd_docs", "runs");
}

function readRunLines(repo) {
  const dir = runsDirOf(repo);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  return files.flatMap((f) =>
    fs
      .readFileSync(path.join(dir, f), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l))
  );
}

test("opencode-plugin.js: runJournal spawns journal.cjs by an absolute filesystem path, not a file:// URL string", async () => {
  // `spawnSync("node", [new URL(...)])` stringifies the URL to "file:///...", which node's
  // CLI resolves as a bare module specifier against its own cwd and dies with
  // MODULE_NOT_FOUND. journal.cjs then never runs, and its "exit 0 no matter what" contract
  // hides the spawn failure entirely.
  const { repo, esmTwin } = makeInstalledRepo();
  const mod = await import(pathToFileURL(esmTwin).href);

  const hooks = await mod.AiddTelemetry({ directory: repo });
  await hooks.event({
    event: {
      type: "session.created",
      properties: { info: { id: "ses_test1234567890", directory: repo } },
    },
  });

  const lines = readRunLines(repo);
  assert.equal(lines.length, 1, "expected one session_start line written by journal.cjs");
  assert.equal(lines[0].type, "session_start");
  assert.equal(lines[0].tool, "opencode");
  assert.equal(lines[0].vendor_id, "ses_test1234567890");
});

test("opencode-plugin.js: session.idle writes turn_end for the session session.created named", async () => {
  const { repo, esmTwin } = makeInstalledRepo();
  const mod = await import(pathToFileURL(esmTwin).href);

  const hooks = await mod.AiddTelemetry({ directory: repo });
  await hooks.event({
    event: {
      type: "session.created",
      properties: { info: { id: "ses_test_idle", directory: repo } },
    },
  });
  await hooks.event({
    event: { type: "session.idle", properties: { sessionID: "ses_test_idle" } },
  });

  const lines = readRunLines(repo);
  assert.deepEqual(
    lines.map((l) => l.type),
    ["session_start", "turn_end"]
  );
});

test("opencode-plugin.js: an event whose own shape breaks journal call resolution never reaches OpenCode as a thrown error", async () => {
  const { repo, esmTwin } = makeInstalledRepo();
  const mod = await import(pathToFileURL(esmTwin).href);

  const hooks = await mod.AiddTelemetry({ directory: repo });

  // `event: null` is not a shape any fixture or the SDK's own types describe - exactly the
  // kind of malformed input the plugin's own event handler must swallow rather than throw
  // into OpenCode's in-process event loop.
  await assert.doesNotReject(hooks.event({ event: null }));
  assert.deepEqual(readRunLines(repo), [], "a swallowed error must write no journal line either");
});

test("opencode-plugin.js: default server preserves V1 journal writes", async () => {
  const { repo, esmTwin } = makeInstalledRepo();
  const { default: plugin } = await import(pathToFileURL(esmTwin).href);

  assert.equal(plugin.id, "aidd-telemetry");
  assert.deepEqual(readRunLines(repo), []);
  const hooks = await plugin.server({ directory: repo });
  await hooks.event({
    event: { type: "session.idle", properties: { sessionID: "ses_default_v1" } },
  });

  assert.deepEqual(
    readRunLines(repo).map((line) => line.type),
    ["session_start", "turn_end"]
  );
});

test("opencode-plugin.js: V2 setup returns promptly, handles raw events and cancels its stream", {
  timeout: 5000,
}, async () => {
  const { repo, esmTwin } = makeInstalledRepo();
  const { default: plugin } = await import(pathToFileURL(esmTwin).href);
  let signal;
  let streamClosed = false;
  const cleanup = await plugin.setup({
    location: { directory: repo },
    event: {
      subscribe(options) {
        signal = options.signal;
        return (async function* () {
          try {
            yield null;
            yield { type: "server.connected" };
            yield {
              type: "session.created",
              data: { sessionID: "ses_default_v2", location: { directory: repo } },
            };
            const call = { sessionID: "ses_default_v2", assistantMessageID: "msg_1", id: "call_1" };
            const failed = { ...call, id: "call_failed" };
            yield { type: "session.tool.input.started", data: { ...failed, name: "read" } };
            yield {
              type: "session.tool.called",
              data: {
                ...failed,
                input: { path: "aidd_docs/tasks/2026_10/failed/plan.md" },
                executed: false,
              },
            };
            yield { type: "session.tool.failed", data: { ...failed, error: "read failed" } };
            yield {
              type: "session.tool.success",
              data: { ...failed, content: [], executed: false },
            };
            yield { type: "session.tool.input.started", data: { ...call, name: "read" } };
            yield {
              type: "session.tool.called",
              data: {
                ...call,
                input: { path: "aidd_docs/tasks/2026_10/plugin-loading/plan.md" },
                executed: false,
              },
            };
            yield {
              type: "session.tool.success",
              data: { ...call, content: [{ type: "text", text: "task" }], executed: false },
            };
            yield {
              type: "session.tool.success",
              data: { ...call, content: [{ type: "text", text: "task" }], executed: false },
            };
            yield { type: "session.execution.succeeded", data: { sessionID: "ses_default_v2" } };
            await new Promise((resolve) =>
              signal.addEventListener("abort", resolve, { once: true })
            );
            throw new Error("subscription aborted");
          } finally {
            streamClosed = true;
          }
        })();
      },
    },
  });

  assert.equal(typeof cleanup, "function");
  for (let attempt = 0; attempt < 100 && readRunLines(repo).length < 3; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const lines = readRunLines(repo);
  assert.deepEqual(
    lines.map((line) => line.type),
    ["session_start", "task_declared", "turn_end"]
  );
  assert.equal(lines[0].vendor_id, "ses_default_v2");
  assert.equal(lines[1].path, "aidd_docs/tasks/2026_10/plugin-loading/plan.md");
  cleanup();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(signal.aborted, true);
  assert.equal(streamClosed, true);
});

test("opencode-plugin.js: a failed V2 subscription never rejects into the host", async () => {
  const { repo, esmTwin } = makeInstalledRepo();
  const { default: plugin } = await import(pathToFileURL(esmTwin).href);
  let signal;
  const cleanup = await plugin.setup({
    location: { directory: repo },
    event: {
      subscribe: async function* (options) {
        signal = options.signal;
        yield { type: "server.connected" };
        throw new Error("stream unavailable");
      },
    },
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(signal.aborted, true);
  cleanup();
  assert.deepEqual(readRunLines(repo), []);
});

test("opencode-plugin.js: V2 failed and interrupted turns end on their own session, shutdown leaves it resumable", async () => {
  for (const [type, reason, expected] of [
    ["session.execution.failed", undefined, ["session_start", "turn_end"]],
    ["session.execution.interrupted", "user", ["session_start", "turn_end"]],
    ["session.execution.interrupted", "shutdown", ["session_start"]],
  ]) {
    const { repo, esmTwin } = makeInstalledRepo();
    const { default: plugin } = await import(pathToFileURL(esmTwin).href);
    let done;
    const streamed = new Promise((resolve) => {
      done = resolve;
    });
    const cleanup = await plugin.setup({
      location: { directory: repo },
      event: {
        subscribe: async function* () {
          yield {
            type: "session.created",
            data: { sessionID: "ses_child", location: { directory: repo } },
          };
          const call = {
            sessionID: "ses_child",
            assistantMessageID: "msg_pending",
            id: "call_pending",
          };
          yield { type: "session.tool.input.started", data: { ...call, name: "read" } };
          yield {
            type: "session.tool.called",
            data: {
              ...call,
              input: { path: "aidd_docs/tasks/2026_10/stale/plan.md" },
              executed: false,
            },
          };
          yield { type, data: { sessionID: "ses_child", reason, error: "tool failed" } };
          yield { type: "session.tool.success", data: { ...call, content: [], executed: false } };
          done();
        },
      },
    });
    await streamed;
    cleanup();
    const lines = readRunLines(repo);
    assert.deepEqual(
      lines.map((line) => line.type),
      expected
    );
    assert.equal(lines[0].vendor_id, "ses_child");
  }
});
