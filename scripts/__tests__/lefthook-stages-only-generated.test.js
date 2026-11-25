const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");
const yaml = require("js-yaml");

const root = path.resolve(__dirname, "../..");
const hook = yaml.load(fs.readFileSync(path.join(root, "lefthook.yml"), "utf8"))["pre-commit"].commands["framework-content"].run;

// Run from a git hook, an inherited GIT_DIR or GIT_INDEX_FILE would point this repo's git at the real one.
const CLEAN_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));

// The hook restages what --fix regenerated; a hand edit left unstaged must stay unstaged.
test("framework-content stages the files --fix rewrote, not an unstaged hand edit", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-hook-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sh = (cmd) => execFileSync("sh", ["-c", cmd], { cwd: dir, encoding: "utf8", env: CLEAN_ENV });
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  write("scripts/check/run.cjs", "require('node:fs').appendFileSync('docs/CATALOG.md', 'regenerated\\n');\n");
  write("README.md", "readme\n");
  write("docs/CATALOG.md", "catalog\n");
  write("plugins/p/CATALOG.md", "plugin catalog\n");
  write("plugins/p/skills/s/SKILL.md", "skill\n");
  sh("git init -q && git add -A && git -c user.name=t -c user.email=t@t commit -qm init");
  write("README.md", "readme\nhand edit\n");
  write("plugins/p/skills/s/SKILL.md", "skill\nchanged\n");
  sh("git add plugins");

  sh(hook.replace("{staged_files}", "plugins/p/skills/s/SKILL.md"));

  assert.equal(sh("git diff --name-only --cached").split("\n").sort().join(" ").trim(), "docs/CATALOG.md plugins/p/skills/s/SKILL.md");
  assert.equal(sh("git diff --name-only").trim(), "README.md");
});

// The aidd-ui engine copies are generated too: a new, changed or deleted copy follows its source into the commit.
test("framework-content stages the aidd-ui engine copies --fix wrote, removed or created", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-hook-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sh = (cmd) => execFileSync("sh", ["-c", cmd], { cwd: dir, encoding: "utf8", env: CLEAN_ENV });
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  const copy = "plugins/aidd-ui/skills/s/scripts/aidd-ui";
  write("scripts/check/run.cjs", `const fs = require('node:fs'); fs.writeFileSync('${copy}/lib/a.cjs', 'changed\\n'); fs.writeFileSync('${copy}/lib/new.cjs', 'new\\n'); fs.rmSync('${copy}/lib/gone.cjs');\n`);
  write("README.md", "readme\n");
  write("docs/CATALOG.md", "catalog\n");
  write(`${copy}/lib/a.cjs`, "a\n");
  write(`${copy}/lib/gone.cjs`, "gone\n");
  write("plugins/aidd-ui/hooks/lib/a.cjs", "a\n");
  sh("git init -q && git add -A && git -c user.name=t -c user.email=t@t commit -qm init");
  write("plugins/aidd-ui/hooks/lib/a.cjs", "changed\n");
  sh("git add plugins/aidd-ui/hooks");

  sh(hook.replace("{staged_files}", "plugins/aidd-ui/hooks/lib/a.cjs"));

  assert.equal(sh("git diff --name-only --cached").split("\n").sort().join(" ").trim(), `plugins/aidd-ui/hooks/lib/a.cjs ${copy}/lib/a.cjs ${copy}/lib/gone.cjs ${copy}/lib/new.cjs`);
  assert.equal(sh("git status --porcelain").split("\n").filter((line) => !/^[MADR] /u.test(line) && line).join("|"), "");
});
