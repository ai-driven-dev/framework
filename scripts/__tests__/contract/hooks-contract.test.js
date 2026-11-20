const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it, beforeEach, afterEach } = require("node:test");

const ROOT = path.resolve(__dirname, "../../..");
const SCRIPT = path.join(ROOT, "plugins/aidd-context/skills/08-hook-generate/scripts/validate-hooks.cjs");

const entry = (hook = {}) => ({
  hooks: { Stop: [{ hooks: [{ type: "command", command: "node ${CLAUDE_PLUGIN_ROOT}/hooks/guard.cjs", timeout: 5, ...hook }] }] },
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
  const run = spawnSync(process.execPath, [SCRIPT, file], { encoding: "utf8" });
  return { code: run.status, out: run.stdout };
}

describe("hooks contract", () => {
  it("accepts every real hooks.json of the repository", () => {
    for (const name of fs.readdirSync(path.join(ROOT, "plugins"))) {
      const file = path.join(ROOT, "plugins", name, "hooks/hooks.json");
      if (!fs.existsSync(file)) continue;
      const run = spawnSync(process.execPath, [SCRIPT, file], { encoding: "utf8" });
      assert.deepEqual({ name, code: run.status, out: run.stdout }, { name, code: 0, out: "" });
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

  it("does not ask a Stop handler to read stop_hook_active", () => {
    assert.deepEqual(validate(entry()), { code: 0, out: "" });
  });

  it("flags a file that is not JSON", () => {
    assert.match(validate("{").out, / HOOKS-01 invalid JSON/u);
  });
});
