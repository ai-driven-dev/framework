#!/usr/bin/env node
/**
 * Runs the real `claude` binary against a fake Anthropic API on this machine, with the shipped
 * hooks, and checks that `aidd telemetry report` counts exactly what the API billed: every call,
 * every counter, attributed to the declared task and ticket. It spends no quota and needs no key.
 *
 * The fake API answers each call with known usage, so the expected totals come from the server,
 * never from the transcript the CLI reads.
 *
 * `--attended` runs Claude in a pseudo-terminal, as a person would: the first prompt must be
 * blocked and asked for a task, the declaration typed as a prompt must be answered by the hook,
 * and `/clear` must keep the task. POSIX only: it needs Python's `pty`.
 *
 * Usage: node scripts/check-claude-tokens-end-to-end.cjs [--attended] [path/to/cli.js]
 *
 * Exit codes:
 *   0  the report equals what was billed
 *   1  it does not: the measurement is wrong on this platform
 *   2  the check is broken: it could not get far enough to have an opinion
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const WRONG = 1;
const BROKEN = 2;
const RUN_TIMEOUT_MS = 120_000;
const WAIT_MS = 60_000;
const API_KEY = "sk-ant-e2e-not-a-real-key-0000000000";
const PROMPTS = ["say OK", "say OK again"];
const HOOKS = path.join(__dirname, "..", "plugins", "aidd-telemetry", "hooks");
const COUNTERS = ["input", "output", "cache_read", "cache_write"];

/** Answers every Messages call with distinct, known usage and remembers what it billed. */
function startFakeApi() {
  const billed = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (req.method !== "POST" || !req.url.startsWith("/v1/messages") || req.url.includes("count_tokens")) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end("{}");
        return;
      }
      let request = {};
      try {
        request = JSON.parse(body);
      } catch {}
      const n = billed.length + 1;
      const usage = {
        input_tokens: 100 * n,
        output_tokens: 7 * n,
        cache_read_input_tokens: 11 * n,
        cache_creation_input_tokens: 13 * n,
      };
      billed.push(usage);
      const id = `msg_fake_${n}`;
      const message = { id, type: "message", role: "assistant", model: request.model ?? "claude-fake", stop_sequence: null };
      const headers = { "request-id": `req_fake_${n}` };
      if (!request.stream) {
        res.writeHead(200, { ...headers, "content-type": "application/json" });
        res.end(JSON.stringify({ ...message, content: [{ type: "text", text: `billed-${n}` }], stop_reason: "end_turn", usage }));
        return;
      }
      res.writeHead(200, { ...headers, "content-type": "text/event-stream" });
      const event = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
      event("message_start", { message: { ...message, content: [], stop_reason: null, usage: { ...usage, output_tokens: 1 } } });
      event("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
      event("content_block_delta", { index: 0, delta: { type: "text_delta", text: `billed-${n}` } });
      event("content_block_stop", { index: 0 });
      event("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: usage.output_tokens } });
      event("message_stop", {});
      res.end();
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, billed, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

function run(bin, args, options) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { ...options, shell: options.shell ?? false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), RUN_TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/** Relays stdin to a pseudo-terminal running argv, and the terminal to stdout, so a person's
 * keystrokes can be typed into Claude. Its end of stdin ends Claude. */
const TTY_RELAY = `import fcntl, os, pty, select, struct, sys, termios
pid, fd = pty.fork()
if pid == 0:
    os.execvp(sys.argv[1], sys.argv[1:])
fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 50, 160, 0, 0))
while True:
    ready, _, _ = select.select([fd, 0], [], [])
    if fd in ready:
        try:
            data = os.read(fd, 65536)
        except OSError:
            break
        if not data:
            break
        os.write(1, data)
    if 0 in ready:
        data = os.read(0, 65536)
        if not data:
            os.kill(pid, 9)
            break
        os.write(fd, data)
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves once `condition()` holds, or throws naming what never happened. */
async function waitFor(what, condition) {
  const end = Date.now() + WAIT_MS;
  while (Date.now() < end) {
    if (condition()) return;
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${what}`);
}

