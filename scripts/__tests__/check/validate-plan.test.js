const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it, before, after } = require("node:test");

const SKILL = path.resolve(__dirname, "../../../plugins/aidd-dev/skills/01-plan");

/**
 * The templates are the contract the validator enforces, so a plan filled from them passes and each
 * rule has the one mutation that makes it fail. A changed template changes the verdict with no
 * edit to the script.
 */

let root;
let project;

const template = (name, skill = SKILL) => fs.readFileSync(path.join(skill, "assets", name), "utf8");

function withoutComments(text) {
  let out = "";
  for (let i = 0; i < text.length; ) {
    const open = text.indexOf("<!--", i);
    if (open < 0) return out + text.slice(i);
    out += text.slice(i, open);
    const close = text.indexOf("-->", open);
    i = close < 0 ? text.length : close + 3;
    while (text[i] === "\n") i += 1;
  }
  return out;
}

function fill(tpl, tree) {
  return withoutComments(tpl)
    .replace(/\{\{number\}\}/g, "1")
    .replace(/\{\{url\}\}/g, "https://example.test")
    .replace(/\| 1\.\.\. \|/g, "| 1 |")
    .replace(/\{\{the confirmed wireframe\}\}\n```/, "(1) x\n```\n\n1. x")
    .replace(/\{\{earlier phase numbers[^}]*\}\}/, "1")
    .replace(/\{\{[^}]*\}\}/g, "x")
    .replace(/```txt\n\.\n```/, tree ? `\`\`\`txt\n.\n${tree}\n\`\`\`` : "```txt\n.\n```");
}

function write(files) {
  const dir = fs.mkdtempSync(path.join(root, "plan-"));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  return dir;
}

const good = (tree, laterTree) => ({
  "plan.md": fill(template("plan-template.md")),
  "phase-1.md": fill(template("phase-template.md"), tree),
  "phase-2.md": fill(template("phase-template.md"), laterTree),
});

