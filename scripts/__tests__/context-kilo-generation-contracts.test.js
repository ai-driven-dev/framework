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
  "plugins/aidd-context/skills/06-agent-generate/references/hosts.md",
  "plugins/aidd-context/skills/07-command-generate/references/hosts.md",
  "plugins/aidd-context/skills/05-rule-generate/references/hosts.md",
  "plugins/aidd-context/skills/08-hook-generate/references/hosts.md",
];
const kiloPathReferences = [
  "plugins/aidd-context/skills/02-project-memory/references/tools.md",
  "plugins/aidd-context/skills/04-skill-generate/references/tool-detect.md",
  "plugins/aidd-context/skills/04-skill-generate/references/tool-write.md",
  "plugins/aidd-context/skills/05-rule-generate/references/hosts.md",
  "plugins/aidd-context/skills/06-agent-generate/references/hosts.md",
  "plugins/aidd-context/skills/07-command-generate/references/hosts.md",
  "plugins/aidd-context/skills/08-hook-generate/references/hosts.md",
  "plugins/aidd-context/skills/08-hook-generate/actions/01-frame.md",
];

for (const file of contracts) {
  test(`${file}: names all Kilo detection signals and excludes shared false positives`, () => {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const signal of SIGNALS) assert.ok(text.includes(`\`${signal}\``), `missing ${signal}`);
    assert.ok(
      /Every (?:tool|host) reads `AGENTS\.md`, so it signals none\./u.test(text) ||
      /AGENTS\.md.{0,80}(?:alone|only).{0,40}(?:not|do not).{0,30}Kilo|(?:not|do not).{0,30}Kilo.{0,40}AGENTS\.md/isu.test(text),
      `${file}: AGENTS.md alone must not identify Kilo`,
    );
    assert.match(text, /opencode\.json.{0,35}(?:alone|not|does not)|(?:not|does not).{0,35}opencode\.json/isu);
  });
}

test("Kilo path claims include an official source and the issue verification date", () => {
  for (const file of kiloPathReferences) {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.match(text, /https:\/\/(?:kilo\.ai\/docs|github\.com\/Kilo-Org\/)/u, `${file}: missing official source`);
    assert.match(text, /verified 2026-09-25/u, `${file}: missing verification date`);
  }
});

test("Kilo generation contracts use native destinations and require consent for portable skills", () => {
  const skill = fs.readFileSync(path.join(ROOT, "plugins/aidd-context/skills/04-skill-generate/references/tool-write.md"), "utf8");
  const agent = fs.readFileSync(path.join(ROOT, "plugins/aidd-context/skills/06-agent-generate/references/hosts.md"), "utf8");
  const command = fs.readFileSync(path.join(ROOT, "plugins/aidd-context/skills/07-command-generate/references/hosts.md"), "utf8");
  assert.match(skill, /\.kilo\/skills\/<name>\//u);
  assert.match(skill, /\.agents\/skills\//u);
  assert.match(skill, /explicit user agreement.*\.agents\/skills/u);
  assert.match(skill, /never write the same skill to both Kilo's native root and the portable root/u);
  assert.match(agent, /\.kilo\/agents\/<name>\.md/u);
  const writer = fs.readFileSync(path.join(ROOT, "plugins/aidd-context/skills/06-agent-generate/scripts/write-agent.cjs"), "utf8");
  assert.match(writer, /subagent/u);
  assert.match(command, /\.kilo\/commands\/<name>\.md/u);
});

test("Kilo rules refuse path scopes and hook guidance avoids declarative output", () => {
  const rules = fs.readFileSync(path.join(ROOT, "plugins/aidd-context/skills/05-rule-generate/references/writer.md"), "utf8");
  const hooks = fs.readFileSync(path.join(ROOT, "plugins/aidd-context/skills/08-hook-generate/actions/01-frame.md"), "utf8");
  assert.match(rules, /paths|path-scoped/u);
  assert.match(rules, /--kilo-config/u);
  assert.match(hooks, /JavaScript or TypeScript plugins/u);
  assert.match(hooks, /do not generate a declarative hook or plugin runtime/u);
  assert.match(hooks, /session\.created/u);
});
