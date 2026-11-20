const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const helpers = require("./helpers.js");
const { describe, it, beforeEach, afterEach } = require("node:test");

const ROOT = path.resolve(__dirname, "../../..");
const CONTRACT = path.join(ROOT, "scripts/check/contracts/hooks.json");
const lint = (file) => {
  const { status, out } = helpers.lint(CONTRACT, file);
  return { code: status, out };
};

const entry = (hook = {}) => ({
  hooks: { Stop: [{ hooks: [{ type: "command", command: "node ${CLAUDE_PLUGIN_ROOT}/hooks/guard.cjs", timeout: 5, statusMessage: "AIDD Demo: guard", ...hook }] }] },
});

let plugin;
beforeEach(() => {
  plugin = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-contract-"));
  fs.mkdirSync(path.join(plugin, "hooks"));
  fs.writeFileSync(path.join(plugin, "hooks/guard.cjs"), '"use strict";\n');
});
afterEach(() => fs.rmSync(plugin, { recursive: true, force: true }));

function validate(config) {
  const file = path.join(plugin, "hooks/hooks.json");
  fs.writeFileSync(file, typeof config === "string" ? config : JSON.stringify(config, null, 2));
  return lint(file);
}

describe("hooks contract", () => {
  it("accepts every real hooks.json of the repository", () => {
    for (const name of fs.readdirSync(path.join(ROOT, "plugins"))) {
      const file = path.join(ROOT, "plugins", name, "hooks/hooks.json");
      if (!fs.existsSync(file)) continue;
      assert.deepEqual({ name, ...lint(file) }, { name, code: 0, out: "" });
    }
  });

  it("accepts a handler marked async", () => {
    assert.deepEqual(validate(entry({ async: true })), { code: 0, out: "" });
  });

  it("flags a key the host would ignore", () => {
    const { code, out } = validate(entry({ asynchronous: true }));
    assert.equal(code, 1);
    assert.match(out, / HOOKS-01 .*asynchronous/u);
  });

  it("flags a handler that does not exist", () => {
    assert.match(validate(entry({ command: "node ${CLAUDE_PLUGIN_ROOT}/hooks/missing.cjs" })).out, / HOOKS-02 hooks\/missing\.cjs does not exist/u);
  });

  it("flags a handler with a syntax error", () => {
    fs.writeFileSync(path.join(plugin, "hooks/guard.cjs"), "const = ;\n");
    assert.match(validate(entry()).out, / HOOKS-02 hooks\/guard\.cjs does not parse/u);
  });

  it("flags a handler with no status message, an empty one, or one not naming its plugin", () => {
    const { statusMessage, ...bare } = entry().hooks.Stop[0].hooks[0];
    assert.match(validate({ hooks: { Stop: [{ hooks: [bare] }] } }).out, / HOOKS-03 .*misses statusMessage/u);
    for (const message of ["  ", "", "guard", "AIDD Demo:"]) assert.match(validate(entry({ statusMessage: message })).out, / HOOKS-03 /u, message);
  });

  it("flags a file that is not JSON", () => {
    assert.match(validate("{").out, / HOOKS-01 invalid JSON/u);
  });
});