function run(files, skill = SKILL) {
  const dir = write(files);
  const r = spawnSync(process.execPath, [path.join(skill, "scripts/validate-plan.cjs"), dir], { cwd: project, encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const OK = { code: 0, out: "" };

const refused = (result, expected) => {
  assert.equal(result.code, 1);
  assert.match(result.out, expected);
};

const mutate = (file, edit, tree) => {
  const files = good(tree);
  files[file] = edit(files[file]);
  return files;
};

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "validate-plan-"));
  project = path.join(root, "project");
  fs.mkdirSync(path.join(project, "src"), { recursive: true });
  fs.writeFileSync(path.join(project, "src/a.js"), "");
  fs.writeFileSync(path.join(project, "src/old.js"), "");
  fs.writeFileSync(path.join(project, "src/with space.js"), "");
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

describe("validate-plan", () => {
  it("accepts a plan filled from the templates", () => {
    const r = run(good());
    assert.deepEqual(r, OK);
  });

  it("accepts the same plan saved with Windows line endings", () => {
    const files = Object.fromEntries(Object.entries(good()).map(([name, text]) => [name, text.replace(/\n/g, "\r\n")]));
    assert.deepEqual(run(files), OK);
  });

  it("asks for the files when the folder holds no plan", () => {
    const r = run({});
    assert.equal(r.code, 2);
    assert.match(r.out, /plan\.md: missing/);
  });

  it("accepts dependencies on earlier phases and none", () => {
    for (const deps of ["none", "`none`", "1"]) {
      const r = run(mutate("plan.md", (s) => s.replace(/\| 2\s+\|(.*)\| 1 \|/, `| 2 |$1| ${deps} |`)));
      assert.deepEqual(r, OK, deps);
    }
  });

  it("rejects a dependency that is not an earlier phase number", () => {
    for (const deps of ["2", "3", "x", "", "1, 2"]) {
      const r = run(mutate("plan.md", (s) => s.replace(/\| 2\s+\|(.*)\| 1 \|/, `| 2 |$1| ${deps} |`)));
      assert.equal(r.code, 1, JSON.stringify(deps));
      assert.match(r.out, /plan\.md:\d+ PLAN-03 phase 2 "Depends on" must be/, JSON.stringify(deps));
    }
  });

  it("rejects a wireframe without numbered regions", () => {
    for (const body of ["none", "N/A", "(1) x", "1. x"]) {
      const r = run(mutate("phase-1.md", (s) => s.replace(/(## Wireframe\n\n)[\s\S]*?(?=## Tasks)/, `$1\`\`\`txt\n${body}\n\`\`\`\n\n`)));
      assert.equal(r.code, 1, body);
      assert.match(r.out, /phase-1\.md:\d+ PLAN-06 section "Wireframe" needs a frame/, body);
    }
  });

  it("accepts a phase that omits the wireframe", () => {
    assert.deepEqual(run(mutate("phase-1.md", (s) => s.replace(/## Wireframe\n\n[\s\S]*?(?=## Tasks)/, ""))), OK);
  });

  const cases = [
    ["a comment left", "plan.md", (s) => `${s}\n<!-- x -->`, /plan\.md:\d+ PLAN-01 comment left/],
    ["a placeholder left", "plan.md", (s) => s.replace("Source: x", "Source: {{file}}"), /plan\.md:\d+ PLAN-01 placeholder/],
    ["a required section missing", "phase-1.md", (s) => s.replace(/## Test Scope[\s\S]*?(?=## Wireframe)/, ""), /phase-1\.md:\d+ PLAN-02 section "Test Scope" missing/],
    ["an unknown section", "plan.md", (s) => `${s}\n## Extra\n`, /plan\.md:\d+ PLAN-01 section "Extra" is not in the template/],
    ["sections out of order", "plan.md", (s) => s.replace("## Rules", "## Zzz").replace("## Impact", "## Rules").replace("## Zzz", "## Impact"), /out of order/],
    ["a table header renamed", "plan.md", (s) => s.replace("| Rule ", "| Law  "), /table header differs/],
    ["a front matter key missing", "plan.md", (s) => s.replace(/objective:.*\n/, ""), /front matter key "objective" missing/],
    ["a status outside the lifecycle", "phase-1.md", (s) => s.replace("status: pending", "status: implemented"), /phase-1\.md:\d+ PLAN-02 front matter "status" must be one of pending, in-progress, done/],
    ["an empty objective", "plan.md", (s) => s.replace(/objective:.*\n/, 'objective: ""\n'), /"objective" empty/],
    ["a source without a URL", "plan.md", (s) => s.replace("https://example.test", "somewhere"), /without a URL/],
    ["a gap in the task numbers", "phase-1.md", (s) => s.replace("### `1)`", "### `2)`"), /task numbers must run 1 to 1 with no gap/],
    ["a criterion mapping no task", "phase-1.md", (s) => s.replace(/^\| 1 \| x/m, "| 9 | x"), /acceptance row 9 maps to no task/],
    ["a title that leaves the template", "plan.md", (s) => s.replace("# Plan: x", "# Overview: x"), /title must start with "# Plan:"/],
    ["a front matter key the template lacks", "plan.md", (s) => s.replace(/^---\n/, "---\nowner: x\n"), /plan\.md:\d+ PLAN-01 front matter key "owner" is not in the template/],
    ["a plan listing no phase", "plan.md", (s) => s.replace(/^\| [12] +\|.*\n/gm, ""), /plan\.md:\d+ PLAN-03 no row in ## Phases/],
    ["a listed phase missing", "plan.md", (s) => s.replace(/(\| 2 .*\n)/, "$1| 3 | x | x |\n"), /phase-3\.md:\d+ PLAN-03 listed in plan\.md, file missing/],
  ];
  for (const [name, file, edit, expected] of cases) {
    it(`refuses ${name}`, () => {
      const r = run(mutate(file, edit));
      assert.equal(r.code, 1);
      assert.match(r.out, expected);
    });
  }

  it("accepts a plan in progress with a phase done", () => {
    const files = mutate("plan.md", (s) => s.replace("status: pending", "status: in-progress"));
    files["phase-1.md"] = files["phase-1.md"].replace("status: pending", "status: done");
    assert.deepEqual(run(files), OK);
  });

  it("accepts an omitted optional section and a placeholder inside code", () => {
    const files = mutate("plan.md", (s) => s.replace(/## Rules[\s\S]*?(?=## Decisions)/, "").replace("Source: x", "Source: `{{kept}}`"));
    assert.deepEqual(run(files), OK);
  });

  it("accepts a placeholder inside a fenced block", () => {
    assert.deepEqual(run(mutate("plan.md", (s) => `${s}\n\`\`\`txt\n{{kept}}\n\`\`\`\n`)), OK);
  });

  it("accepts a sources table that says none", () => {
    const files = mutate("plan.md", (s) => s.replace(/\| https:\/\/example\.test \|.*\n/, "| `none` | no external doc |\n"));
    assert.deepEqual(run(files), OK);
  });

  it("refuses a phase file the plan does not list", () => {
    refused(run({ ...good(), "phase-3.md": good()["phase-1.md"] }), /phase-3\.md:\d+ PLAN-03 not listed/);
  });

  describe("files to modify and delete", () => {
    const tree = (lines) => lines.join("\n");
    it("resolves a nested tree against the project", () => {
      assert.deepEqual(run(good(tree(["└── src/", "    └── ✏️ a.js"]))), OK);
    });
    it("checks a name with spaces whole, the mark before or after it", () => {
      assert.deepEqual(run(good(tree(["└── src/", "    └── ✏️ with space.js"]))), OK);
      assert.deepEqual(run(good(tree(["└── src/", "    └── with space.js ✏️"]))), OK);
    });
    it("refuses a missing name with spaces under its whole name", () => {
      refused(run(good(tree(["└── src/", "    └── ✏️ no such file.js"]))), /PLAN-05 src\/no such file\.js is marked modify/);
    });
    it("ignores a trailing comment or note, so an annotated entry is still checked by its name", () => {
      assert.deepEqual(run(good(tree(["└── src/", "    └── ✏️ a.js    # add a branch"]))), OK);
      assert.deepEqual(run(good(tree(["└── src/", "    └── a.js   ✏️ regenerate (auto)"]))), OK);
      assert.deepEqual(run(good(tree(["├── src/ # app code", "│   └── ✏️ a.js"]))), OK);
      refused(run(good(tree(["└── src/", "    └── ✏️ ghost.js    # add a branch"]))), /PLAN-05 src\/ghost\.js is marked modify/);
      refused(run(good(tree(["└── src/", "    └── ghost.js   ✏️ regenerate"]))), /PLAN-05 src\/ghost\.js is marked modify/);
      refused(run(good(tree(["├── src/ # app code", "│   └── ✏️ ghost.js"]))), /PLAN-05 src\/ghost\.js is marked modify/);
    });
    it("falls back to the first word when a single-spaced note follows the name", () => {
      assert.deepEqual(run(good(tree(["└── src/", "    └── ✏️ a.js (note)"]))), OK);
      assert.deepEqual(run(good(tree(["└── src/", "    └── ✏️ a.js # trace"]))), OK);
      refused(run(good(tree(["└── src/", "    └── ✏️ ghost.js # trace"]))), /PLAN-05 src\/ghost\.js is marked modify/);
      assert.deepEqual(run(good(tree(["└── src/", "    └── a.js (+ property) ✏️"]))), OK);
      assert.deepEqual(run(good(tree(["└── src/ (app code)", "    └── ✏️ a.js"]))), OK);
      refused(run(good(tree(["└── src/", "    └── ✏️ ghost.js (note)"]))), /PLAN-05 src\/ghost\.js is marked modify/);
      refused(run(good(tree(["└── src/", "    └── ghost.js (+ property) ✏️"]))), /PLAN-05 src\/ghost\.js is marked modify/);
      refused(run(good(tree(["└── src/ (app code)", "    └── ✏️ ghost.js"]))), /PLAN-05 src\/ghost\.js is marked modify/);
      assert.deepEqual(run(good(tree(["└── ✅ src/new.js (note)"]), tree(["└── ✏️ src/new.js"]))), OK);
    });
    it("refuses a file to modify that does not exist", () => {
      refused(run(good(tree(["└── src/", "    └── ✏️ ghost.js"]))), /PLAN-05 src\/ghost\.js is marked modify/);
    });
    it("refuses a file to delete that does not exist", () => {
      refused(run(good(tree(["└── ❌ src/ghost.js"]))), /PLAN-05 .*marked delete but does not exist/);
    });
    it("skips names that are not plain paths: globs, braces, notes", () => {
      assert.deepEqual(run(good(tree(["├── ✏️ src/**/*.ts", "├── ✏️ src/{a,b}.js", "└── ✏️ (several files)"]))), OK);
    });
    it("accepts a file to create that is absent", () => {
      assert.deepEqual(run(good(tree(["└── ✅ src/new.js"]))), OK);
    });
    it("accepts a file an earlier phase creates, modified by a later one", () => {
      assert.deepEqual(run(good(tree(["└── ✅ src/new.js"]), tree(["└── ✏️ src/new.js"]))), OK);
    });
    it("refuses a file no phase creates and the disk lacks, in a later phase", () => {
      refused(run(good(undefined, tree(["└── ✏️ src/ghost.js"]))), /phase-2\.md:\d+ PLAN-05 src\/ghost\.js is marked modify but does not exist/);
    });
    it("refuses a file an earlier phase deletes, modified by a later one", () => {
      const r = run(good(tree(["└── ❌ src/old.js"]), tree(["└── ✏️ src/old.js"])));
      refused(r, /phase-2\.md:\d+ PLAN-05 src\/old\.js is marked modify but does not exist/);
    });
    it("accepts a file an earlier phase deletes, a later phase creates again and a third modifies", () => {
      const files = good(tree(["└── ❌ src/old.js"]), tree(["└── ✅ src/old.js"]));
      files["plan.md"] = files["plan.md"].replace(/(\| 2 .*\n)/, "$1| 3 | x | x | none |\n");
      files["phase-3.md"] = fill(template("phase-template.md"), tree(["└── ✏️ src/old.js"]));
      assert.deepEqual(run(files), OK);
    });
    it("refuses a file only a later phase creates, modified by an earlier one", () => {
      const r = run(good(tree(["└── ✏️ src/late.js"]), tree(["└── ✅ src/late.js"])));
      refused(r, /phase-1\.md:\d+ PLAN-05 src\/late\.js is marked modify but does not exist/);
    });
  });

  it("follows the template: a section added there becomes required", () => {
    const copy = path.join(root, "skill");
    fs.cpSync(SKILL, copy, { recursive: true });
    fs.appendFileSync(path.join(copy, "assets/plan-template.md"), "\n## Added\n\nx\n");
    refused(run(good(), copy), /plan\.md:\d+ PLAN-01 section "Added" missing/);
  });

});
