#!/usr/bin/env node
/**
 * Re-runs, by hand, what the committed hook-payload fixtures were captured from, and says per
 * host and moment whether the host still sends the same shape. Usage, exit codes and limits:
 * `__tests__/fixtures/hook-payloads/README.md`.
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
const {
  cleanEnv,
  createSandbox,
  nodeCommand,
  readJsonLines,
  pause,
  runHeadless,
  throwawayHome,
  versionOf,
} = require("./lib/hook-sandbox.cjs");

const FIXTURES = path.join(__dirname, "__tests__", "fixtures", "hook-payloads");
const RUN_TIMEOUT_MS = 240_000;
const SETTLE_MS = 3000;
const DRIFT = 1;
const UNJUDGED = 2;
const CAPTURE_OUT_VARIABLE = "AIDD_CAPTURE_OUT";

const PROMPT =
  "Create a file named notes.md containing the word hello, then run the shell command `echo done`, then reply with the single word OK.";

/** What a plugin hands OpenCode and Kilo is arguments, not stdin: this plugin records them under
 * the names the fixtures carry. */
const CAPTURE_PLUGIN = `import { appendFileSync } from "node:fs";
const record = (event, payload) =>
  appendFileSync(process.env.${CAPTURE_OUT_VARIABLE}, JSON.stringify({ event, payload }) + "\\n");
export default async (input) => {
  record("server-init", { inputKeys: Object.keys(input), directory: input.directory });
  return {
    "tool.execute.after": async (call, output) => record("tool.execute.after", { call, output }),
    event: async ({ event }) => {
      if (event.type === "session.created" || event.type === "session.idle") record(event.type, event);
    },
  };
};
`;

const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

/** `{ Event: [{ hooks: [{ type, command }] }] }`, the form Claude Code reads. */
const nested = (hooks) =>
  Object.fromEntries(hooks.map(({ event, command }) => [event, [{ hooks: [{ type: "command", command }] }]]));

const isToolEvent = (event) => /ToolUse$/i.test(event);

/** The matcher that names every tool the committed fixtures of `host` were captured from, so a
 * host that matches by tool name delivers each of them. */
function toolMatcher(fixtures, toolName) {
  const names = fixtures
    .filter(({ event }) => isToolEvent(event))
    .flatMap(({ samples }) => samples.map(({ payload }) => toolName(payload)));
  return [...new Set(names)].join("|");
}

const removeAll = (paths) => {
  for (const target of paths) fs.rmSync(target, { recursive: true, force: true });
};

/** What a headless run saved under the user's own home, found by the throwaway project's path
 * or by the id the host printed, and deleted once the run is judged. */
const ANTIGRAVITY_HOME = path.join(os.homedir(), ".gemini", "antigravity-cli");
const conversationIds = (output) => [...new Set([...output.matchAll(/"conversation_id":"([0-9a-f-]{36})"/g)].map((match) => match[1]))];

/** OpenCode and Kilo differ in their name, plugin directory and free model. */
const pluginHost = ({ bin, directory, model, flags }) => ({
  bin,
  model,
  configure: ({ project }) => {
    fs.mkdirSync(path.join(project, directory, "plugin"), { recursive: true });
    fs.writeFileSync(path.join(project, directory, "plugin", "capture.js"), CAPTURE_PLUGIN);
  },
  env: ({ root, out }) => ({ ...throwawayHome(path.join(root, "home")), [CAPTURE_OUT_VARIABLE]: out }),
  argv: ({ model: id }) => ["run", "-m", id, ...flags, PROMPT],
});

/** What differs per host: how to declare the capture hook, and how to run it headless. The
 * invocations are those the fixtures README records. `neverFires` names the moments the host does
 * not deliver headless, which are reported and not counted as a change. Codex and Copilot are
 * absent on purpose: their capture was never run against a live host. */
