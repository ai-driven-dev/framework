const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, HISTORY, makeTmp, removeTmp, filesUnder, engine, validate, writeProject, edit, put, record } = require("../fixtures/aidd-ui/project.js");

// The bump command is driven as a subprocess, as the skill calls it, and judged by the engine's own
// validator once the change it carries is made.
const TASK = "aidd_docs/tasks/recolour";
const DEBT = `${UI}/code-debt.json`;
const REACHED = ["components/button", "components/dialog", "components/search-field", "history", "reviews/first-pass", "screens/home"].map((name) => `${UI}/${name}.md`);

let tmp;

beforeEach(() => {
  tmp = makeTmp("aidd-ui-bump-");
  writeProject(tmp);
});

afterEach(() => removeTmp(tmp));

const bump = (...args) => {
  const done = engine("bump", "--root", tmp, ...args);
  return { code: done.status, report: done.stdout ? JSON.parse(done.stdout) : null, err: done.stderr };
};
const change = (...extra) => bump("--task", TASK, "--change", "new action colour", ...extra);
const read = (name) => fs.readFileSync(path.join(tmp, name), "utf8");
/** Every file of the project with its bytes, to prove a refusal wrote nothing. */
const snapshot = () => filesUnder(tmp).map((file) => [file, fs.readFileSync(file, "utf8")]);

