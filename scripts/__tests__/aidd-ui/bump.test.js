const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, writeProject, edit } = require("../fixtures/aidd-ui/project.js");

// The bump command is driven as a subprocess, as the skill calls it, and judged by the engine's own
// validator once the change it carries is made.
const ENGINE = path.resolve(__dirname, "../../../plugins/aidd-ui/hooks/aidd-ui.cjs");
const TASK = "aidd_docs/tasks/recolour";
const REACHED = ["components/button", "components/dialog", "components/search-field", "reviews/first-pass", "screens/home"].map((name) => `${UI}/${name}.md`);

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-ui-bump-"));
  writeProject(tmp);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.equal(fs.existsSync(tmp), false);
});

const run = (...args) => spawnSync(process.execPath, [ENGINE, ...args], { encoding: "utf8" });
const bump = (...args) => {
  const done = run("bump", "--root", tmp, ...args);
  return { code: done.status, report: done.stdout ? JSON.parse(done.stdout) : null, err: done.stderr };
};
const change = (...extra) => bump("--task", TASK, "--change", "new action colour", ...extra);
const read = (name) => fs.readFileSync(path.join(tmp, name), "utf8");
const validate = () => ({ code: run("validate", tmp).status, out: run("validate", tmp).stdout.split("\n").filter(Boolean) });
/** Every file of the project with its bytes, to prove a refusal wrote nothing. */
const snapshot = (dir = tmp) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? snapshot(path.join(dir, entry.name)) : [[path.join(dir, entry.name), fs.readFileSync(path.join(dir, entry.name), "utf8")]]));

