#!/usr/bin/env node
/**
 * Re-checks, without spending quota, what the telemetry rests on in Claude Code: one session id,
 * the same in a hook's payload, in the hook's environment and on every transcript line, so a
 * declaration made in the session and a billed call meet on it.
 *
 * It costs nothing because Claude Code mints the session id, fires `SessionStart` and opens the
 * transcript before it reaches the API: pointed at a dead address with a fake key and an empty
 * home, it does all three and then retries in vain until the probe stops it.
 *
 * The verdicts use the shipped predicate (`claude-only.cjs`), so a change in the tool is judged by
 * what the hooks will actually do with it.
 *
 * Exit codes:
 *   0  the join holds
 *   1  the tool changed: it ran, and what the telemetry assumes is no longer true
 *   2  the probe is broken: it could not get far enough to have an opinion
 */
const fs = require("node:fs");
const path = require("node:path");
const { isClaudePayload } = require("../plugins/aidd-telemetry/hooks/lib/claude-only.cjs");
const {
  cleanEnv,
  createSandbox,
  nodeCommand,
  readJsonLines,
  runHeadless,
  versionOf,
} = require("./lib/hook-sandbox.cjs");

const TOOL_CHANGED = 1;
const PROBE_BROKEN = 2;

/** Every artefact this probe reads is written before the first API call; the tool then retries
 * against the dead address, so the timeout only bounds the run. */
const RUN_TIMEOUT_MS = 90_000;

const changed = (message) => ({ code: TOOL_CHANGED, message });

/** The verdict on one headless run: `captured` is what the hook saw (null when it never ran),
 * `transcript` the parsed lines of the file the payload names (null when there is none). */
function judge({ configDir, captured, transcript }) {
  if (captured === null) return changed("the SessionStart hook never fired before the API call");
  const { payload, env } = captured;
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
  return { code: 0, message: `the join holds: ${payload.session_id}` };
}

/** Runs `host` (an argv) headless in a fresh project and home, and judges what it left. */
function probe({ host, log }) {
  const env = cleanEnv();
  const sandbox = createSandbox("aidd-join-probe-", env);
  try {
    return probeIn(sandbox, env, host, log);
  } finally {
    fs.rmSync(sandbox.root, { recursive: true, force: true });
  }
}

function probeIn({ root, project, witness }, env, host, log) {
  const home = path.join(root, "home");
  const configDir = path.join(home, ".claude");
  const capture = path.join(root, "captured.jsonl");
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(path.join(project, ".claude"), { recursive: true });
  // Shaped like the shipped hook, `node <script>`, so Claude spawns it the same way.
  const command = nodeCommand(witness, capture, "SessionStart");
  fs.writeFileSync(
    path.join(project, ".claude", "settings.local.json"),
    `${JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command }] }] } })}\n`
  );

  const [bin, ...leading] = host;
  const run = runHeadless(bin, [...leading, "-p", "say OK"], {
    cwd: project,
    timeout: RUN_TIMEOUT_MS,
    env: {
      ...env,
      HOME: home,
      CLAUDE_CONFIG_DIR: configDir,
      CODEX_HOME: path.join(home, ".codex"),
      ANTHROPIC_BASE_URL: "http://127.0.0.1:9",
      ANTHROPIC_API_KEY: "sk-ant-probe-not-a-real-key",
    },
  });
  if (run.error !== null) {
    log(`PROBE BROKEN: ${host.join(" ")} could not be run (${run.error})\n`);
    return PROBE_BROKEN;
  }
  const captured = readJsonLines(capture)?.[0] ?? null;
  const transcriptPath = captured?.payload?.transcript_path;
  const transcript = typeof transcriptPath === "string" ? readJsonLines(transcriptPath) : null;
  const verdict = judge({ configDir, captured, transcript });
  log(verdict.code === 0 ? `${verdict.message}\n` : `TOOL CHANGED: ${verdict.message}\n`);
  return verdict.code;
}

module.exports = { judge, probe };

if (require.main === module) {
  process.stdout.write(`${versionOf("claude") ?? "claude: no version"}\n`);
  process.exit(probe({ host: ["claude"], log: (text) => process.stdout.write(text) }));
}