describe("aidd-ui bump", () => {
  describe("a token change", () => {
    it("raises each reached element and screen by one, proposed, with its row in history.md, and lists the files it changed", () => {
      const { code, report, err } = change("color.action.default");
      assert.deepEqual([code, err], [0, ""]);
      assert.deepEqual(report, { changed: REACHED, left: [{ id: "old-button", why: "deprecated" }] });
      for (const id of ["components/button", "components/dialog", "components/search-field", "screens/home"]) {
        const record = read(`${UI}/${id}.md`);
        assert.ok(record.includes("\nversion: 2\n"), id);
        assert.ok(record.includes("\nstatus: proposed\n"), id);
        assert.match(read(HISTORY), new RegExp(`\\| ${path.basename(id)} \\| 1 \\| created \\| no \\| aidd_docs/tasks/ds-init \\| [0-9a-f]{12} \\|\n`), id);
        assert.ok(read(HISTORY).includes(`| ${path.basename(id)} | 2 | new action colour | no | ${TASK} | |\n`), id);
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
      assert.deepEqual(report.changed, ["components/old-button", "history"].map((name) => `${UI}/${name}.md`));
      assert.deepEqual(report.left, []);
      assert.ok(read(HISTORY).includes(`| button | 2 | new action colour; renamed | yes | ${TASK} | |\n`));
      assert.ok(read(`${UI}/components/button.md`).includes("\nversion: 2\n"));
      assert.equal(read(HISTORY).split("| button | 2 |").length, 2);
      assert.equal(read(`${UI}/reviews/first-pass.md`).split("| home | default | 2 | pending | |").length, 2);
      assert.equal(validate(tmp).code, 0);
    });

    it("leaves an element already raised as breaking, and one a non-breaking change reaches again, as they were", () => {
      bump("--task", TASK, "--change", "renamed", "--breaking", "color.action.default");
      const before = read(HISTORY);
      const again = bump("--task", TASK, "--change", "renamed again", "--breaking", "color.action.default");
      const lighter = change("color.action.default");
      assert.deepEqual(again.report.changed, []);
      assert.deepEqual(lighter.report.changed, []);
      assert.ok(again.report.left.some(({ id, why }) => id === "button" && why === "already raised for this task"));
      assert.equal(read(HISTORY), before);
    });

    it("keeps the line ends of a row it turns to breaking", () => {
      change("color.action.default");
      fs.writeFileSync(path.join(tmp, HISTORY), read(HISTORY).replace(/\n/g, "\r\n"));
      bump("--task", TASK, "--change", "renamed", "--breaking", "color.action.default");
      assert.equal(/[^\r]\n/.test(read(HISTORY)), false);
      assert.ok(read(HISTORY).includes(`| button | 2 | new action colour; renamed | yes | ${TASK} | |\r\n`));
    });

    it("raises it again for another task", () => {
      change("color.action.default");
      bump("--task", "aidd_docs/tasks/other", "--change", "again", "color.action.default");
      assert.ok(read(`${UI}/components/button.md`).includes("\nversion: 3\n"));
    });

    it("keeps the line ends of a record, a review and the history written with CRLF, the lines it sets and inserts included", () => {
      const crlf = (name) => fs.writeFileSync(path.join(tmp, name), read(name).replace(/\n/g, "\r\n"));
      crlf(`${UI}/components/button.md`);
      crlf(`${UI}/reviews/first-pass.md`);
      crlf(HISTORY);
      change("color.action.default");
      for (const name of ["components/button", "reviews/first-pass", "history"]) assert.equal(/[^\r]\n/.test(read(`${UI}/${name}.md`)), false, name);
      assert.ok(read(HISTORY).includes(`| button | 2 | new action colour | no | ${TASK} | |\r\n`));
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
      assert.deepEqual(report.changed, [`${UI}/components/button.md`, `${UI}/components/dialog.md`, `${UI}/components/old-button.md`, `${UI}/components/search-field.md`, HISTORY, `${UI}/reviews/first-pass.md`, `${UI}/screens/home.md`]);
      assert.deepEqual(report.left, []);
      const old = read(`${UI}/components/old-button.md`);
      assert.ok(old.includes("\nversion: 3\n") && old.includes("\nstatus: deprecated\n"));
      assert.ok(read(HISTORY).includes("| old-button | 3 | action colour renamed | yes | aidd_docs/tasks/rename |"));
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
      assert.ok(read(HISTORY).includes(`| button | 2 | x | no | ${TASK} |`));
    });

    it("names a change that is empty or would break the history table, writing nothing", () => {
      for (const text of ["", "  ", "a | b", "a\nb"]) refused(["--task", TASK, "--change", text, "space.md"], 'aidd-ui: the change must be one line without "|"\n');
    });

    it("prints the usage and exits 2 without a task, a change or a ref", () => {
      const usage = 'usage: node aidd-ui.cjs bump --task <aidd_docs/tasks/…> (--change "<text>" [--breaking] | --created | --removed) <token or id>… [--root <dir>]\n';
      const cases = [["--change", "x", "space.md"], ["--task", TASK, "space.md"], ["--task", TASK, "--change", "x"], ["--task", TASK, "--change"]];
      const created = [["--task", TASK, "--created"], ["--task", TASK, "--created", "--change", "x", "button"], ["--task", TASK, "--created", "--breaking", "button"]];
      const removed = [["--task", TASK, "--removed"], ["--task", TASK, "--removed", "--change", "x", "button"], ["--task", TASK, "--removed", "--breaking", "button"], ["--task", TASK, "--removed", "--created", "button"]];
      for (const args of [...cases, ...created, ...removed]) refused(args, usage);
    });

    it("names a project without a design system", () => {
      fs.rmSync(path.join(tmp, UI), { recursive: true });
      refused(["--task", TASK, "--change", "x", "space.md"], "aidd-ui: no design system under aidd_docs/ui\n");
    });

    it("names a record it cannot raise: a version that is no integer, no status line, writing nothing", () => {
      edit(tmp, `${UI}/components/dialog.md`, "\nversion: 1\n", "\nversion: 1.5\n");
      refused(["--task", TASK, "--change", "x", "space.md"], `aidd-ui: ${UI}/components/dialog.md: version "1.5" is no integer\n`);
      edit(tmp, `${UI}/components/dialog.md`, "\nversion: 1.5\n", "\nversion: 1\n");
      edit(tmp, `${UI}/components/button.md`, "status: validated\n", "");
      refused(["--task", TASK, "--change", "x", "space.md"], `aidd-ui: ${UI}/components/button.md has no status line in its front matter\n`);
    });

    it("names a history.md without a table, writing nothing", () => {
      put(tmp, HISTORY, "# History\n");
      refused(["--task", TASK, "--change", "x", "space.md"], `aidd-ui: ${HISTORY} has no table\n`);
    });
  });

  describe("a creation", () => {
    const create = (...refs) => bump("--task", TASK, "--created", ...refs);
    const addLogo = () => {
      put(tmp, `${UI}/assets/logo.md`, record(["id: logo", "kind: asset", "status: proposed", "version: 1", "type: icon", "file: logo.svg", "alt: Logo"]));
      put(tmp, `${UI}/assets/logo.svg`, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="10" cy="10" r="7"/></svg>\n');
    };

    it("writes the first row of a new record, its version 1, and leaves the design system valid", () => {
      addLogo();
      assert.equal(validate(tmp).code, 1);
      const { code, report, err } = create("logo");
      assert.deepEqual([code, err, report], [0, "", { changed: [HISTORY] }]);
      assert.ok(read(HISTORY).includes(`| logo | 1 | created | no | ${TASK} | |\n`));
      assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
    });

    it("writes the first publication of the system as 1.0.0, and builds history.md when there is none", () => {
      fs.rmSync(path.join(tmp, HISTORY));
      create("system");
      assert.equal(read(HISTORY), `# History\n\n| Id | Version | Change | Breaking | Task | Fingerprint |\n| --- | --- | --- | --- | --- | --- |\n| system | 1.0.0 | created | no | ${TASK} | |\n`);
    });

    it("writes the code's colour literals as its debt when it creates the system, files and literals sorted", () => {
      fs.rmSync(path.join(tmp, HISTORY));
      fs.rmSync(path.join(tmp, DEBT));
      fs.appendFileSync(path.join(tmp, "src/ui/HomePage.tsx"), 'const a = "#ff0000";\nconst b = "#00ff00";\nconst c = "#ff0000";\n');
      fs.appendFileSync(path.join(tmp, "src/ui/Button.tsx"), 'const a = "rgba(0, 0, 0, 0.5)";\n');
      assert.deepEqual(create("system").report, { changed: [DEBT, HISTORY] });
      assert.equal(read(DEBT), `${JSON.stringify({ "src/ui/Button.tsx": { "rgba(": 1 }, "src/ui/HomePage.tsx": { "#00ff00": 1, "#ff0000": 2 } }, null, 2)}\n`);
    });

    it("writes an empty debt when the code holds no colour literal, and none for another record", () => {
      fs.rmSync(path.join(tmp, DEBT));
      addLogo();
      assert.deepEqual(create("logo").report, { changed: [HISTORY] });
      assert.equal(fs.existsSync(path.join(tmp, DEBT)), false);
      fs.rmSync(path.join(tmp, HISTORY));
      create("system");
      assert.equal(read(DEBT), "{}\n");
    });

    it("writes one row per id, once", () => {
      addLogo();
      create("logo", "logo");
      assert.equal(read(HISTORY).split("| logo |").length, 2);
    });

    it("names an id that is no versioned record, or already has history, writing nothing", () => {
      const refusals = [["ghost", 'no versioned record named "ghost"'], ["brand", 'no versioned record named "brand"'], ["button", '"button" already has history']];
      for (const [id, message] of refusals) {
        const before = snapshot();
        const done = create(id);
        assert.deepEqual([done.code, done.report, done.err], [2, null, `aidd-ui: ${message}\n`]);
        assert.deepEqual(snapshot(), before);
      }
    });
  });

  describe("a removal", () => {
    const remove = (...ids) => bump("--task", TASK, "--removed", ...ids);

    it("writes a removed row one version above the last, breaking, without a fingerprint, and the design system valid once the record and render are gone", () => {
      const { code, report, err } = remove("old-button");
      assert.deepEqual([code, err, report], [0, "", { changed: [HISTORY] }]);
      assert.ok(read(HISTORY).endsWith(`| old-button | 3 | removed | yes | ${TASK} | |\n`));
      for (const name of ["old-button.md", "old-button.html"]) fs.rmSync(path.join(tmp, UI, "components", name));
      assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
    });

    it("names an id without history, and the system, writing nothing", () => {
      for (const [id, message] of [["ghost", 'no history row of "ghost"'], ["system", "system cannot be removed"]]) {
        const before = snapshot();
        const done = remove(id);
        assert.deepEqual([done.code, done.report, done.err], [2, null, `aidd-ui: ${message}\n`]);
        assert.deepEqual(snapshot(), before);
      }
    });
  });
});
