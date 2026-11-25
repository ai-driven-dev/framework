#!/usr/bin/env node
/**
 * Re-runs, by hand, what the committed hook-payload fixtures were captured from, and says per
 * host and moment whether the host still sends the same shape (keys and types, never values).
 *
 *   node scripts/refresh-hook-fixtures.cjs [--host claude,kiro] [--model host=id] [--write]
 *
 * Local and opt-in: it calls real hosts under your own login and spends their quota, so no
 * workflow runs it. Each host runs headless in a throwaway project under a throwaway directory,
 * with a hook that only records its stdin. Fixtures are left alone unless `--write` is given, and
 * even then a payload is only added as a new sample, never replacing one.
 *
 * Exit codes:
 *   0  every moment run still has the committed shape
 *   1  a host changed: a payload drifted, or a hook never fired
 *   2  nothing could be judged: a host could not be run
 */
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  compareMoment,
  readHostFixtures,
  scrub,
  withFreshSamples,
} = require("./lib/hook-fixture-shape.cjs");

const FIXTURES = path.join(__dirname, "__tests__", "fixtures", "hook-payloads");
const RUN_TIMEOUT_MS = 240_000;
const SETTLE_MS = 3000;
const DRIFT = 1;
const UNJUDGED = 2;

const PROMPT =
  "Create a file named notes.md containing the word hello, then run the shell command `echo done`, then reply with the single word OK.";

/** One hook that appends what it is handed on stdin, with the event it was registered for. */
const CAPTURE_HOOK = `const fs = require("node:fs");
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  let payload = null;
  try { payload = JSON.parse(raw); } catch {}
  fs.appendFileSync(process.argv[2], JSON.stringify({ event: process.argv[3], payload }) + "\\n");
});
`;

const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

/** `{ Event: [{ hooks: [{ type, command }] }] }`, the form Claude Code and Codex read. */
const nested = (hooks) =>
  Object.fromEntries(hooks.map(({ event, command }) => [event, [{ hooks: [{ type: "command", command }] }]]));

/** What differs per host: how to declare the capture hook, and how to run it headless. The
 * invocations are those the fixtures README records; a host with no verified default model runs
 * only when `--model host=id` names one. OpenCode and Kilo are absent on purpose: a plugin
 * receives arguments, not stdin, and the committed fixtures hold arguments shaped by a capture
 * plugin that is not part of this repository. */
const HOSTS = {
  claude: {
    bin: "claude",
    model: "haiku",
    configure: (project, hooks) =>
      writeJson(path.join(project, ".claude", "settings.local.json"), { hooks: nested(hooks) }),
    argv: ({ model }) => [
      "-p", "--model", model, "--output-format", "stream-json", "--verbose",
      "--permission-mode", "acceptEdits", "--allowedTools", "Bash(echo:*)",
      "--setting-sources", "project,local", "--", PROMPT,
    ],
    sessionStores: (project) => [
      path.join(os.homedir(), ".claude", "projects", project.replace(/[^A-Za-z0-9]/g, "-")),
    ],
  },
  codex: {
    bin: "codex",
    configure: (project, hooks) => {
      fs.mkdirSync(path.join(project, ".codex"), { recursive: true });
      fs.writeFileSync(path.join(project, ".codex", "config.toml"), "[features]\nhooks = true\n");
      writeJson(path.join(project, ".codex", "hooks.json"), { hooks: nested(hooks) });
    },
    argv: ({ model, project }) => [
      "exec", "--dangerously-bypass-hook-trust", "--skip-git-repo-check", "--ephemeral",
      "-s", "workspace-write", "-C", project, ...(model ? ["-m", model] : []), PROMPT,
    ],
  },
  copilot: {
    bin: "copilot",
    configure: (project, hooks) =>
      writeJson(path.join(project, ".github", "hooks", "capture.hooks.json"), {
        version: 1,
        hooks: Object.fromEntries(
          hooks.map(({ event, command }) => [event, [{ type: "command", command, timeout: 5 }]])
        ),
      }),
    argv: ({ model }) => ["-p", PROMPT, "--allow-all", ...(model ? ["--model", model] : [])],
  },
  cursor: {
    bin: "cursor-agent",
    model: "auto",
    configure: (project, hooks) =>
      writeJson(path.join(project, ".cursor", "hooks.json"), {
        version: 1,
        hooks: Object.fromEntries(
          hooks.map(({ event, command }) => [
            event,
            [{ command, timeout: 5, ...(event === "postToolUse" ? { matcher: "Write|Edit|Bash|Shell|Delete" } : {}) }],
          ])
        ),
      }),
    argv: ({ model, project }) => [
      "-p", "--output-format", "stream-json", "--model", model, "--force", "--trust",
      "--workspace", project, "--", PROMPT,
    ],
    sessionStores: (project) => [
      path.join(os.homedir(), ".cursor", "projects", project.replace(/[^A-Za-z0-9]/g, "-").replace(/^-/, "")),
      path.join(os.homedir(), ".cursor", "chats", crypto.createHash("md5").update(project).digest("hex")),
    ],
  },
  antigravity: {
    bin: "agy",
    model: "gemini-3.8-flash-low",
    configure: (project, hooks) =>
      writeJson(path.join(project, ".agents", "hooks.json"), {
        // A tool event is delivered only to a matcher naming the tools `agy` calls.
        capture: Object.fromEntries(
          hooks.map(({ event, command }) => [
            event,
            event.endsWith("ToolUse")
              ? [{ matcher: "write_file|edit_file|run_command", hooks: [{ type: "command", command, timeout: 5 }] }]
              : [{ type: "command", command, timeout: 5 }],
          ])
        ),
      }),
    argv: ({ model }) => ["--model", model, "--output-format", "stream-json", "--dangerously-skip-permissions", `-p=${PROMPT}`],
  },
  kiro: {
    bin: "kiro-cli",
    model: "qwen3-coder-next",
    configure: (project, hooks) =>
      writeJson(path.join(project, ".kiro", "hooks", "capture.json"), {
        version: "v1",
        hooks: hooks.map(({ event, command }) => ({
          name: `capture-${event}`,
          trigger: event,
          action: { type: "command", command },
        })),
      }),
    argv: ({ model }) => [
      "chat", "--v3", "--no-interactive", "--trust-workspace",
      "--trust-tools=fs_write,fs_read,execute_bash", "--model", model, PROMPT,
    ],
  },
};

