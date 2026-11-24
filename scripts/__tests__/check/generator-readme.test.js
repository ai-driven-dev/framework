const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const readme = require("../../check/generators/readme.cjs");
const { scratchRoot } = require("./helpers.js");

const EMPTY = "# R\n\n<!--counts:start-->old<!--counts:end-->\n\n<!--plugins:start-->\n<!--plugins:end-->\n";

let root, at, write;
const text = () => fs.readFileSync(at("README.md"), "utf8");

beforeEach(() => {
  ({ root, at, write } = scratchRoot("readme-"));
  write("README.md", EMPTY);
  write("plugins/aidd-x/skills/01-a/SKILL.md", "---\nname: 01-a\n---\n");
  write("plugins/aidd-x/skills/no-skill-file/notes.md", "x\n");
  write("plugins/aidd-x/agents/helper.md", "---\nname: helper\n---\n");
  write("plugins/aidd-x/hooks/hooks.json", JSON.stringify({ hooks: { Stop: [] } }));
  write("docs/assets/plugins/plugins.json", JSON.stringify({ "aidd-x": { status: "beta", emoji: "🧪", description: "Does one thing" } }));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("readme generator", () => {
  it("reports a stale README and writes nothing", () => {
    assert.deepEqual(readme.run({ root, write: false }), ["README.md"]);
    assert.equal(text(), EMPTY);
  });

  it("writes the hero and the grid, then finds them fresh", () => {
    assert.deepEqual(readme.run({ root, write: true }), ["README.md"]);
    assert.match(text(), /<!--counts:start--><kbd>1 plugins<\/kbd> · <kbd>1 skills<\/kbd> · <kbd>1 agents<\/kbd><!--counts:end-->/u);
    assert.match(text(), /<a href="plugins\/aidd-x\/README\.md">\n<img align="right" alt="beta"/u);
    assert.match(text(), /<h3>🧪 aidd-x<\/h3>/u);
    assert.match(text(), /1 skill · 1 agent · 1 hook<br \/>\nDoes one thing/u);
    assert.deepEqual(readme.run({ root, write: false }), []);
  });

  it("reports a count edited by hand", () => {
    readme.run({ root, write: true });
    write("README.md", text().replace("1 agents", "7 agents"));
    assert.deepEqual(readme.run({ root, write: false }), ["README.md"]);
  });

  it("reports a plugin with no entry in plugins.json as a finding, not a throw", () => {
    write("plugins/aidd-y/skills/.keep", "");
    const [result] = readme.run({ root, write: false });
    assert.match(result.problem, /No entry: aidd-y/u);
  });

  it("throws when the counts marker is missing", () => {
    write("README.md", text().replace("<!--counts:start-->", ""));
    assert.throws(() => readme.run({ root, write: false }), /counts:start/u);
  });

  it("does nothing without a README", () => {
    fs.rmSync(at("README.md"));
    assert.deepEqual(readme.run({ root, write: true }), []);
  });

  it("refuses a README without the grid markers", () => {
    write("README.md", "# R\n<!--counts:start-->x<!--counts:end-->\n");
    assert.throws(() => readme.run({ root, write: false }), /markers <!--plugins:start-->/u);
  });
});
