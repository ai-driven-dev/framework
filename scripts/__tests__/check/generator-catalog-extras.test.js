const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const extras = require("../../check/generators/catalog-extras.cjs");
const { scratchRoot } = require("./helpers.js");

let root, at, write;
const markers = (name) => `<!--extras-${name}:start-->\n<!--extras-${name}:end-->\n`;
const catalog = () => fs.readFileSync(at("docs/CATALOG.md"), "utf8");

beforeEach(() => {
  ({ root, at, write } = scratchRoot("catalog-extras-"));
  write("plugins/aidd-x/agents/helper.md", "---\nname: helper\ndescription: Does a job. Use to help.\n---\n");
  write("plugins/aidd-x/hooks/hooks.json", JSON.stringify({ hooks: { Stop: [{ hooks: [{ command: "node ${CLAUDE_PLUGIN_ROOT}/hooks/a.cjs" }] }] } }));
  write("plugins/aidd-y/skills/a/SKILL.md", "---\nname: a\n---\n");
  write("docs/CATALOG.md", `# Catalog\n\n${markers("aidd-x")}`);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("catalog-extras generator", () => {
  it("reports a stale block and writes nothing", () => {
    assert.deepEqual(extras.run({ root, write: false }), ["docs/CATALOG.md"]);
    assert.equal(catalog(), `# Catalog\n\n${markers("aidd-x")}`);
  });

  it("writes the agents and hooks of a plugin, then finds them fresh", () => {
    assert.deepEqual(extras.run({ root, write: true }), ["docs/CATALOG.md"]);
    assert.match(catalog(), /\| `helper` \| Does a job \|/u);
    assert.match(catalog(), /\| `Stop` \| `hooks\/a\.cjs` \|/u);
    assert.deepEqual(extras.run({ root, write: false }), []);
  });

  it("reports a block edited by hand", () => {
    extras.run({ root, write: true });
    fs.writeFileSync(at("docs/CATALOG.md"), catalog().replace("`hooks/a.cjs`", "`hooks/gone.cjs`"));
    assert.deepEqual(extras.run({ root, write: false }), ["docs/CATALOG.md"]);
  });

  it("names a plugin with agents or hooks and no markers, and markers for a plugin with neither", () => {
    write("docs/CATALOG.md", "# Catalog\n");
    assert.equal(extras.run({ root, write: true })[0].problem.includes("aidd-x"), true);
    write("docs/CATALOG.md", `${markers("aidd-x")}${markers("aidd-y")}`);
    const [problem] = extras.run({ root, write: false }).filter((result) => result.problem);
    assert.match(problem.problem, /aidd-y/u);
  });

  it("does nothing without a plugins folder or a catalog", () => {
    fs.rmSync(at("docs"), { recursive: true });
    assert.deepEqual(extras.run({ root, write: true }), []);
  });
});