const readText = (file) => {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
};

const readLines = (file) =>
  readText(file)
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));

/** Every transcript Claude wrote under its config dir, concatenated. */
function transcripts(configDir) {
  const projects = path.join(configDir, "projects");
  if (!fs.existsSync(projects)) return "";
  return fs
    .readdirSync(projects, { recursive: true })
    .filter((name) => String(name).endsWith(".jsonl"))
    .map((name) => readText(path.join(projects, String(name))))
    .join("\n");
}

/** Types into Claude as a person: what the gate blocks, the declaration it asks for, `/clear`.
 * Each step waits on what it causes on disk or at the API, never on how the screen renders. */
async function attendedSession({ root, env, project, api, telemetryDir }) {
  const relay = path.join(root, "tty-relay.py");
  fs.writeFileSync(relay, TTY_RELAY);
  const child = spawn("python3", ["-I", relay, "claude"], { cwd: project, env: { ...env, TERM: "xterm-256color" } });
  let screen = "";
  child.stdout.on("data", (chunk) => {
    screen += chunk;
  });
  let typedAt = 0;
  // Whitespace dropped: the terminal redraws by moving the cursor, not by printing spaces.
  const shown = (text) => screen.slice(typedAt).replace(/\s/gu, "").includes(text.replace(/\s/gu, ""));
  /** A blocked prompt is put back in the input once the hook's message is shown: wait for it,
   * then for the input to settle, so the next prompt is not typed onto the old one. */
  const settle = async (what, text) => {
    await waitFor(what, () => shown(text));
    await sleep(1000);
  };
  const type = async (text) => {
    typedAt = screen.length;
    child.stdin.write("\x15"); // clear whatever the input holds
    await sleep(300);
    child.stdin.write(text);
    await sleep(300);
    child.stdin.write("\r");
  };
  const sessions = path.join(telemetryDir, "bindings", "sessions.jsonl");
  const carries = path.join(telemetryDir, "bindings", "carries.jsonl");
  const billedInTranscript = (n) => transcripts(env.CLAUDE_CONFIG_DIR).includes(`"msg_fake_${n}"`);
  try {
    await waitFor("Claude to start", () => screen.includes("Claude Code"));
    await sleep(2000);
    await type("say OK");
    await settle("the gate to ask for a task", "Telemetry: no task");
    const billedBeforeDeclaring = api.billed.length;
    await type("aidd telemetry task demo --ticket T-1");
    await waitFor("the hook to answer the declaration", () => readText(sessions).includes("hook-intercept"));
    await settle("the hook to confirm the declaration", "Send your prompt again");
    await type("say OK");
    await waitFor("the first call in a transcript", () => billedInTranscript(1));
    await type("/clear");
    await waitFor("the task to be carried across /clear", () => readText(carries).trim() !== "");
    await sleep(1000);
    await type("say OK");
    await waitFor("the call after /clear in a transcript", () => billedInTranscript(2));
    return { billedBeforeDeclaring, sessions: readLines(sessions), carries: readLines(carries) };
  } catch (error) {
    const tail = screen.slice(-600);
    throw new Error(`${error.message}; the screen ended with: ${JSON.stringify(tail)}`);
  } finally {
    child.stdin.end();
  }
}

/** The verdict on what a person's session left: asked before any call, answered by the hook,
 * and the declared session carried across `/clear`. */
function judgeAttended({ billedBeforeDeclaring, sessions, carries }) {
  const wrong = [];
  if (billedBeforeDeclaring !== 0) wrong.push(`${billedBeforeDeclaring} calls reached the API before the task was declared`);
  const declared = sessions.filter((line) => line.by === "hook-intercept" && line.task === "demo" && line.ticket === "T-1");
  if (declared.length !== 1) wrong.push(`${declared.length} declarations of demo, T-1 answered by the hook`);
  const carried = carries.filter((line) => line.from === declared[0]?.session_id && line.session_id !== line.from);
  if (carried.length !== 1) wrong.push(`${carried.length} carries from the declared session across /clear`);
  return wrong.length > 0 ? { code: WRONG, message: wrong.join("; ") } : { code: 0, message: "asked, answered by the hook, kept across /clear" };
}

