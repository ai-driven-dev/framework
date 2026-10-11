#!/usr/bin/env node
/**
 * Re-checks, without spending quota, what the telemetry rests on in Claude Code: one session id,
 * the same in a hook's payload, in the hook's environment and on every transcript line, so a
 * declaration made in the session, a carry across `/clear` and a billed call meet on it.
 *
 * It costs nothing because Claude Code mints the session id, fires `SessionStart` and opens the
 * transcript before it reaches the API: pointed at a dead address with a fake key and an empty
 * home, it does all three and then retries in vain until the probe stops it.
 *
 * The verdicts use the shipped predicates (`claude-only.cjs`, `presence.cjs`), so a change in the
 * tool is judged by what the hooks will actually do with it.
 *
 * Exit codes:
 *   0  the join holds
 *   1  the tool changed: it ran, and what the telemetry assumes is no longer true
 *   2  the probe is broken: it could not get far enough to have an opinion
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { isClaudePayload } = require("../plugins/aidd-telemetry/hooks/lib/claude-only.cjs");
const { personIsPresent } = require("../plugins/aidd-telemetry/hooks/lib/presence.cjs");

const TOOL_CHANGED = 1;
const PROBE_BROKEN = 2;

/** Every artefact this probe reads is written before the first API call; the tool then retries
 * against the dead address, so the timeout only bounds the run. */
const RUN_TIMEOUT_MS = 90_000;

/** Records the hook's stdin, the variables the telemetry reads and its parent pid. */
const CAPTURE_HOOK = `const fs = require("node:fs");
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  const e = process.env;
  const env = {};
  for (const name of ["CLAUDE_CODE_SESSION_ID", "CLAUDE_PID", "CLAUDE_CODE_SESSION_ATTENDED", "CLAUDE_CODE_ENTRYPOINT"]) env[name] = e[name];
  fs.writeFileSync(process.argv[2], JSON.stringify({ payload: JSON.parse(raw), env, ppid: process.ppid }));
});
`;

const changed = (message) => ({ code: TOOL_CHANGED, message });

/** The verdict on one headless run: `captured` is what the hook saw (null when it never ran),
 * `transcript` the parsed lines of the file the payload names (null when there is none). */
function judge({ configDir, captured, transcript }) {
  if (captured === null) return changed("the SessionStart hook never fired before the API call");
  const { payload, env, ppid } = captured;
  if (!isClaudePayload(payload, env)) {
    return changed(
      `the Claude-only guard refuses Claude's own payload: session_id ${payload.session_id}, ` +
        `CLAUDE_CODE_SESSION_ID ${env.CLAUDE_CODE_SESSION_ID}, transcript ${payload.transcript_path}`
    );
  }
  const projects = path.join(configDir, "projects");
  const relative = path.relative(projects, payload.transcript_path);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return changed(`the transcript ${payload.transcript_path} is not under ${projects}, where ingest reads`);
  }
  if (transcript === null) return changed("no transcript was written before the API call");
  const ids = transcript.map((line) => line.sessionId).filter((id) => id !== undefined);
  if (ids.length === 0 || ids.some((id) => id !== payload.session_id)) {
    return changed(`the transcript's sessionId values (${[...new Set(ids)].join(", ") || "none"}) are not ${payload.session_id}`);
  }
  // The hook names Claude's process by CLAUDE_PID, and by its parent pid only when it is gone.
  if (!/^[1-9]\d*$/u.test(env.CLAUDE_PID ?? "")) {
    return changed(
      `CLAUDE_PID is ${env.CLAUDE_PID ?? "unset"}: a /clear carry now rests on the hook's parent pid, ${ppid}, being Claude's`
    );
  }
  if (personIsPresent(env)) {
    return changed(
      `a headless run reads as a person present (CLAUDE_CODE_SESSION_ATTENDED ${env.CLAUDE_CODE_SESSION_ATTENDED}, ` +
        `CLAUDE_CODE_ENTRYPOINT ${env.CLAUDE_CODE_ENTRYPOINT}): the prompt gate would block automation`
    );
  }
  return { code: 0, message: `the join holds: ${payload.session_id}` };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function readLines(file) {
  try {
    return fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line));
  } catch {
    return null;
  }
}

/** Runs `host` (an argv) headless in a fresh project and home, and judges what it left. */
function probe({ host, log }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-join-probe-"));
  try {
    return probeIn(root, host, log);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function probeIn(root, host, log) {
  const home = path.join(root, "home");
  const configDir = path.join(home, ".claude");
  const project = path.join(root, "project");
  const capture = path.join(root, "captured.json");
  const witness = path.join(root, "capture.cjs");
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(path.join(project, ".claude"), { recursive: true });
  fs.writeFileSync(witness, CAPTURE_HOOK);
  // Shaped like the shipped hook, `node <script>`, so Claude spawns it the same way.
  const command = [process.execPath, witness, capture].map((word) => JSON.stringify(word)).join(" ");
  fs.writeFileSync(
    path.join(project, ".claude", "settings.local.json"),
    `${JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command }] }] } })}\n`
  );
  // A `GIT_DIR` inherited from a git hook would point `init` at the repository running it.
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")));
  spawnSync("git", ["init", "-q", project], { env });

  const [bin, ...leading] = host;
  const run = spawnSync(bin, [...leading, "-p", "say OK"], {
    cwd: project,
    encoding: "utf8",
    timeout: RUN_TIMEOUT_MS,
    killSignal: "SIGKILL",
    env: {
      ...env,
      HOME: home,
      CLAUDE_CONFIG_DIR: configDir,
      ANTHROPIC_BASE_URL: "http://127.0.0.1:9",
      ANTHROPIC_API_KEY: "sk-ant-probe-not-a-real-key",
    },
  });
  if (run.error !== undefined && run.error.code !== "ETIMEDOUT") {
    log(`PROBE BROKEN: ${host.join(" ")} could not be run (${run.error.code ?? run.error.message})\n`);
    return PROBE_BROKEN;
  }
  const captured = readJson(capture);
  const transcriptPath = captured?.payload?.transcript_path;
  const transcript = typeof transcriptPath === "string" ? readLines(transcriptPath) : null;
  const verdict = judge({ configDir, captured, transcript });
  log(verdict.code === 0 ? `${verdict.message}\n` : `TOOL CHANGED: ${verdict.message}\n`);
  return verdict.code;
}

module.exports = { judge, probe };

if (require.main === module) {
  const version = spawnSync("claude", ["--version"], { encoding: "utf8" });
  process.stdout.write(`${(version.stdout ?? "").trim() || "claude: no version"}\n`);
  process.exit(probe({ host: ["claude"], log: (text) => process.stdout.write(text) }));
}
