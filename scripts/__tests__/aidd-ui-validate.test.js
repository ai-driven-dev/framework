const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, writeProject, edit, editTokens } = require("./fixtures/aidd-ui/project.js");

// The entries are scripts a user's machine runs, so each is driven as a subprocess with its
// argument or its hook payload on stdin, which is what ships.
const HOOKS = path.resolve(__dirname, "../../plugins/aidd-ui/hooks");
const VALIDATE = path.join(HOOKS, "validate-ui.cjs");
const HOOK = path.join(HOOKS, "ui-hook.cjs");

const BRAND = `${UI}/brand.md`;
const DIALOG = `${UI}/components/dialog.md`;
const TOKENS = `${UI}/tokens.json`;

/** One mutation from each family: records, tokens, code. */
const FAILURES = [
  `✗ ${BRAND}: lacks "## Users"`,
  `✗ ${TOKENS}: space.md: unit "em" must be px or rem`,
  `✗ ${DIALOG}: package "left-pad" is not in system.md libraries`,
];

let tmp;
let sid;
let sessionCount = 0;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-ui-validate-"));
  writeProject(tmp);
  sid = `t${process.pid}-${sessionCount++}`;
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(path.join(os.tmpdir(), `aidd-ui-turn-${sid}`), { force: true });
  assert.equal(fs.existsSync(tmp), false);
});

function breakOnePerFamily() {
  edit(tmp, BRAND, "## Users\n\nAnalysts.\n\n", "");
  editTokens(tmp, (tree) => (tree.space.md.$value = { value: 1, unit: "em" }));
  edit(tmp, DIALOG, "package:@radix-ui/react-dialog#Root", "package:left-pad#Pad");
}

const lines = (text) => text.split("\n").filter(Boolean);

function validate(root) {
  const run = spawnSync(process.execPath, [VALIDATE, root], { encoding: "utf8" });
  return { code: run.status, out: lines(run.stdout), err: run.stderr };
}

function hook(input) {
  const run = spawnSync(process.execPath, [HOOK], { input, encoding: "utf8" });
  return { code: run.status, out: run.stdout, err: run.stderr };
}

// Claude Code and Codex carry tool_response, Copilot tool_result: that is how the hook tells them apart.
const postToolUse = (filePath) => JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, session_id: sid, tool_name: "Write", tool_input: { file_path: filePath }, tool_response: {} });
/** A patch as Codex's apply_patch and Copilot's Edit write it: one header line per file. */
const patch = (...headers) => `*** Begin Patch\n${headers.map((header) => `*** ${header}\n@@\n+x\n`).join("")}*** End Patch`;
const codexPatch = (...headers) => JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, session_id: sid, tool_name: "apply_patch", tool_input: { command: patch(...headers) }, tool_response: {} });
const copilotPatch = (...headers) => JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, session_id: sid, tool_name: "Edit", tool_input: patch(...headers), tool_result: {} });
const sessionStart = () => JSON.stringify({ hook_event_name: "SessionStart", cwd: tmp, source: "startup" });
const stop = (active = false) => JSON.stringify({ hook_event_name: "Stop", cwd: tmp, session_id: sid, stop_hook_active: active });
const silent = { code: 0, out: "", err: "" };
const feedbackText = (problems) => [`aidd-ui: the write was saved, fix ${problems.length} problems:`, ...problems].join("\n");
// Claude Code and Codex read additionalContext under hookSpecificOutput; Codex fails the hook on any other key.
const claudeFeedback = (problems) => ({ code: 0, out: JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: feedbackText(problems) } }), err: "" });
// Copilot reads only a top-level additionalContext.
const copilotFeedback = (problems) => ({ code: 0, out: JSON.stringify({ additionalContext: feedbackText(problems) }), err: "" });
const finish = (problems) => ({ code: 0, out: JSON.stringify({ decision: "block", reason: [`aidd-ui: the design system has ${problems.length} problems, fix them before you finish:`, ...problems].join("\n") }), err: "" });

