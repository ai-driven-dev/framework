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

for (const reference of [
  "00-onboard/references/state/detection.md",
  "02-project-memory/references/tools.md",
  "04-skill-generate/references/tool-detect.md",
  "05-rule-generate/references/hosts.md",
  "06-agent-generate/references/hosts.md",
  "07-command-generate/references/hosts.md",
  "08-hook-generate/references/hosts.md",
]) {
  test(`${reference} detects legacy Kilo without treating it as an output path`, () => {
    const table = fs.readFileSync(path.join(skills, reference), "utf8");
    const rows = table.split("\n").filter((line) => line.startsWith("|"));
    const kilo = rows.map((line) => line.split("|")).find(([, host]) => /^kilo(?:\s|$)/iu.test(host.trim()));
    const opencode = rows.map((line) => line.split("|")).find(([, host]) => /^opencode(?:\s|$)/iu.test(host.trim()));
    assert.ok(kilo, "the Kilo row is present");
    assert.match(kilo[2], /`\.kilocode\/`/u);
    assert.match(kilo[2], /`\.kilo\/`/u);
    assert.doesNotMatch(kilo[2], /`opencode\.jsonc?`/u);
    assert.doesNotMatch(kilo.slice(3).join(""), /\.kilocode\//u);
    assert.doesNotMatch(opencode?.[2] ?? "", /\.kilocode\//u);
  });
}
