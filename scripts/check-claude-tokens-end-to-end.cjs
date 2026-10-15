#!/usr/bin/env node
/**
 * Runs the real `claude` binary against a fake Anthropic API on this machine, with the shipped
 * hooks, and checks that `aidd telemetry report` counts exactly what the API billed: every call,
 * every counter, attributed to the declared task and ticket. It spends no quota and needs no key.
 *
 * The fake API answers each call with known usage, so the expected totals come from the server,
 * never from the transcript the CLI reads.
 *
 * Usage: node scripts/check-claude-tokens-end-to-end.cjs [path/to/cli.js]
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
        res.end(JSON.stringify({ ...message, content: [{ type: "text", text: "OK" }], stop_reason: "end_turn", usage }));
        return;
      }
      res.writeHead(200, { ...headers, "content-type": "text/event-stream" });
      const event = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
      event("message_start", { message: { ...message, content: [], stop_reason: null, usage: { ...usage, output_tokens: 1 } } });
      event("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
      event("content_block_delta", { index: 0, delta: { type: "text_delta", text: "OK" } });
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

/** The verdict on the task and ticket reports against the billed calls. */
function judge({ billed, byTask, byTicket }) {
  if (billed.length < PROMPTS.length) return { code: BROKEN, message: `the API billed ${billed.length} calls for ${PROMPTS.length} prompts` };
  const expected = expectedTotals(billed);
  const rowOf = (report, key) => report?.rows?.find((row) => row.kind === "value" && row.key === key);
  const wrong = [
    ...compare("totals", byTask?.totals, expected),
    ...compare("task demo", rowOf(byTask, "demo"), expected),
    ...compare("ticket T-1", rowOf(byTicket, "T-1"), expected),
  ];
  if (wrong.length > 0) return { code: WRONG, message: wrong.join("; ") };
  return { code: 0, message: `${expected.records} calls, ${expected.input + expected.output + expected.cache_read + expected.cache_write} tokens, all on task demo, ticket T-1` };
}

async function check({ cli, log }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-tokens-e2e-"));
  const api = await startFakeApi();
  try {
    return await checkIn(root, cli, api, log);
  } finally {
    api.server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function checkIn(root, cli, api, log) {
  const home = path.join(root, "home");
  const project = path.join(root, "project");
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
  // Nothing of the session running this check may leak in: no git hook dir, no outer Claude or aidd.
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !/^(GIT_|CLAUDE|AIDD_|ANTHROPIC_)/u.test(name))
  );
  const env = {
    ...inherited,
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: path.join(home, ".config"),
    AIDD_USER_CONFIG_DIR: path.join(home, ".config", "aidd"),
    AIDD_TELEMETRY_DIR: path.join(home, "telemetry"),
    CLAUDE_CONFIG_DIR: path.join(home, ".claude"),
    GIT_CONFIG_NOSYSTEM: "1",
    ANTHROPIC_BASE_URL: api.url,
    ANTHROPIC_API_KEY: "sk-ant-e2e-not-a-real-key",
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
    await aidd("aidd telemetry task", "task", "demo", "--ticket", "T-1");
    // On Windows `claude` is a `.cmd` shim, which only a shell runs.
    const windows = process.platform === "win32";
    for (const prompt of PROMPTS) {
      await step(`claude -p "${prompt}"`, "claude", ["-p", windows ? JSON.stringify(prompt) : prompt], { shell: windows });
    }
    const byTask = JSON.parse(await aidd("aidd telemetry report --axis task", "report", "--json", "--axis", "task"));
    const byTicket = JSON.parse(await aidd("aidd telemetry report --axis ticket", "report", "--json", "--axis", "ticket"));
    const verdict = judge({ billed: api.billed, byTask, byTicket });
    log(verdict.code === 0 ? `${verdict.message}\n` : `${verdict.code === WRONG ? "WRONG" : "BROKEN"}: ${verdict.message}\n`);
    return verdict.code;
  } catch (error) {
    log(`BROKEN: ${error.message}\n`);
    return BROKEN;
  }
}

module.exports = { judge, check };

if (require.main === module) {
  const cli = path.resolve(process.argv[2] ?? path.join(__dirname, "..", "cli", "dist", "cli.js"));
  check({ cli, log: (text) => process.stdout.write(text) }).then((code) => process.exit(code));
}