// The plugin's own declaration: every host builds its hooks from this file, so a missing event
// here means no install runs that check.
describe("aidd-ui hooks declaration", () => {
  const declared = JSON.parse(fs.readFileSync(path.join(HOOKS, "hooks.json"), "utf8")).hooks;

  it("runs the hook at every moment it handles: session start, after a write, turn end", () => {
    for (const event of ["SessionStart", "PostToolUse", "Stop"]) {
      const commands = declared[event].flatMap((group) => group.hooks.map((hook) => hook.command));
      assert.deepEqual(commands, [`node \${CLAUDE_PLUGIN_ROOT}/hooks/ui-hook.cjs`]);
    }
  });
});

describe("aidd-ui validator entries", () => {
  it("prints VALID for the valid project", () => {
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });

  describe("E1 no design system", () => {
    it("prints nothing without aidd_docs/ui/", () => {
      fs.rmSync(path.join(tmp, UI), { recursive: true });
      assert.deepEqual(validate(tmp), { code: 0, out: [], err: "" });
    });
  });

  describe("E2 every check runs", () => {
    it("prints one line per broken rule, from each family, and exits 1", () => {
      breakOnePerFamily();
      assert.deepEqual(validate(tmp), { code: 1, out: FAILURES, err: "" });
    });
  });

  describe("E3 PostToolUse", () => {
    it("hands the problems back when a write lands under aidd_docs/ui/", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(postToolUse(path.join(tmp, BRAND))), claudeFeedback(FAILURES));
    });

    it("hands the problems back when a write lands under a code root", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(postToolUse(path.join(tmp, "src/ui/Button.tsx"))), claudeFeedback(FAILURES));
    });

    it("hands the problems back when a write lands under a code root written with a leading ./", () => {
      edit(tmp, `${UI}/system.md`, "code-roots: [src/ui]", "code-roots: [./src/ui]");
      breakOnePerFamily();
      assert.deepEqual(hook(postToolUse(path.join(tmp, "src/ui/Button.tsx"))), claudeFeedback(FAILURES));
    });

    it("hands the problems back when a Codex patch updates a file under aidd_docs/ui/", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(codexPatch(`Update File: ${path.join(tmp, BRAND)}`)), claudeFeedback(FAILURES));
    });

    it("hands the problems back when a Copilot patch adds a file under aidd_docs/ui/ after one elsewhere", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(copilotPatch(`Add File: ${path.join(tmp, "README.md")}`, `Add File: ${path.join(tmp, BRAND)}`)), copilotFeedback(FAILURES));
    });

    it("hands the problems back when Copilot's Edit replaces a string in a file under aidd_docs/ui/", () => {
      breakOnePerFamily();
      const input = JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, tool_name: "Edit", tool_input: { path: path.join(tmp, BRAND), old_str: "a", new_str: "b" }, tool_result: {} });
      assert.deepEqual(hook(input), copilotFeedback(FAILURES));
    });

    it("stays silent when a patch touches only files elsewhere", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(codexPatch(`Update File: ${path.join(tmp, "README.md")}`)), silent);
    });

    it("stays silent when a write lands elsewhere", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(postToolUse(path.join(tmp, "README.md"))), silent);
    });

    it("stays silent on a valid project", () => {
      assert.deepEqual(hook(postToolUse(path.join(tmp, BRAND))), silent);
    });
  });

  describe("E7 Stop", () => {
    it("blocks once after a write under aidd_docs/ui/, with the problems as the reason", () => {
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, BRAND)));
      assert.deepEqual(hook(stop()), finish(FAILURES));
    });

    it("lets the turn end on the repeated Stop, the one it asked for", () => {
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, BRAND)));
      hook(stop());
      assert.deepEqual(hook(stop(true)), silent);
    });

    it("ends the forced turn even when that turn writes a UI file again", () => {
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, BRAND)));
      hook(stop());
      hook(postToolUse(path.join(tmp, BRAND)));
      assert.deepEqual(hook(stop(true)), silent);
    });

    it("hands the problems back on a second write in the same turn", () => {
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, BRAND)));
      assert.deepEqual(hook(postToolUse(path.join(tmp, BRAND))), claudeFeedback(FAILURES));
    });

    it("never writes through a link planted at the mark's path", () => {
      const target = path.join(tmp, "victim.txt");
      fs.writeFileSync(target, "keep");
      fs.symlinkSync(target, path.join(os.tmpdir(), `aidd-ui-turn-${sid}`));
      hook(postToolUse(path.join(tmp, BRAND)));
      assert.equal(fs.readFileSync(target, "utf8"), "keep");
    });

    it("consumes the turn mark: a later Stop without a new write is silent", () => {
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, BRAND)));
      hook(stop());
      assert.deepEqual(hook(stop()), silent);
    });

    it("stays silent at Stop when no UI file was written this turn", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(stop()), silent);
    });

    it("stays silent at Stop when the write landed elsewhere", () => {
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, "README.md")));
      assert.deepEqual(hook(stop()), silent);
    });

    it("stays silent at Stop once the problems are fixed", () => {
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, BRAND)));
      writeProject(tmp);
      assert.deepEqual(hook(stop()), silent);
    });

    it("still hands the problems back when the session id is not a file-name part", () => {
      breakOnePerFamily();
      const input = JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, session_id: "a/b", tool_name: "Write", tool_input: { file_path: path.join(tmp, BRAND) }, tool_response: {} });
      assert.deepEqual(hook(input), claudeFeedback(FAILURES));
    });

    it("stays silent without a session id, since it cannot tell a turn apart", () => {
      breakOnePerFamily();
      hook(JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, tool_name: "Write", tool_input: { file_path: path.join(tmp, BRAND) }, tool_response: {} }));
      assert.deepEqual(hook(JSON.stringify({ hook_event_name: "Stop", cwd: tmp })), silent);
    });
  });

  describe("E4 SessionStart", () => {
    it("prints the count then the problems, and exits 0", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(sessionStart()), { code: 0, out: `aidd-ui: 3 problems\n${FAILURES.join("\n")}\n`, err: "" });
    });

    it("stays silent without aidd_docs/ui/", () => {
      fs.rmSync(path.join(tmp, UI), { recursive: true });
      assert.deepEqual(hook(sessionStart()), silent);
    });
  });

  describe("E5 anything else is silent", () => {
    it("ignores a PostToolUse payload without tool_input.file_path, as a host without matcher sends", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, tool_input: {} })), silent);
    });

    for (const [name, input] of [["empty", ""], ["non-JSON", "not json"]]) {
      it(`ignores ${name} stdin`, () => {
        assert.deepEqual(hook(input), silent);
      });
    }
  });

  describe("E6 unreadable files", { skip: process.platform === "win32" }, () => {
    const DANGLING = `${UI}/dangling.md`;
    const UNREADABLE = `✗ ${DANGLING}: unreadable`;

    it("names an unreadable record and checks the rest, in every entry", () => {
      fs.symlinkSync(path.join(tmp, "nowhere.md"), path.join(tmp, DANGLING));
      assert.deepEqual(validate(tmp), { code: 1, out: [UNREADABLE], err: "" });
      assert.deepEqual(hook(sessionStart()), { code: 0, out: `aidd-ui: 1 problems\n${UNREADABLE}\n`, err: "" });
      assert.deepEqual(hook(postToolUse(path.join(tmp, BRAND))), claudeFeedback([UNREADABLE]));
    });

    it("names an unreadable file under a code root", () => {
      fs.symlinkSync(path.join(tmp, "src/ui"), path.join(tmp, "src/ui/Folder.css"));
      assert.deepEqual(validate(tmp), {
        code: 1,
        out: ["✗ src/ui/Folder.css: no record links it and no ignore covers it", "✗ src/ui/Folder.css: unreadable"],
        err: "",
      });
    });

    it("names an unreadable folder of the design system instead of crashing", { skip: process.getuid?.() === 0 }, () => {
      const folder = path.join(tmp, UI, "journeys");
      fs.chmodSync(folder, 0o000);
      try {
        assert.deepEqual(validate(tmp), { code: 1, out: [`✗ ${UI}/journeys: unreadable`], err: "" });
      } finally {
        fs.chmodSync(folder, 0o755);
      }
    });
  });
});
