const assert = require("node:assert/strict");
const fs = require("node:fs");
const { describe, it, beforeEach, afterEach } = require("node:test");
const catalogs = require("../../check/generators/catalogs.cjs");
const { scratchRoot } = require("./helpers.js");

let root, at, write;

beforeEach(() => {
  ({ root, at, write } = scratchRoot("catalogs-"));
  write("plugins/aidd-x/agents/helper.md", "---\nname: helper\ndescription: Does a job\n---\n");
  write("plugins/aidd-y/skills/a/SKILL.md", "---\nname: a\ndescription: Skill a\n---\n");
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("catalogs generator", () => {
  it("reports every missing catalog and writes nothing", () => {
    assert.deepEqual(catalogs.run({ root, write: false }), ["plugins/aidd-x/CATALOG.md", "plugins/aidd-y/CATALOG.md"]);
    assert.equal(fs.existsSync(at("plugins/aidd-x/CATALOG.md")), false);
    assert.deepEqual(fs.readdirSync(at("plugins/aidd-x")), ["agents"]);
  });

  it("writes the catalog of each plugin, then finds it fresh", () => {
    assert.equal(catalogs.run({ root, write: true }).length, 2);
    const text = fs.readFileSync(at("plugins/aidd-x/CATALOG.md"), "utf8");
    assert.match(text, /^# aidd-x catalog\n/u);
    assert.match(text, /\[helper\.md\]\(agents\/helper\.md\) \| `Does a job` \|/u);
    assert.deepEqual(catalogs.run({ root, write: false }), []);
  });

  it("reports a catalog edited by hand, and a new file the catalog lacks", () => {
    catalogs.run({ root, write: true });
    fs.appendFileSync(at("plugins/aidd-x/CATALOG.md"), "hand\n");
    assert.deepEqual(catalogs.run({ root, write: false }), ["plugins/aidd-x/CATALOG.md"]);
    catalogs.run({ root, write: true });
    write("plugins/aidd-y/skills/b/SKILL.md", "---\nname: b\n---\n");
    assert.deepEqual(catalogs.run({ root, write: false }), ["plugins/aidd-y/CATALOG.md"]);
  });

  it("does nothing without a plugins folder", () => {
    fs.rmSync(at("plugins"), { recursive: true });
    assert.deepEqual(catalogs.run({ root, write: true }), []);
  });
});
