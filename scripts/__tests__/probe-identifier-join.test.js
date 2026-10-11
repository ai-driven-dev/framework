const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it } = require("node:test");

const { judge, probe } = require("../probe-identifier-join.cjs");

const ID = "00000000-0000-4000-8000-000000000001";
const CONFIG = path.join(os.tmpdir(), "probe-config");
const TRANSCRIPT = path.join(CONFIG, "projects", "-w-project", `${ID}.jsonl`);

/** What a real headless run showed on 2.1.295: the hook handed the session's id, the same in
 * its payload, its environment and every transcript line, and was spawned by Claude itself. */
function held(overrides = {}) {
  return {
    configDir: CONFIG,
    captured: {
      payload: { session_id: ID, transcript_path: TRANSCRIPT, hook_event_name: "SessionStart" },
      env: {
        CLAUDE_CODE_SESSION_ID: ID,
        CLAUDE_PID: "4242",
        CLAUDE_CODE_SESSION_ATTENDED: "0",
        CLAUDE_CODE_ENTRYPOINT: "sdk-cli",
      },
      ppid: 4242,
    },
    transcript: [{ type: "user", sessionId: ID }, { type: "system", sessionId: ID }],
    ...overrides,
  };
}

function withCaptured(change) {
  const observation = held();
  change(observation.captured);
  return observation;
}

describe("the join the telemetry rests on, judged from one headless run", () => {
  it("holds when the hook, its environment and the transcript name one session", () => {
    assert.equal(judge(held()).code, 0);
  });

  it("is a change of the tool when no hook fired before the API call", () => {
    assert.equal(judge(held({ captured: null })).code, 1);
  });

  it("is a change when the hook's session variable is not its payload's id", () => {
    const observation = withCaptured((c) => {
      c.env.CLAUDE_CODE_SESSION_ID = "another";
    });
    assert.match(judge(observation).message, /Claude-only guard/);
  });

  it("is a change when the transcript is not under the config dir's projects", () => {
    const observation = withCaptured((c) => {
      c.payload.transcript_path = path.join(os.tmpdir(), "elsewhere", "projects", "-w", `${ID}.jsonl`);
    });
    assert.match(judge(observation).message, /is not under/);
  });

  it("is a change when a transcript line names another session", () => {
    const observation = held({ transcript: [{ type: "user", sessionId: "another" }] });
    assert.match(judge(observation).message, /sessionId/);
  });

  it("is a change when no transcript line names a session", () => {
    assert.match(judge(held({ transcript: [{ type: "user" }] })).message, /sessionId/);
  });

  it("is a change when no transcript was written", () => {
    assert.match(judge(held({ transcript: null })).message, /no transcript/);
  });

  it("is a change when CLAUDE_PID is gone, leaving the hook's parent pid to name Claude", () => {
    const observation = withCaptured((c) => {
      delete c.env.CLAUDE_PID;
    });
    assert.match(judge(observation).message, /CLAUDE_PID/);
  });

  it("is a change when a headless run reads as a person at the keyboard", () => {
    const observation = withCaptured((c) => {
      c.env.CLAUDE_CODE_SESSION_ATTENDED = "1";
      c.env.CLAUDE_CODE_ENTRYPOINT = "cli";
    });
    assert.match(judge(observation).message, /present/);
  });
});

/** A `claude` stand-in, a node script: it reads the probe's SessionStart hook from the project,
 * runs it with a payload, and writes a transcript under `CLAUDE_CONFIG_DIR`. With `silent`, it
 * does neither, as a tool that stopped firing the hook before the API would. */
function fakeClaude(t, mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "probe-join-fake-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const script = path.join(dir, "claude.js");
  fs.writeFileSync(
    script,
    `const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
if (${JSON.stringify(mode)} === "silent") process.exit(1);
const id = ${JSON.stringify(ID)};
const transcript = path.join(process.env.CLAUDE_CONFIG_DIR, "projects", "-p", id + ".jsonl");
fs.mkdirSync(path.dirname(transcript), { recursive: true });
fs.writeFileSync(transcript, JSON.stringify({ type: "user", sessionId: id }) + "\\n");
const settings = JSON.parse(fs.readFileSync(".claude/settings.local.json", "utf8"));
const command = settings.hooks.SessionStart[0].hooks[0].command;
const [bin, ...args] = command.match(/"(?:[^"\\\\]|\\\\.)*"/g).map((word) => JSON.parse(word));
spawnSync(bin, args, {
  input: JSON.stringify({ session_id: id, transcript_path: transcript }),
  env: { ...process.env, CLAUDE_CODE_SESSION_ID: id, CLAUDE_PID: String(process.pid),
    CLAUDE_CODE_SESSION_ATTENDED: "0", CLAUDE_CODE_ENTRYPOINT: "sdk-cli" },
});
`
  );
  return [process.execPath, script];
}

describe("the exit code says who changed", () => {
  const quiet = () => {};

  it("exits 0 when the tool keeps the join", (t) => {
    assert.equal(probe({ host: fakeClaude(t, "ok"), log: quiet }), 0);
  });

  it("exits 1 when the tool fires no hook", (t) => {
    assert.equal(probe({ host: fakeClaude(t, "silent"), log: quiet }), 1);
  });

  it("exits 2 when there is no tool to ask, and says so", () => {
    const lines = [];
    const code = probe({
      host: [path.join(os.tmpdir(), "no-such-claude")],
      log: (text) => lines.push(text),
    });
    assert.equal(code, 2);
    assert.match(lines.join(""), /PROBE BROKEN/);
  });
});
