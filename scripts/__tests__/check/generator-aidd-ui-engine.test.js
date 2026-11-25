const assert = require("node:assert/strict");
const fs = require("node:fs");
const { describe, it, beforeEach, afterEach } = require("node:test");
const engine = require("../../check/generators/aidd-ui-engine.cjs");
const { scratchRoot } = require("./helpers.js");

let root, at, write;
const HOOKS = "plugins/aidd-ui/hooks";
const COPY = (skill) => `plugins/aidd-ui/skills/${skill}/scripts/aidd-ui`;

beforeEach(() => {
  ({ root, at, write } = scratchRoot("aidd-ui-engine-"));
  write(`${HOOKS}/aidd-ui.cjs`, 'require("./lib/a.cjs");\n');
  write(`${HOOKS}/lib/a.cjs`, "module.exports = 1;\n");
  write(`${HOOKS}/lib/contracts/lib/engine.cjs`, "// owned by sync.cjs\n");
  write(`${HOOKS}/hooks.json`, "{}\n");
  write("plugins/aidd-ui/skills/01-one/SKILL.md", "---\nname: one\n---\n");
  write("plugins/aidd-ui/skills/02-two/SKILL.md", "---\nname: two\n---\n");
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("aidd-ui engine generator", () => {
  it("names each missing copy and writes nothing", () => {
    assert.deepEqual(engine.run({ root, write: false }), [`${COPY("01-one")}/aidd-ui.cjs`, `${COPY("01-one")}/lib/a.cjs`, `${COPY("02-two")}/aidd-ui.cjs`, `${COPY("02-two")}/lib/a.cjs`]);
    assert.equal(fs.existsSync(at(COPY("01-one"))), false);
  });

  it("copies the engine byte for byte into every skill, then finds it fresh", () => {
    engine.run({ root, write: true });
    assert.equal(fs.readFileSync(at(`${COPY("02-two")}/lib/a.cjs`), "utf8"), "module.exports = 1;\n");
    assert.equal(fs.readFileSync(at(`${COPY("01-one")}/aidd-ui.cjs`), "utf8"), 'require("./lib/a.cjs");\n');
    assert.deepEqual(engine.run({ root, write: false }), []);
  });

  it("leaves out the hook manifest and the contract files sync.cjs owns", () => {
    engine.run({ root, write: true });
    assert.equal(fs.existsSync(at(`${COPY("01-one")}/hooks.json`)), false);
    assert.equal(fs.existsSync(at(`${COPY("01-one")}/lib/contracts`)), false);
  });

  it("names a copy edited by hand", () => {
    engine.run({ root, write: true });
    write(`${COPY("01-one")}/lib/a.cjs`, "module.exports = 2;\n");
    assert.deepEqual(engine.run({ root, write: false }), [`${COPY("01-one")}/lib/a.cjs`]);
  });

  it("names a copy whose source is gone, and deletes it on write", () => {
    engine.run({ root, write: true });
    write(`${COPY("02-two")}/lib/gone.cjs`, "module.exports = 0;\n");
    assert.deepEqual(engine.run({ root, write: false }), [`${COPY("02-two")}/lib/gone.cjs`]);
    engine.run({ root, write: true });
    assert.equal(fs.existsSync(at(`${COPY("02-two")}/lib/gone.cjs`)), false);
  });

  it("does nothing in a tree without aidd-ui", () => {
    fs.rmSync(at("plugins/aidd-ui"), { recursive: true });
    assert.deepEqual(engine.run({ root, write: true }), []);
  });
});