/** What the report must say, from what the server billed alone. */
function expectedTotals(billed) {
  const sum = (field) => billed.reduce((total, usage) => total + usage[field], 0);
  return {
    records: billed.length,
    input: sum("input_tokens"),
    output: sum("output_tokens"),
    cache_read: sum("cache_read_input_tokens"),
    cache_write: sum("cache_creation_input_tokens"),
  };
}

/** The differences between a report's totals or row and the expected figures, as sentences. */
function compare(label, actual, expected) {
  const wrong = [];
  if (actual?.records !== expected.records) wrong.push(`${label} records ${actual?.records}, billed ${expected.records}`);
  for (const counter of COUNTERS) {
    const tokens = actual?.[counter]?.tokens;
    if (tokens !== expected[counter]) wrong.push(`${label} ${counter} ${tokens}, billed ${expected[counter]}`);
    if (actual?.[counter]?.unknown_records !== 0) wrong.push(`${label} ${counter} has unknown records`);
  }
  return wrong;
}

/** The verdict on the task and ticket reports, and on the report narrowed to the task in this
 * repository, against the billed calls. */
function judge({ billed, byTask, byTicket, here, prompts = PROMPTS.length }) {
  if (billed.length < prompts) return { code: BROKEN, message: `the API billed ${billed.length} calls for ${prompts} prompts` };
  const expected = expectedTotals(billed);
  const rowOf = (report, key) => report?.rows?.find((row) => row.kind === "value" && row.key === key);
  const wrong = [
    ...compare("totals", byTask?.totals, expected),
    ...compare("task demo", rowOf(byTask, "demo"), expected),
    ...compare("ticket T-1", rowOf(byTicket, "T-1"), expected),
    ...compare("task demo here", here?.totals, expected),
    // A hosted origin's hash, or the root commit of a repository with none.
    ...(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u.test(here?.filters?.repository ?? "")
      ? []
      : [`--repository . resolved to ${JSON.stringify(here?.filters?.repository)}`]),
  ];
  if (wrong.length > 0) return { code: WRONG, message: wrong.join("; ") };
  return { code: 0, message: `${expected.records} calls, ${expected.input + expected.output + expected.cache_read + expected.cache_write} tokens, all on task demo, ticket T-1, and on task demo in this repository` };
}

