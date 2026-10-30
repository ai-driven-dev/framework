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
  `✗ ${TOKENS}: space.md: sizes are in rem, not px`,
  `✗ ${DIALOG}: package "left-pad" is not in system.md libraries`,
];

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-ui-validate-"));
  writeProject(tmp);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.equal(fs.existsSync(tmp), false);
});

function breakOnePerFamily() {
  edit(tmp, BRAND, "## Users\n\nAnalysts.\n\n", "");
  editTokens(tmp, (tree) => (tree.space.md.$value = { value: 16, unit: "px" }));
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

const postToolUse = (filePath) => JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, tool_name: "Write", tool_input: { file_path: filePath } });
const sessionStart = () => JSON.stringify({ hook_event_name: "SessionStart", cwd: tmp, source: "startup" });
const silent = { code: 0, out: "", err: "" };

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
      assert.deepEqual(hook(postToolUse(path.join(tmp, BRAND))), { code: 2, out: "", err: `${FAILURES.join("\n")}\n` });
    });

    it("hands the problems back when a write lands under a code root", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(postToolUse(path.join(tmp, "src/ui/Button.tsx"))), { code: 2, out: "", err: `${FAILURES.join("\n")}\n` });
    });

    it("stays silent when a write lands elsewhere", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(postToolUse(path.join(tmp, "README.md"))), silent);
    });

    it("stays silent on a valid project", () => {
      assert.deepEqual(hook(postToolUse(path.join(tmp, BRAND))), silent);
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

    it("never blocks when a check throws", { skip: process.platform === "win32" }, () => {
      fs.symlinkSync(path.join(tmp, "nowhere.md"), path.join(tmp, UI, "dangling.md"));
      assert.deepEqual(hook(sessionStart()), silent);
      assert.deepEqual(hook(postToolUse(path.join(tmp, BRAND))), silent);
    });
  });
});
