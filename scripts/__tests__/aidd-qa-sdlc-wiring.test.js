const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("static permissions: the checker may invoke both QA skills", () => {
  const permissions = read("plugins/aidd-dev/agents/checker.md").split("# Skills you may invoke")[1];
  const skills = [...permissions.matchAll(/`(\/[^`]+)`/g)].map((match) => match[1]);
  for (const skill of ["/aidd-qa:01-acceptance-qa", "/aidd-qa:02-demo"]) assert.ok(skills.includes(skill), skill);
});

test("static flow: SDLC routes the QA verdicts through the canonical skills", () => {
  const diagram = read("plugins/aidd-orchestrator/skills/01-sdlc/references/03-check.md").split("```mermaid")[1];
  const nodes = Object.fromEntries([...diagram.matchAll(/(\w+)\["([/$][^"\n]+)"\]/g)]
    .map((match) => [match[1], match[2]]));
  const edges = [...diagram.matchAll(/^\s*(\w+)\s+(?:--\s+("[^"]+"|[^\n]+?)\s+)?-->\s+(\w+)\s*$/gm)]
    .map((match) => [nodes[match[1]] || match[1], (match[2] || "").replace(/^"|"$/g, ""), nodes[match[3]] || match[3]]);
  const qa = "/aidd-qa:01-acceptance-qa";
  const demo = "/aidd-qa:02-demo";
  const challenge = "/aidd-refine:02-challenge";
  for (const edge of [
    ["/aidd-dev:05-review", "approve", qa],
    [qa, "pass", "$qa.md"],
    ["$qa.md", null, demo],
    [demo, "", challenge],
    [qa, "skipped", challenge],
    [qa, "fail", "Deliver"],
    [qa, "blocked: criteria", "Frame"],
    [qa, "blocked: execution", "Stop"],
  ]) assert.ok(edges.some((actual) => actual.every((value, i) => edge[i] === null || value === edge[i])), edge.join(" -> "));
});

test("static installation: aidd-qa is recommended", () => {
  const plugins = JSON.parse(read(".claude-plugin/marketplace.json")).plugins;
  assert.equal(plugins.find((plugin) => plugin.name === "aidd-qa").metadata.recommended, true);
});