async function check({ cli, log, attended = false }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-tokens-e2e-"));
  const api = await startFakeApi();
  try {
    return await checkIn({ root, cli, api, log, attended });
  } finally {
    api.server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function checkIn({ root, cli, api, log, attended }) {
  const home = path.join(root, "home");
  const project = path.join(root, "project");
  const configDir = path.join(home, ".claude");
  const telemetryDir = path.join(home, "telemetry");
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
  fs.mkdirSync(path.join(project, ".claude"), { recursive: true });
  // Shaped like the shipped hooks.json, `node <script>`, with the plugin root spelled out.
  const hook = (script) => ({
    hooks: [{ type: "command", command: [process.execPath, path.join(HOOKS, script)].map((word) => JSON.stringify(word.replaceAll("\\", "/"))).join(" ") }],
  });
  fs.writeFileSync(
    path.join(project, ".claude", "settings.local.json"),
    `${JSON.stringify({ hooks: { SessionStart: [hook("session-start.cjs")], UserPromptSubmit: [hook("prompt-gate.cjs")] } })}\n`
  );
  // What a person already answered once: onboarding done, this folder trusted, this key approved.
  const answered = {
    hasCompletedOnboarding: true,
    theme: "dark",
    customApiKeyResponses: { approved: [API_KEY.slice(-20)], rejected: [] },
    projects: { [fs.realpathSync(project)]: { hasTrustDialogAccepted: true }, [project]: { hasTrustDialogAccepted: true } },
  };
  fs.writeFileSync(path.join(configDir, ".claude.json"), `${JSON.stringify(answered)}\n`);
  // The gate runs `aidd` from PATH, so the CLI under test must be the one found there.
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "aidd"), `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(cli)} "$@"\n`, { mode: 0o755 });
  // Nothing of the session running this check may leak in: no git hook dir, no outer Claude or aidd.
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !/^(GIT_|CLAUDE|AIDD_|ANTHROPIC_)/u.test(name))
  );
  const env = {
    ...inherited,
    PATH: `${bin}${path.delimiter}${inherited.PATH ?? ""}`,
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: path.join(home, ".config"),
    AIDD_USER_CONFIG_DIR: path.join(home, ".config", "aidd"),
    AIDD_TELEMETRY_DIR: telemetryDir,
    CLAUDE_CONFIG_DIR: configDir,
    GIT_CONFIG_NOSYSTEM: "1",
    ANTHROPIC_BASE_URL: api.url,
    ANTHROPIC_API_KEY: API_KEY,
  };
  const options = { cwd: project, env };
  const step = async (label, bin, args, extra = {}) => {
    const result = await run(bin, args, { ...options, ...extra });
    if (result.code !== 0) throw new Error(`${label} exited ${result.code}: ${(result.stderr || result.stdout).trim().split("\n").pop()}`);
    return result.stdout;
  };
  const aidd = (label, ...args) => step(label, process.execPath, [cli, "telemetry", ...args]);
  try {
    for (const args of [
      ["init", "-q", "-b", "main"],
      ["config", "user.email", "e2e@example.invalid"],
      ["config", "user.name", "e2e"],
      ["remote", "add", "origin", "https://example.invalid/acme/demo.git"],
      ["commit", "-q", "--allow-empty", "-m", "init"],
      ["checkout", "-q", "-b", "feat/demo"],
    ]) {
      await step(`git ${args[0]}`, "git", args);
    }
    await aidd("aidd telemetry on", "on", "--yes");
    let session = null;
    if (attended) {
      session = await attendedSession({ root, env, project, api, telemetryDir });
    } else {
      await aidd("aidd telemetry task", "task", "demo", "--ticket", "T-1");
      // On Windows `claude` is a `.cmd` shim, which only a shell runs.
      const windows = process.platform === "win32";
      for (const prompt of PROMPTS) {
        await step(`claude -p "${prompt}"`, "claude", ["-p", windows ? JSON.stringify(prompt) : prompt], { shell: windows });
      }
    }
    const byTask = JSON.parse(await aidd("aidd telemetry report --axis task", "report", "--json", "--axis", "task"));
    const byTicket = JSON.parse(await aidd("aidd telemetry report --axis ticket", "report", "--json", "--axis", "ticket"));
    const here = JSON.parse(
      await aidd("aidd telemetry report --task demo --repository .", "report", "--json", "--task", "demo", "--repository", ".")
    );
    let verdict = judge({ billed: api.billed, byTask, byTicket, here });
    if (verdict.code === 0 && session !== null) {
      const person = judgeAttended(session);
      verdict = person.code === 0 ? { code: 0, message: `${verdict.message}; ${person.message}` } : person;
    }
    log(verdict.code === 0 ? `${verdict.message}\n` : `${verdict.code === WRONG ? "WRONG" : "BROKEN"}: ${verdict.message}\n`);
    return verdict.code;
  } catch (error) {
    log(`BROKEN: ${error.message}\n`);
    return BROKEN;
  }
}

module.exports = { judge, judgeAttended, check };

if (require.main === module) {
  const args = process.argv.slice(2);
  const attended = args.includes("--attended");
  const cliArg = args.find((arg) => arg !== "--attended");
  const cli = path.resolve(cliArg ?? path.join(__dirname, "..", "cli", "dist", "cli.js"));
  check({ cli, log: (text) => process.stdout.write(text), attended }).then((code) => process.exit(code));
}
