const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const adapters = require("../../check/generators/host-adapters.cjs");
const { isTemplate, partNamesIn, templateOf } = require("../../../cli/scripts/host-adapter-parts.mjs");
const { scratchRoot } = require("./helpers.js");

const REPO = path.resolve(__dirname, "../../..");
const RUNTIME = "cli/assets/hooks-runtime";
const PARTS = `${RUNTIME}/parts`;

let root, at, write;

beforeEach(() => {
  ({ root, at, write } = scratchRoot("host-adapters-"));
  write(`${PARTS}/print.js.txt`, "function print(output) {\n  return output;\n}\n");
  write(`${PARTS}/host-one.js.txt`, '"use strict";\nconst HOST = "one";\n\n// @part print\n\nmodule.exports = { print };\n');
  write(`${PARTS}/host-two.js.txt`, '"use strict";\n// @part print\n');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("host adapters generator", () => {
  it("names each adapter its parts generate and writes nothing", () => {
    assert.deepEqual(adapters.run({ root, write: false }), [`${RUNTIME}/host-one.cjs`, `${RUNTIME}/host-two.cjs`]);
    assert.equal(fs.existsSync(at(`${RUNTIME}/host-one.cjs`)), false);
  });

  it("writes a host's template with each part line replaced by that part, then finds it fresh", () => {
    adapters.run({ root, write: true });
    assert.equal(fs.readFileSync(at(`${RUNTIME}/host-one.cjs`), "utf8"), '"use strict";\nconst HOST = "one";\n\nfunction print(output) {\n  return output;\n}\n\nmodule.exports = { print };\n');
    assert.equal(fs.readFileSync(at(`${RUNTIME}/host-two.cjs`), "utf8"), '"use strict";\nfunction print(output) {\n  return output;\n}\n');
    assert.deepEqual(adapters.run({ root, write: false }), []);
  });

  it("names an adapter edited by hand", () => {
    adapters.run({ root, write: true });
    write(`${RUNTIME}/host-two.cjs`, '"use strict";\n');
    assert.deepEqual(adapters.run({ root, write: false }), [`${RUNTIME}/host-two.cjs`]);
  });

  it("names an adapter whose shared part changed", () => {
    adapters.run({ root, write: true });
    write(`${PARTS}/print.js.txt`, "function print(output) {\n  return undefined;\n}\n");
    assert.deepEqual(adapters.run({ root, write: false }), [`${RUNTIME}/host-one.cjs`, `${RUNTIME}/host-two.cjs`]);
  });

  it("refuses a part no file holds, and writes nothing", () => {
    write(`${PARTS}/host-two.js.txt`, "// @part gone\n");
    assert.deepEqual(adapters.run({ root, write: true }), [`${RUNTIME}/host-one.cjs`, { problem: `${PARTS}/host-two.js.txt names part gone, which ${PARTS}/gone.js.txt does not hold` }]);
    assert.equal(fs.existsSync(at(`${RUNTIME}/host-two.cjs`)), false);
  });

  it("does nothing in a tree without the parts", () => {
    fs.rmSync(at(PARTS), { recursive: true });
    assert.deepEqual(adapters.run({ root, write: true }), []);
  });

  it("finds every committed adapter to be what its parts generate", () => {
    const templates = partNamesIn(path.join(REPO, RUNTIME)).filter(isTemplate);
    const committed = fs.readdirSync(path.join(REPO, RUNTIME)).map(templateOf).filter((name) => name !== undefined).sort();
    assert.ok(templates.length > 0, "no template found: the scope is stale");
    assert.deepEqual(committed, templates, "an adapter with no template is never generated");
    assert.deepEqual(adapters.run({ root: REPO, write: false }), []);
  });
});
