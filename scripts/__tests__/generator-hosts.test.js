const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const skills = path.resolve(__dirname, "../../plugins/aidd-context/skills");

const idsListed = (skill) =>
  fs
    .readFileSync(path.join(skills, skill, "references/hosts.md"), "utf8")
    .split(/\r?\n/u)
    .flatMap((line) => (line.startsWith("|") ? [/\/ `([a-z]+)`/u.exec(line)?.[1]] : []))
    .filter(Boolean);

for (const [skill, writer] of [
  ["05-rule-generate", "write-rule.cjs"],
  ["06-agent-generate", "write-agent.cjs"],
  ["07-command-generate", "write-command.cjs"],
]) {
  test(`${skill} lists exactly the hosts its writer accepts`, () => {
    const { TOOLS } = require(path.join(skills, skill, "scripts", writer));
    assert.deepEqual(idsListed(skill).sort(), [...TOOLS].sort());
  });
}
