const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it, before, after } = require("node:test");

const SKILL = path.resolve(__dirname, "../../plugins/aidd-dev/skills/01-plan");

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

const good = (tree) => ({
  "plan.md": fill(template("plan-template.md")),
  "phase-1.md": fill(template("phase-template.md"), tree),
  "phase-2.md": fill(template("phase-template.md")),
});

function run(files, skill = SKILL) {
  const dir = write(files);
  const r = spawnSync(process.execPath, [path.join(skill, "scripts/validate-plan.cjs"), dir], { cwd: project, encoding: "utf8" });
  return { out: r.stdout.trim(), code: r.status };
}

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
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

describe("validate-plan", () => {
  it("accepts a plan filled from the templates", () => {
    const r = run(good());
    assert.equal(r.code, 0);
    assert.match(r.out, /^VALID$/);
  });

  it("accepts the same plan saved with Windows line endings", () => {
    const files = Object.fromEntries(Object.entries(good()).map(([name, text]) => [name, text.replace(/\n/g, "\r\n")]));
    assert.match(run(files).out, /^VALID$/);
  });

  it("asks for the files when the folder holds no plan", () => {
    assert.match(run({}).out, /^INVALID\n.*plan\.md: missing/);
  });

  it("accepts dependencies on earlier phases and none", () => {
    for (const deps of ["none", "`none`", "1"]) {
      const r = run(mutate("plan.md", (s) => s.replace(/\| 2\s+\|(.*)\| 1 \|/, `| 2 |$1| ${deps} |`)));
      assert.equal(r.code, 0, deps);
    }
  });

  it("rejects a dependency that is not an earlier phase number", () => {
    for (const deps of ["2", "3", "x", "", "1, 2"]) {
      const r = run(mutate("plan.md", (s) => s.replace(/\| 2\s+\|(.*)\| 1 \|/, `| 2 |$1| ${deps} |`)));
      assert.match(r.out, /phase 2 "Depends on" must be/, JSON.stringify(deps));
    }
  });

  it("rejects a wireframe without numbered regions", () => {
    for (const body of ["none", "N/A", "(1) x"]) {
      const r = run(mutate("phase-1.md", (s) => s.replace(/(## Wireframe\n\n)[\s\S]*?(?=## Tasks)/, `$1\`\`\`txt\n${body}\n\`\`\`\n\n`)));
      assert.match(r.out, /phase-1\.md: section "Wireframe" needs a frame/, body);
    }
  });

  it("accepts a phase that omits the wireframe", () => {
    const r = run(mutate("phase-1.md", (s) => s.replace(/## Wireframe\n\n[\s\S]*?(?=## Tasks)/, "")));
    assert.equal(r.code, 0);
  });

  const cases = [
    ["a comment left", "plan.md", (s) => `${s}\n<!-- x -->`, /comment left/],
    ["a placeholder left", "plan.md", (s) => s.replace("Source: x", "Source: {{file}}"), /placeholder/],
    ["a required section missing", "phase-1.md", (s) => s.replace(/## Test Scope[\s\S]*?(?=## Wireframe)/, ""), /section "Test Scope" missing/],
    ["an unknown section", "plan.md", (s) => `${s}\n## Extra\n`, /section "Extra" is not in the template/],
    ["sections out of order", "plan.md", (s) => s.replace("## Rules", "## Zzz").replace("## Impact", "## Rules").replace("## Zzz", "## Impact"), /out of order/],
    ["a table header renamed", "plan.md", (s) => s.replace("| Rule ", "| Law  "), /table header differs/],
    ["a front matter key missing", "plan.md", (s) => s.replace(/objective:.*\n/, ""), /front matter key "objective" missing/],
    ["a front matter value changed", "phase-1.md", (s) => s.replace("status: pending", "status: done"), /"status" must be "pending"/],
    ["an empty objective", "plan.md", (s) => s.replace(/objective:.*\n/, 'objective: ""\n'), /"objective" empty/],
    ["a source without a URL", "plan.md", (s) => s.replace("https://example.test", "somewhere"), /without a URL/],
    ["a gap in the task numbers", "phase-1.md", (s) => s.replace("### `1)`", "### `2)`"), /task numbers must run 1 to 1 with no gap/],
    ["a criterion mapping no task", "phase-1.md", (s) => s.replace(/^\| 1 \| x/m, "| 9 | x"), /acceptance row 9 maps to no task/],
    ["a listed phase missing", "plan.md", (s) => s.replace(/(\| 2 .*\n)/, "$1| 3 | x | x |\n"), /phase-3\.md: listed in plan\.md, file missing/],
  ];
  for (const [name, file, edit, expected] of cases) {
    it(`refuses ${name}`, () => {
      const r = run(mutate(file, edit));
      assert.equal(r.code, 1);
      assert.match(r.out, expected);
    });
  }

  it("accepts an omitted optional section and a placeholder inside code", () => {
    const files = mutate("plan.md", (s) => s.replace(/## Rules[\s\S]*?(?=## Decisions)/, "").replace("Source: x", "Source: `{{kept}}`"));
    assert.match(run(files).out, /^VALID$/);
  });

  it("refuses a phase file the plan does not list", () => {
    assert.match(run({ ...good(), "phase-3.md": good()["phase-1.md"] }).out, /phase-3\.md: not listed/);
  });

  describe("files to modify and delete", () => {
    const tree = (lines) => lines.join("\n");
    it("resolves a nested tree against the project", () => {
      assert.match(run(good(tree(["└── src/", "    └── ✏️ a.js"]))).out, /^VALID$/);
    });
    it("refuses a file to modify that does not exist", () => {
      assert.match(run(good(tree(["└── src/", "    └── ✏️ ghost.js"]))).out, /src\/ghost\.js is marked modify/);
    });
    it("refuses a file to delete that does not exist", () => {
      assert.match(run(good(tree(["└── ❌ src/ghost.js"]))).out, /marked delete but does not exist/);
    });
    it("skips names that are not plain paths: globs, braces, notes", () => {
      assert.match(run(good(tree(["├── ✏️ src/**/*.ts", "├── ✏️ src/{a,b}.js", "└── ✏️ (several files)"]))).out, /^VALID$/);
    });
    it("accepts a file to create that is absent", () => {
      assert.match(run(good(tree(["└── ✅ src/new.js"]))).out, /^VALID$/);
    });
  });

  it("refuses a folder inside the skill itself", () => {
    const copy = path.join(root, "skill-inside");
    fs.cpSync(SKILL, copy, { recursive: true });
    const inside = path.join(copy, "runs/x");
    fs.mkdirSync(inside, { recursive: true });
    for (const [name, content] of Object.entries(good())) fs.writeFileSync(path.join(inside, name), content);
    const r = spawnSync(process.execPath, [path.join(copy, "scripts/validate-plan.cjs"), inside], { cwd: project, encoding: "utf8" });
    assert.match(r.stdout, /folder is inside the skill itself/);
  });

  it("follows the template: a section added there becomes required", () => {
    const copy = path.join(root, "skill");
    fs.cpSync(SKILL, copy, { recursive: true });
    fs.appendFileSync(path.join(copy, "assets/plan-template.md"), "\n## Added\n\nx\n");
    assert.match(run(good(), copy).out, /plan\.md: section "Added" missing/);
  });
});
