const assert = require("node:assert/strict");
const { readdirSync, readFileSync, existsSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { test } = require("node:test");

const plugins = resolve(__dirname, "../../plugins");

test("every skill is named after its folder, as the hosts that validate skills require", () => {
  const mismatched = [];
  for (const plugin of readdirSync(plugins)) {
    const skills = join(plugins, plugin, "skills");
    if (!existsSync(skills)) continue;
    for (const skill of readdirSync(skills)) {
      const file = join(skills, skill, "SKILL.md");
      if (!existsSync(file)) continue;
      const frontmatter = readFileSync(file, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
      const name = frontmatter.match(/^name:[ \t]*["']?([^"'\r\n]+)/m)?.[1].trim();
      if (name !== skill) mismatched.push(`${plugin}/${skill}: ${name}`);
    }
  }
  assert.deepEqual(mismatched, []);
});