const HOSTS = {
  claude: {
    bin: "claude",
    model: "haiku",
    configure: ({ project, hooks }) =>
      writeJson(path.join(project, ".claude", "settings.local.json"), { hooks: nested(hooks) }),
    argv: ({ model }) => [
      "-p", "--model", model, "--output-format", "stream-json", "--verbose",
      "--permission-mode", "acceptEdits", "--allowedTools", "Bash(echo:*)",
      "--setting-sources", "project,local", "--", PROMPT,
    ],
    forget: ({ project }) =>
      removeAll([path.join(os.homedir(), ".claude", "projects", project.replace(/[^A-Za-z0-9]/g, "-"))]),
  },
  cursor: {
    bin: "cursor-agent",
    model: "auto",
    neverFires: ["stop"],
    toolName: (payload) => payload.tool_name,
    configure: ({ project, hooks, tools }) =>
      writeJson(path.join(project, ".cursor", "hooks.json"), {
        version: 1,
        hooks: Object.fromEntries(
          hooks.map(({ event, command }) => [
            event,
            [{ command, timeout: 5, ...(isToolEvent(event) ? { matcher: tools } : {}) }],
          ])
        ),
      }),
    argv: ({ model, project }) => [
      "-p", "--output-format", "stream-json", "--model", model, "--force", "--trust",
      "--workspace", project, "--", PROMPT,
    ],
    // Cursor names its folders after the workspace as it was given and as it resolves.
    forget: ({ project, given }) =>
      removeAll(
        [...new Set([project, given])].flatMap((workspace) => [
          path.join(os.homedir(), ".cursor", "projects", workspace.replace(/[^A-Za-z0-9]/g, "-").replace(/^-/, "")),
          path.join(os.homedir(), ".cursor", "chats", crypto.createHash("md5").update(workspace).digest("hex")),
        ])
      ),
  },
  antigravity: {
    bin: "agy",
    model: "gemini-3.8-flash-low",
    toolName: (payload) => payload.toolCall.name,
    configure: ({ project, hooks, tools }) =>
      writeJson(path.join(project, ".agents", "hooks.json"), {
        // A tool event is delivered only to a matcher naming the tools `agy` calls.
        capture: Object.fromEntries(
          hooks.map(({ event, command }) => [
            event,
            isToolEvent(event)
              ? [{ matcher: tools, hooks: [{ type: "command", command, timeout: 5 }] }]
              : [{ type: "command", command, timeout: 5 }],
          ])
        ),
      }),
    argv: ({ model }) => ["--model", model, "--output-format", "stream-json", "--dangerously-skip-permissions", `-p=${PROMPT}`],
    // `cache/last_conversations.json` keeps a pointer to the throwaway project; it is shared with
    // every other run, so it is left.
    forget: ({ output }) =>
      removeAll(
        conversationIds(output).flatMap((id) => [
          path.join(ANTIGRAVITY_HOME, "conversations", `${id}.db`),
          path.join(ANTIGRAVITY_HOME, "brain", id),
          path.join(ANTIGRAVITY_HOME, "presence", `${id}.lock`),
        ])
      ),
  },
  kiro: {
    bin: "kiro-cli",
    model: "qwen3-coder-next",
    configure: ({ project, hooks }) =>
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
    forget: ({ project, env }) => {
      const kiro = (...args) => spawnSync("kiro-cli", ["chat", ...args], { cwd: project, env, encoding: "utf8" });
      const listed = JSON.parse(kiro("--list-sessions", "--format", "json").stdout || "[]");
      for (const { sessions } of listed) for (const { sessionId } of sessions) kiro("--delete-session", sessionId);
    },
  },
  opencode: pluginHost({ bin: "opencode", directory: ".opencode", model: "opencode/deepseek-v4.1-flash-free", flags: [] }),
  kilo: pluginHost({ bin: "kilo", directory: ".kilo", model: "kilo/kilo-auto/free", flags: ["--auto"] }),
};

