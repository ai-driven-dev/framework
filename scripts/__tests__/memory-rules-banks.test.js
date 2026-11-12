/**
 * A memory rule is required at the turn end only when it has no false hit on real banks. M3 is
 * required; M1 joins it only once its count on the real banks is zero, and a bank that holds a
 * sentence over the limit keeps it informing. This counts each rule's hits on the banks at hand: the two this repository holds, always, plus any
 * project root listed in `AIDD_MEMORY_BANKS` (separated by the platform's path delimiter), so a
 * bank outside the repository is measured on the machine that has it and skipped elsewhere.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const REPO = path.resolve(__dirname, "../..");
const { check } = require(path.join(REPO, "plugins/aidd-context/hooks/memory.cjs"));

const IN_REPO = [REPO, path.join(REPO, "cli")];
const EXTRA = (process.env.AIDD_MEMORY_BANKS ?? "").split(path.delimiter).filter(Boolean);

/** Each rule's hits on one project's bank, the always-written files left out: a level 1 finding
 * at a write by design, measured on its own at the skill's check. */
function hitsOn(root) {
  const { errors, warnings } = check(root);
  const counts = {};
  for (const { rule, file, line } of [...errors, ...warnings]) {
    if (rule === "missing") continue;
    (counts[rule] ??= []).push(`${file}:${line ?? ""}`);
  }
  return counts;
}

// The rules required at the turn end.
const REQUIRED = ["M3"];

for (const root of [...IN_REPO, ...EXTRA]) {
  test(`each rule required at the turn end has no hit on the bank of ${path.relative(REPO, root) || "this repository"}`, (t) => {
    assert.ok(fs.existsSync(path.join(root, "aidd_docs/memory")), `${root} holds no bank`);
    const hits = hitsOn(root);
    t.diagnostic(JSON.stringify(Object.fromEntries(Object.entries(hits).map(([rule, found]) => [rule, found.length]))));
    for (const rule of REQUIRED) assert.deepEqual(hits[rule] ?? [], [], `${rule} hits a real bank, so it can only inform`);
  });
}

test("the count sees a planted hit of every required rule", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-banks-"));
  try {
    const bank = path.join(root, "aidd_docs/memory");
    fs.mkdirSync(path.join(bank, "kpi"), { recursive: true });
    const sentence = "the quick brown fox jumps over the lazy dog every single morning again";
    const template = fs.readFileSync(path.join(REPO, "plugins/aidd-context/skills/02-project-memory/assets/templates/memory/vcs.md"), "utf8");
    fs.writeFileSync(path.join(bank, "vcs.md"), `# A\n\n- ${template.match(/\{\{[^{}\n]*\}\}/u)[0]}\n`);
    fs.writeFileSync(path.join(bank, "a.md"), `# A\n\n- ${sentence}\n\nSee \`aidd_docs/gone.md\`.\n`);
    fs.writeFileSync(path.join(bank, "b.md"), `# B\n\n- ${sentence}\n`);
    fs.writeFileSync(path.join(bank, "kpi/x.md"), "# K\n");
    const hits = hitsOn(root);
    for (const rule of REQUIRED) assert.ok((hits[rule] ?? []).length > 0, `${rule} planted and not counted`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