describe("aidd-ui bump", () => {
  describe("a token change", () => {
    it("raises each reached element and screen by one, proposed, with its History row, and lists the files it changed", () => {
      const { code, report, err } = change("color.action.default");
      assert.deepEqual([code, err], [0, ""]);
      assert.deepEqual(report, { changed: REACHED, left: [{ id: "old-button", why: "deprecated" }] });
      for (const id of ["components/button", "components/dialog", "components/search-field", "screens/home"]) {
        const record = read(`${UI}/${id}.md`);
        assert.ok(record.includes("\nversion: 2\n"), id);
        assert.ok(record.includes("\nstatus: proposed\n"), id);
        assert.ok(record.includes(`| 1 | created | no | aidd_docs/tasks/ds-init |\n| 2 | new action colour | no | ${TASK} |`), id);
      }
    });

    it("adds one pending verdict per state at the new version to a review that names a raised screen", () => {
      change("color.action.default");
      assert.ok(read(`${UI}/reviews/first-pass.md`).includes(["| home | error | 1 | pending | |", "| home | default | 2 | pending | |", "| home | empty | 2 | pending | |", "| home | loading | 2 | pending | |", "| home | error | 2 | pending | |"].join("\n")));
    });

    it("leaves a review that names no raised screen, a deprecated element, and the system, as they were", () => {
      edit(tmp, `${UI}/reviews/first-pass.md`, "screens: [home]", "screens: [about]");
      const before = Object.fromEntries(["reviews/first-pass", "components/old-button", "system"].map((name) => [name, read(`${UI}/${name}.md`)]));
      const { report } = change("color.action.default");
      assert.deepEqual(report.changed, REACHED.filter((file) => !file.includes("reviews")));
      for (const [name, bytes] of Object.entries(before)) assert.equal(read(`${UI}/${name}.md`), bytes, name);
    });

    it("raises an element once per task: a second run for the same task leaves it, and says so", () => {
      change("color.action.default");
      const again = change("color.action.default");
      assert.deepEqual(again.report, { changed: [], left: ["button", "dialog", "home", "search-field"].map((id) => ({ id, why: "already raised for this task" })).concat([{ id: "old-button", why: "deprecated" }]).sort((a, b) => (a.id < b.id ? -1 : 1)) });
      assert.ok(read(`${UI}/components/button.md`).includes("\nversion: 2\n"));
      assert.equal(read(`${UI}/reviews/first-pass.md`).split("| home | default | 2 | pending | |").length, 2);
    });

    it("turns the row of an element already raised for the task to breaking when a later change breaks, appending the change", () => {
      change("color.action.default");
      const { report } = bump("--task", TASK, "--change", "renamed", "--breaking", "color.action.default");
      assert.deepEqual(report.changed, ["components/button", "components/dialog", "components/old-button", "components/search-field", "screens/home"].map((name) => `${UI}/${name}.md`));
      assert.deepEqual(report.left, []);
      const record = read(`${UI}/components/button.md`);
      assert.ok(record.includes(`| 1 | created | no | aidd_docs/tasks/ds-init |\n| 2 | new action colour; renamed | yes | ${TASK} |\n`));
      assert.ok(record.includes("\nversion: 2\n"));
      assert.equal(record.split(`| ${TASK} |`).length, 2);
      assert.equal(read(`${UI}/reviews/first-pass.md`).split("| home | default | 2 | pending | |").length, 2);
      assert.equal(validate().code, 0);
    });

    it("leaves an element already raised as breaking, and one a non-breaking change reaches again, as they were", () => {
      bump("--task", TASK, "--change", "renamed", "--breaking", "color.action.default");
      const before = read(`${UI}/components/button.md`);
      const again = bump("--task", TASK, "--change", "renamed again", "--breaking", "color.action.default");
      const lighter = change("color.action.default");
      assert.deepEqual(again.report.changed, []);
      assert.deepEqual(lighter.report.changed, []);
      assert.ok(again.report.left.some(({ id, why }) => id === "button" && why === "already raised for this task"));
      assert.equal(read(`${UI}/components/button.md`), before);
    });

    it("keeps the line ends of a row it turns to breaking", () => {
      change("color.action.default");
      fs.writeFileSync(path.join(tmp, `${UI}/components/button.md`), read(`${UI}/components/button.md`).replace(/\n/g, "\r\n"));
      bump("--task", TASK, "--change", "renamed", "--breaking", "color.action.default");
      assert.equal(/[^\r]\n/.test(read(`${UI}/components/button.md`)), false);
      assert.ok(read(`${UI}/components/button.md`).includes(`| 2 | new action colour; renamed | yes | ${TASK} |\r\n`));
    });

    it("raises it again for another task", () => {
      change("color.action.default");
      bump("--task", "aidd_docs/tasks/other", "--change", "again", "color.action.default");
      assert.ok(read(`${UI}/components/button.md`).includes("\nversion: 3\n"));
    });

    it("keeps the line ends of a record and of a review written with CRLF, the lines it sets and inserts included", () => {
      const crlf = (name) => fs.writeFileSync(path.join(tmp, name), read(name).replace(/\n/g, "\r\n"));
      crlf(`${UI}/components/button.md`);
      crlf(`${UI}/reviews/first-pass.md`);
      change("color.action.default");
      for (const name of ["components/button", "reviews/first-pass"]) assert.equal(/[^\r]\n/.test(read(`${UI}/${name}.md`)), false, name);
      assert.ok(read(`${UI}/components/button.md`).includes("\r\nversion: 2\r\n"));
      assert.ok(read(`${UI}/reviews/first-pass.md`).includes("| home | default | 2 | pending | |\r\n"));
      assert.equal(/\r/.test(read(`${UI}/components/dialog.md`)), false);
    });

    it("keeps the code links of what it raises, and an element no ref reaches as it was", () => {
      change("space.md");
      assert.ok(read(`${UI}/components/button.md`).includes("code: src/ui/Button.tsx#Button@1\n"));
      assert.ok(read(`${UI}/components/old-button.md`).includes("status: deprecated"));
    });
  });

  describe("a breaking change", () => {
    const rename = (...refs) => bump("--task", "aidd_docs/tasks/rename", "--change", "action colour renamed", "--breaking", ...refs);

    it("raises a deprecated element citing the token, as breaking, keeping its status", () => {
      const { report } = rename("color.action.default");
      assert.deepEqual(report.changed, [`${UI}/components/button.md`, `${UI}/components/dialog.md`, `${UI}/components/old-button.md`, `${UI}/components/search-field.md`, `${UI}/reviews/first-pass.md`, `${UI}/screens/home.md`]);
      assert.deepEqual(report.left, []);
      const old = read(`${UI}/components/old-button.md`);
      assert.ok(old.includes("\nversion: 3\n") && old.includes("\nstatus: deprecated\n"));
      assert.ok(old.includes("| 3 | action colour renamed | yes | aidd_docs/tasks/rename |"));
    });

    it("raises a deprecated element that reaches the token through an element it uses", () => {
      edit(tmp, `${UI}/components/old-button.md`, "uses: []", "uses: [button]");
      edit(tmp, `${UI}/components/old-button.md`, "tokens: [color.action.default]", "tokens: []");
      assert.ok(rename("color.action.default").report.changed.includes(`${UI}/components/old-button.md`));
    });

    it("leaves a deprecated element when only an element it uses changes", () => {
      edit(tmp, `${UI}/components/old-button.md`, "uses: []", "uses: [button]");
      const { report } = rename("button");
      assert.equal(report.changed.includes(`${UI}/components/old-button.md`), false);
      assert.deepEqual(report.left, [{ id: "old-button", why: "deprecated" }]);
    });
  });

  describe("a refusal", () => {
    const refused = (args, message, code = 2) => {
      const before = snapshot();
      const done = bump(...args);
      assert.deepEqual([done.code, done.report, done.err], [code, null, message]);
      assert.deepEqual(snapshot(), before);
    };

    it("names an unknown token or id, writing nothing", () => {
      refused(["--task", TASK, "--change", "x", "color.action.default", "color.nope"], 'aidd-ui: no token or element named "color.nope"\n');
    });

    it("names a task that is no folder under aidd_docs/tasks, writing nothing", () => {
      for (const task of ["docs/tasks/recolour", "aidd_docs/tasks", "aidd_docs/tasks/../other", "recolour"]) refused(["--task", task, "--change", "x", "space.md"], `aidd-ui: the task "${task}" must be a folder under aidd_docs/tasks/\n`);
    });

    it("takes the task as a folder, a slash at its end not counting", () => {
      assert.equal(bump("--task", `${TASK}/`, "--change", "x", "space.md").code, 0);
      assert.ok(read(`${UI}/components/button.md`).includes(`| 2 | x | no | ${TASK} |`));
    });

    it("names a change that is empty or would break the History table, writing nothing", () => {
      for (const text of ["", "  ", "a | b", "a\nb"]) refused(["--task", TASK, "--change", text, "space.md"], 'aidd-ui: the change must be one line without "|"\n');
    });

    it("prints the usage and exits 2 without a task, a change or a ref", () => {
      const usage = 'usage: node aidd-ui.cjs bump --task <aidd_docs/tasks/…> --change "<text>" [--breaking] <token or id>… [--root <dir>]\n';
      for (const args of [["--change", "x", "space.md"], ["--task", TASK, "space.md"], ["--task", TASK, "--change", "x"], ["--task", TASK, "--change"]]) refused(args, usage);
    });

    it("names a project without a design system", () => {
      fs.rmSync(path.join(tmp, UI), { recursive: true });
      refused(["--task", TASK, "--change", "x", "space.md"], "aidd-ui: no design system under aidd_docs/ui\n");
    });

    it("names a record it cannot raise: a version that is no integer, no status line, no History table, writing nothing", () => {
      edit(tmp, `${UI}/components/dialog.md`, "\nversion: 1\n", "\nversion: 1.5\n");
      refused(["--task", TASK, "--change", "x", "space.md"], `aidd-ui: ${UI}/components/dialog.md: version "1.5" is no integer\n`);
      edit(tmp, `${UI}/components/dialog.md`, "\nversion: 1.5\n", "\nversion: 1\n");
      edit(tmp, `${UI}/components/button.md`, "status: validated\n", "");
      refused(["--task", TASK, "--change", "x", "space.md"], `aidd-ui: ${UI}/components/button.md has no status line in its front matter\n`);
      edit(tmp, `${UI}/components/button.md`, "uses: []\n", "status: validated\nuses: []\n");
      edit(tmp, `${UI}/components/button.md`, "## History", "## Past");
      refused(["--task", TASK, "--change", "x", "space.md"], `aidd-ui: ${UI}/components/button.md has no table under "## History"\n`);
    });
  });
});
