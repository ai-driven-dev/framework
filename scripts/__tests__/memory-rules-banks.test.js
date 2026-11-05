/**
 * A memory rule requires a fix (level 2) only when it has no false hit on real banks. This
 * counts each rule's hits on the banks at hand: the two this repository holds, always, plus any
 * project root listed in `AIDD_MEMORY_BANKS` (separated by the platform's path delimiter), so a
 * bank outside the repository is measured on the machine that has it and skipped elsewhere.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const REPO = path.resolve(__dirname, "../..");
const { LEVELS, check } = require(path.join(REPO, "plugins/aidd-context/hooks/memory.cjs"));

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

const LEVEL_TWO = Object.keys(LEVELS).filter((rule) => LEVELS[rule] === 2);
// A file outside the bank's root, internal/ and external/ is told by its path alone, so every
// hit is a true one: counted in the diagnostic, never held to zero.
const STRUCTURAL = new Set(["placement"]);

for (const root of [...IN_REPO, ...EXTRA]) {
  test(`each level 2 rule has no hit on the bank of ${path.relative(REPO, root) || "this repository"}`, (t) => {
    assert.ok(fs.existsSync(path.join(root, "aidd_docs/memory")), `${root} holds no bank`);
    const hits = hitsOn(root);
    t.diagnostic(JSON.stringify(Object.fromEntries(Object.entries(hits).map(([rule, found]) => [rule, found.length]))));
    for (const rule of LEVEL_TWO.filter((candidate) => !STRUCTURAL.has(candidate))) {
      assert.deepEqual(hits[rule] ?? [], [], `${rule} hits a real bank, so it can only inform`);
    }
  });
}

test("the count sees a planted hit of every level 2 rule", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-banks-"));
  try {
    const bank = path.join(root, "aidd_docs/memory");
    fs.mkdirSync(path.join(bank, "kpi"), { recursive: true });
    const sentence = "the quick brown fox jumps over the lazy dog every single morning again";
    fs.writeFileSync(path.join(bank, "a.md"), `# A\n\n- ${sentence}\n\nTBD\n\nSee \`aidd_docs/gone.md\`.\n`);
    fs.writeFileSync(path.join(bank, "b.md"), `# B\n\n- ${sentence}\n`);
    fs.writeFileSync(path.join(bank, "kpi/x.md"), "# K\n");
    const hits = hitsOn(root);
    for (const rule of LEVEL_TWO) assert.ok((hits[rule] ?? []).length > 0, `${rule} planted and not counted`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
