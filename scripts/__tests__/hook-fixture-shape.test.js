const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  shapeOf,
  diffShapes,
  compareMoment,
  scrub,
  readHostFixtures,
  withFreshSamples,
} = require("../lib/hook-fixture-shape.cjs");

const SESSION = "00000000-0000-4000-8000-000000000000";

function committed(...payloads) {
  return { host: "claude", event: "PostToolUse", samples: payloads.map((payload) => ({ run: "log", payload, hookAnswer: null })) };
}

describe("shapeOf", () => {
  it("keeps keys and types, never values", () => {
    assert.deepEqual(shapeOf({ a: "x", b: 1, c: true, d: null, e: { f: "y" } }), {
      a: "string",
      b: "number",
      c: "boolean",
      d: "null",
      e: { f: "string" },
    });
  });

  it("gives two arrays of the same element shapes the same shape, whatever their length", () => {
    assert.deepEqual(shapeOf({ l: ["a"] }), shapeOf({ l: ["b", "c"] }));
    assert.notDeepEqual(shapeOf({ l: ["a"] }), shapeOf({ l: [1] }));
  });
});

describe("diffShapes", () => {
  it("is empty for the same keys and types with other values", () => {
    assert.deepEqual(diffShapes(shapeOf({ a: "x" }), shapeOf({ a: "y" })), []);
  });

  it("names a key the host stopped sending", () => {
    assert.deepEqual(diffShapes(shapeOf({ a: "x", b: 1 }), shapeOf({ a: "x" })), ["missing: b"]);
  });

  it("names a key the host started sending, at its path", () => {
    assert.deepEqual(diffShapes(shapeOf({ a: {} }), shapeOf({ a: { n: 1 } })), ["added: a.n"]);
  });

  it("names a changed type, at its path", () => {
    assert.deepEqual(diffShapes(shapeOf({ a: { n: 1 } }), shapeOf({ a: { n: "1" } })), ["type: a.n number -> string"]);
  });
});

describe("compareMoment", () => {
  const write = { session_id: SESSION, tool_name: "Write", tool_input: { file_path: "a", content: "b" } };
  const bash = { session_id: SESSION, tool_name: "Bash", tool_input: { command: "ls" } };

  it("matches when every fresh payload has the shape of some committed sample", () => {
    const verdict = compareMoment(committed(write, bash), [{ ...bash, tool_input: { command: "echo" } }, write]);
    assert.equal(verdict.status, "match");
  });

  it("reports drift against the closest committed sample", () => {
    const fresh = { ...write, tool_input: { file_path: "a", content: "b", extra: true } };
    const verdict = compareMoment(committed(write, bash), [fresh]);
    assert.equal(verdict.status, "drift");
    assert.deepEqual(verdict.differences, ["added: tool_input.extra"]);
  });

  it("fails a moment whose hook never fired", () => {
    assert.equal(compareMoment(committed(write), []).status, "not-fired");
  });

  it("counts a repeated fresh shape once", () => {
    const fresh = { ...write, tool_input: { file_path: "a", content: "b", extra: true } };
    assert.equal(compareMoment(committed(write), [fresh, fresh]).differences.length, 1);
  });
});

describe("scrub", () => {
  it("turns a home, a project, a session id and an email into the committed placeholders", () => {
    const payload = {
      cwd: "/home/me/box/project",
      session_id: "9b2c6f1e-1111-4222-8333-444455556666",
      transcript: "/home/me/.claude/x.jsonl",
      email: "me@corp.dev",
    };
    assert.deepEqual(scrub(payload, { home: "/home/me", project: "/home/me/box/project" }), {
      cwd: "/Users/user/project",
      session_id: SESSION,
      transcript: "/Users/user/.claude/x.jsonl",
      email: "user@example.com",
    });
  });
});

describe("scrub timestamps", () => {
  const opts = { home: "/h", project: "/h/p" };

  it("fixes an ISO timestamp and a dated session file name to the epoch", () => {
    assert.deepEqual(
      scrub(
        {
          title: "New session - 2026-11-06T09:30:12.345Z",
          file: ["/h/.codex", "sessions", "2026/11/06", ["rollout", "2026-11-06T09-30-12", "9b2c6f1e-1111-4222-8333-444455556666.jsonl"].join("-")].join("/"),
        },
        opts
      ),
      {
        title: "New session - 1970-01-01T00:00:00.000Z",
        file: `/Users/user/.codex/sessions/1970/01/01/rollout-1970-01-01T00-00-00-${SESSION}.jsonl`,
      }
    );
  });
});

describe("readHostFixtures", () => {
  it("reads one fixture per moment of the host and none of another host", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fixtures-"));
    try {
      for (const [host, event] of [["claude", "Stop"], ["claude", "PostToolUse"], ["kiro", "Stop"]]) {
        fs.writeFileSync(path.join(dir, `${host}-${event}.json`), JSON.stringify({ host, event, samples: [] }));
      }
      fs.writeFileSync(path.join(dir, "README.md"), "# not a fixture");
      assert.deepEqual(
        readHostFixtures(dir, "claude").map((fixture) => fixture.event),
        ["PostToolUse", "Stop"]
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("withFreshSamples", () => {
  it("adds a fresh payload of a new shape as a logged sample and keeps every committed one", () => {
    const old = committed({ a: "x" });
    old.samples.push({ run: "deny", payload: { a: "y" }, hookAnswer: { decision: "block" } });
    const next = withFreshSamples(old, [{ a: "x", b: 1 }]);
    assert.deepEqual(next.samples.slice(0, 2), old.samples);
    assert.deepEqual(next.samples[2], { run: "log", payload: { a: "x", b: 1 }, hookAnswer: null });
    assert.equal(old.samples.length, 2);
  });

  it("adds nothing for a payload whose shape a committed sample already has", () => {
    const old = committed({ a: "x" });
    assert.equal(withFreshSamples(old, [{ a: "other" }]).samples.length, 1);
  });

  it("adds a new shape once, however many payloads carry it", () => {
    const old = committed({ a: "x" });
    assert.equal(withFreshSamples(old, [{ a: 1 }, { a: 2 }]).samples.length, 2);
  });
});