function parseArgs(argv) {
  const options = { hosts: Object.keys(HOSTS), models: {}, write: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") options.write = true;
    else if (arg === "--host") options.hosts = argv[++i].split(",");
    else if (arg === "--model") {
      const [host, id] = argv[++i].split("=");
      options.models[host] = id;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  const unknown = options.hosts.filter((host) => !(host in HOSTS));
  if (unknown.length > 0) throw new Error(`no capture for: ${unknown.join(", ")} (known: ${Object.keys(HOSTS).join(", ")})`);
  return options;
}

function versionOf(bin) {
  const run = spawnSync(bin, ["--version"], { encoding: "utf8" });
  return run.error ? null : `${run.stdout}${run.stderr}`.trim().split("\n")[0];
}

function readCaptured(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
}

/** Runs one host in a throwaway project and returns the payloads it delivered, per event. */
function capture(name, fixtures, model) {
  const spec = HOSTS[name];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `aidd-fixture-${name}-`));
  const project = path.join(root, "project");
  const out = path.join(root, "captured.jsonl");
  const script = path.join(root, "capture.cjs");
  try {
    fs.mkdirSync(project);
    fs.writeFileSync(script, CAPTURE_HOOK);
    // A `GIT_DIR` inherited from a git hook would point `init` at the repository running it.
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !/^(GIT_|CLAUDE|OPENCODE|KILO)/.test(key))
    );
    spawnSync("git", ["init", "-q", project], { env });
    const hooks = fixtures.map(({ event }) => ({
      event,
      command: [process.execPath, script, out, event].map((word) => JSON.stringify(word)).join(" "),
    }));
    spec.configure(project, hooks);
    const run = spawnSync(spec.bin, spec.argv({ model, project }), {
      cwd: project,
      encoding: "utf8",
      timeout: RUN_TIMEOUT_MS,
      killSignal: "SIGKILL",
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
    if (run.error && run.error.code !== "ETIMEDOUT") return { error: run.error.code ?? run.error.message };
    const lines = readCaptured(out).map(({ event, payload }) => ({
      event,
      payload: scrub(payload, { home: os.homedir(), project: fs.realpathSync(project) }),
    }));
    // A host keeps the session it ran under the project's path, some of it written after it
    // exits; none of it is worth keeping.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, SETTLE_MS);
    for (const store of spec.sessionStores?.(fs.realpathSync(project)) ?? []) {
      fs.rmSync(store, { recursive: true, force: true });
    }
    return { lines, said: (run.stderr.trim() || run.stdout.trim()).split("\n").pop() };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function main(argv, log) {
  const options = parseArgs(argv);
  let code = 0;
  for (const name of options.hosts) {
    const spec = HOSTS[name];
    const version = versionOf(spec.bin);
    const model = options.models[name] ?? spec.model;
    if (version === null) {
      log(`${name}: UNJUDGED ${spec.bin} is not installed\n`);
      code = Math.max(code, UNJUDGED);
      continue;
    }
    const fixtures = readHostFixtures(FIXTURES, name);
    const result = capture(name, fixtures, model);
    if (result.error) {
      log(`${name} (${version}): UNJUDGED could not run (${result.error})\n`);
      code = Math.max(code, UNJUDGED);
      continue;
    }
    log(`${name} (${version})\n`);
    for (const fixture of fixtures) {
      const fresh = result.lines.filter((line) => line.event === fixture.event).map((line) => line.payload);
      const verdict = compareMoment(fixture, fresh);
      log(`  ${fixture.event}: ${verdict.status}\n`);
      if (verdict.status === "not-fired") log(`    the host's last line: ${result.said.slice(0, 200)}\n`);
      for (const line of verdict.differences) log(`    ${line}\n`);
      if (verdict.status !== "match") code = Math.max(code, DRIFT);
      if (options.write && verdict.status === "drift") {
        const { file, ...committed } = fixture;
        writeJson(path.join(FIXTURES, file), withFreshSamples(committed, fresh));
        log(`    added the fresh payloads to ${file}\n`);
      }
    }
  }
  return code;
}

module.exports = { main, HOSTS, parseArgs };

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2), (text) => process.stdout.write(text)));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(UNJUDGED);
  }
}
