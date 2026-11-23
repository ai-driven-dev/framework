const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, readdirSync, readFileSync, existsSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { test } = require("node:test");

const plugins = resolve(__dirname, "../../plugins");

/** What is wrong with each skill of a plugins tree: its frontmatter must name its folder and describe it. */
function skillFindings(root) {
  const findings = [];
  for (const plugin of readdirSync(root)) {
    const skills = join(root, plugin, "skills");
    if (!existsSync(skills)) continue;
    for (const skill of readdirSync(skills)) {
      const file = join(skills, skill, "SKILL.md");
      if (!existsSync(file)) continue;
      const frontmatter = readFileSync(file, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
      const name = frontmatter.match(/^name:[ \t]*["']?([^"'\r\n]+)/m)?.[1].trim();
      if (name !== skill) findings.push(`${plugin}/${skill}: name ${name}`);
      if (!/^description:[ \t]*\S/m.test(frontmatter)) findings.push(`${plugin}/${skill}: no description`);
    }
  }
  return findings;
}

function plantedSkill(content) {
  const root = mkdtempSync(join(tmpdir(), "aidd-skill-frontmatter-"));
  const folder = join(root, "aidd-x", "skills", "01-a");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "SKILL.md"), content);
  return root;
}

function findingsOf(content) {
  const root = plantedSkill(content);
  try {
    return skillFindings(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("every skill is named after its folder, as the hosts that validate skills require", () => {
  assert.deepEqual(skillFindings(plugins), []);
});

test("a planted skill that conforms is accepted", () => {
  assert.deepEqual(findingsOf("---\nname: 01-a\ndescription: does a\n---\n# A\n"), []);
});

test("a planted skill that breaks the frontmatter rule is reported", async (t) => {
  const offenders = {
    "no frontmatter at all": "# A\n",
    "no name": "---\ndescription: does a\n---\n",
    "a name apart from its folder": "---\nname: 01-b\ndescription: does a\n---\n",
    "a name only in the body": "---\ndescription: does a\n---\nname: 01-a\n",
    "no description": "---\nname: 01-a\n---\n",
    "a description only in the body": "---\nname: 01-a\n---\ndescription: does a\n",
  };
  for (const [title, content] of Object.entries(offenders)) {
    await t.test(title, () => assert.notDeepEqual(findingsOf(content), []));
  }
});
