const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const SIGNALS = [".kilo/", "kilo.json", "kilo.jsonc", ".kilo/kilo.json", ".kilo/kilo.jsonc", ".kilocode/"];
const contracts = [
  "plugins/aidd-context/skills/00-onboard/references/state/detection.md",
  "plugins/aidd-context/skills/02-project-memory/references/tools.md",
  "plugins/aidd-context/skills/04-skill-generate/references/tool-detect.md",
  "plugins/aidd-context/skills/06-agent-generate/references/tool-paths.md",
  "plugins/aidd-context/skills/07-command-generate/references/tool-paths.md",
  "plugins/aidd-context/skills/05-rule-generate/actions/01-capture-rule.md",
  "plugins/aidd-context/skills/08-hook-generate/actions/01-capture-hook.md",
];

for (const file of contracts) {
  test(`${file}: names all Kilo detection signals and excludes shared false positives`, () => {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const signal of SIGNALS) assert.ok(text.includes(`\`${signal}\``), `missing ${signal}`);
    assert.ok(
      text.includes("Every tool reads `AGENTS.md`, so it signals none.") ||
      /AGENTS\.md.{0,80}(?:alone|only).{0,40}(?:not|do not).{0,30}Kilo|(?:not|do not).{0,30}Kilo.{0,40}AGENTS\.md/isu.test(text),
      `${file}: AGENTS.md alone must not identify Kilo`,
    );
    assert.match(text, /opencode\.json.{0,35}(?:alone|not|does not)|(?:not|does not).{0,35}opencode\.json/isu);
  });
}

test("Kilo generation contracts use native destinations and require consent for portable skills", () => {
  const skill = fs.readFileSync(path.join(ROOT, "plugins/aidd-context/skills/04-skill-generate/references/tool-write.md"), "utf8");
  const agent = fs.readFileSync(path.join(ROOT, "plugins/aidd-context/skills/06-agent-generate/references/tool-paths.md"), "utf8");
  const command = fs.readFileSync(path.join(ROOT, "plugins/aidd-context/skills/07-command-generate/references/tool-paths.md"), "utf8");
  assert.match(skill, /\.kilo\/skills\/<name>\//u);
  assert.match(skill, /\.agents\/skills\//u);
  assert.match(skill, /explicit user agreement.*\.agents\/skills/u);
  assert.match(skill, /never write the same skill to both locations/u);
  assert.match(agent, /\.kilo\/agents\/<name>\.md/u);
  assert.match(agent, /mode: subagent/u);
  assert.match(agent, /Agents are supported on every listed tool\./u);
  assert.ok(agent.includes("~/.config/kilo/agents/"));
  assert.match(agent, /KILO_CONFIG_DIR/u);
  assert.match(agent, /AIDD's generator writes project-level agents only/u);
  assert.match(command, /\.kilo\/commands\/<name>\.md/u);
});

test("Kilo rules refuse path scopes and hook guidance avoids declarative output", () => {
  const rules = fs.readFileSync(path.join(ROOT, "plugins/aidd-context/skills/05-rule-generate/references/rule-publication.md"), "utf8");
  const hooks = fs.readFileSync(path.join(ROOT, "plugins/aidd-context/skills/08-hook-generate/references/tool-paths.md"), "utf8");
  assert.match(rules, /Kilo does not support enforceable path-scoped rules/u);
  assert.match(rules, /--kilo-config/u);
  assert.match(hooks, /JavaScript or TypeScript plugins/u);
  assert.match(hooks, /does not generate a declarative hook or plugin runtime/u);
  assert.match(hooks, /session\.created/u);
});