function parseArgs(argv) {
  const valueOf = (index, flag) => {
    if (argv[index + 1] === undefined) throw new Error(`missing value for ${flag}`);
    return argv[index + 1];
  };
  const options = { hosts: Object.keys(HOSTS), models: {}, write: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") options.write = true;
    else if (arg === "--host") options.hosts = valueOf(i++, arg).split(",");
    else if (arg === "--model") {
      const [host, id] = valueOf(i++, arg).split("=");
      if (!id) throw new Error("--model takes host=id");
      options.models[host] = id;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  const unknown = options.hosts.filter((host) => !(host in HOSTS));
  if (unknown.length > 0) throw new Error(`no capture for: ${unknown.join(", ")} (known: ${Object.keys(HOSTS).join(", ")})`);
  return options;
}

/** Runs one host in a throwaway project and returns the payloads it delivered, per event. */
function capture(name, fixtures, model) {
  const spec = HOSTS[name];
  const env = cleanEnv(["CLAUDE", "OPENCODE", "KILO"]);
  const { root, project, witness } = createSandbox(`aidd-fixture-${name}-`, env);
  const out = path.join(root, "captured.jsonl");
  try {
    const hooks = fixtures.map(({ event }) => ({ event, command: nodeCommand(witness, out, event) }));
    const tools = spec.toolName ? toolMatcher(fixtures, spec.toolName) : "";
    spec.configure({ project, hooks, tools });
    // `PWD` is what a Bun-based host reads for its directory: left as ours, it would work in the
    // repository running this tool, not the throwaway project.
    const runEnv = { ...env, PWD: project, ...spec.env?.({ root, out }) };
    const run = runHeadless(spec.bin, spec.argv({ model, project }), {
      cwd: project,
      env: runEnv,
      timeout: RUN_TIMEOUT_MS,
    });
    if (run.error !== null) return { error: run.error };
    const real = fs.realpathSync(project);
    const lines = (readJsonLines(out) ?? []).map(({ event, payload }) => ({
      event,
      payload: scrub(payload, { home: runEnv.HOME ?? os.homedir(), project: real }),
    }));
    const output = `${run.stdout}\n${run.stderr}`;
    // A host keeps the session it ran under the user's home, some of it written after it exits;
    // none of it is worth keeping.
    if (spec.forget) {
      pause(SETTLE_MS);
      spec.forget({ project: real, given: project, output, env: runEnv });
    }
    return { lines, output };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const ANSI = /\u001b\[[0-9;]*m/g;
const REFUSAL = /usage limit/i;

/** What a host printed: its last line that says something, and the line where it refuses the run. */
function readHostOutput(text) {
  const lines = text.replace(ANSI, "").split("\n").map((line) => line.trim()).filter((line) => line !== "");
  return { last: lines.at(-1) ?? "", refusal: lines.find((line) => REFUSAL.test(line)) ?? null };
}

/** Judges a run: not at all (`unjudged`, the reason) when the host refused it or delivered no
 * hook, otherwise each committed moment against what the host delivered. */
function judgeRun(spec, fixtures, { lines, output }) {
  const said = readHostOutput(output);
  if (said.refusal !== null) return { unjudged: `the host refused the run: ${said.refusal.slice(0, 200)}`, moments: [] };
  if (lines.length === 0) return { unjudged: `the host delivered no hook; its last line: ${said.last.slice(0, 200)}`, moments: [] };
  const moments = fixtures.map((fixture) => {
    const fresh = lines.filter((line) => line.event === fixture.event).map((line) => line.payload);
    const verdict = compareMoment(fixture, fresh);
    const expected = verdict.status === "not-fired" && Boolean(spec.neverFires?.includes(fixture.event));
    return { fixture, fresh, event: fixture.event, status: verdict.status, differences: verdict.differences, expected, last: said.last };
  });
  return { unjudged: null, moments };
}

/** The exit code of two outcomes together: a drift outranks a host that could not be run. */
function combine(code, next) {
  return code === DRIFT || next === DRIFT ? DRIFT : Math.max(code, next);
}

function main(argv, log, now = new Date()) {
  const options = parseArgs(argv);
  let code = 0;
  log(`run ${now.toISOString()}\n`);
  for (const name of options.hosts) {
    const spec = HOSTS[name];
    const version = versionOf(spec.bin, os.tmpdir());
    const model = options.models[name] ?? spec.model;
    if (version === null) {
      log(`${name}: UNJUDGED ${spec.bin} is not installed\n`);
      code = combine(code, UNJUDGED);
      continue;
    }
    const fixtures = readHostFixtures(FIXTURES, name);
    const result = capture(name, fixtures, model);
    const judged = result.error ? { unjudged: `could not run (${result.error})`, moments: [] } : judgeRun(spec, fixtures, result);
    if (judged.unjudged !== null) {
      log(`${name} (${version}): UNJUDGED ${judged.unjudged}\n`);
      code = combine(code, UNJUDGED);
      continue;
    }
    log(`${name} (${version})\n`);
    for (const moment of judged.moments) {
      const note = moment.expected ? " (expected: the host does not fire it headless)" : "";
      log(`  ${moment.event}: ${moment.status}${note}\n`);
      if (moment.status === "not-fired" && !moment.expected) log(`    the host's last line: ${moment.last.slice(0, 200)}\n`);
      for (const line of moment.differences) log(`    ${line}\n`);
      if (moment.status !== "match" && !moment.expected) code = combine(code, DRIFT);
      if (options.write && moment.status === "drift") {
        const { file, ...committed } = moment.fixture;
        writeJson(path.join(FIXTURES, file), withFreshSamples(committed, moment.fresh));
        log(`    added the fresh payloads to ${file}\n`);
      }
    }
  }
  return code;
}

module.exports = { main, HOSTS, parseArgs, toolMatcher, readHostOutput, judgeRun, combine };

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2), (text) => process.stdout.write(text)));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(UNJUDGED);
  }
}
