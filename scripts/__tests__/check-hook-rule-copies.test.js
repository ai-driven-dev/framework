const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { differingCopies, run } = require("../check-hook-rule-copies.js");

const COPY = (plugin) => path.join("plugins", plugin, "hooks", "lib", "common-rules.cjs");

/** A throwaway tree holding one copy per plugin, removed after `body` runs. */
function inTree(copies, body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hook-rule-copies-"));
  try {
    for (const [plugin, text] of Object.entries(copies)) {
      const full = path.join(root, COPY(plugin));
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, text);
    }
    return body(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const quiet = () => {};

test("one copy passes", () => {
  inTree({ "aidd-context": "module.exports = {};\n" }, (root) => {
    assert.deepEqual(differingCopies(root).differing, []);
    assert.equal(run(root, quiet, quiet), 0);
  });
});

test("identical copies pass", () => {
  inTree({ "aidd-context": "same\n", "aidd-ui": "same\n" }, (root) => {
    assert.equal(run(root, quiet, quiet), 0);
  });
});

test("a copy differing by one byte fails and is named", () => {
  inTree({ "aidd-context": "same\n", "aidd-ui": "samf\n" }, (root) => {
    const logged = [];
    assert.equal(run(root, (line) => logged.push(line), quiet), 1);
    assert.deepEqual(differingCopies(root).differing, [COPY("aidd-ui").split(path.sep).join("/")]);
    assert.match(logged.join("\n"), /plugins\/aidd-ui\/hooks\/lib\/common-rules\.cjs/u);
  });
});

test("a plugin without the library is not a copy", () => {
  inTree({ "aidd-context": "same\n" }, (root) => {
    fs.mkdirSync(path.join(root, "plugins", "aidd-pm", "hooks"), { recursive: true });
    assert.equal(differingCopies(root).copies.length, 1);
  });
});

test("this repository's copies are identical", () => {
  assert.equal(run(path.resolve(__dirname, "../.."), quiet, quiet), 0);
});
