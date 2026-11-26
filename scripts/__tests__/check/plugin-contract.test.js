const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { findings } = require("./helpers.js");

const CONTRACT = path.resolve(__dirname, "../../check/contracts/plugin.json");
const MANIFEST = {
  name: "aidd-demo",
  version: "1.0.0",
  description: "Demo plugin",
  author: { name: "Someone" },
  repository: "https://example.test/r",
  homepage: "https://example.test",
  license: "MIT",
  skills: ["./skills/01-hello"],
};

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-contract-"));
  fs.mkdirSync(path.join(dir, "plugins/aidd-demo/skills/01-hello"), { recursive: true });
  fs.writeFileSync(path.join(dir, "plugins/aidd-demo/skills/01-hello/SKILL.md"), "---\nname: 01-hello\n---\n");
  write("marketplace", { plugins: [{ name: "aidd-demo", description: MANIFEST.description }] });
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function write(kind, data) {
  const file = kind === "marketplace" ? path.join(dir, ".claude-plugin/marketplace.json") : path.join(dir, "plugins/aidd-demo/.claude-plugin/plugin.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
const found = (manifest) => {
  write("plugin", manifest);
  return findings(CONTRACT, path.join(dir, "plugins/aidd-demo/.claude-plugin/plugin.json")).map((f) => f.id);
};

describe("plugin contract", () => {
  it("accepts a manifest with no skills field: the host reads ./skills itself", () => {
    const { skills, ...bare } = MANIFEST;
    assert.deepEqual(found(bare), []);
  });

  it("PLUGIN-01 flags a manifest missing a field, a blank one, a wrong version", () => {
    for (const key of ["author", "repository", "homepage", "license"]) {
      const { [key]: dropped, ...rest } = MANIFEST;
      assert.deepEqual(found(rest), ["PLUGIN-01"], key);
    }
    assert.deepEqual(found({ ...MANIFEST, license: " " }), ["PLUGIN-01"]);
    assert.deepEqual(found({ ...MANIFEST, version: "1" }), ["PLUGIN-01"]);
  });

  it("PLUGIN-03 flags a manifest that breaks the official schema, once per field", () => {
    assert.deepEqual(found({ ...MANIFEST, homepage: "not a uri" }), ["PLUGIN-03"]);
    assert.deepEqual(found({ ...MANIFEST, keywords: "demo" }), ["PLUGIN-03"]);
    assert.deepEqual(found({ ...MANIFEST, author: "Someone" }), ["PLUGIN-03"]);
  });

  it("PLUGIN-02 flags a declared skills list that differs from the folders", () => {
    assert.deepEqual(found({ ...MANIFEST, skills: [] }), ["PLUGIN-02"]);
    assert.deepEqual(found({ ...MANIFEST, skills: ["./skills/01-hello", "./skills/02-gone"] }), ["PLUGIN-02"]);
  });

  it("PLUGIN-02 flags an agent path that does not exist, and a description apart from the marketplace", () => {
    assert.deepEqual(found({ ...MANIFEST, agents: ["./agents/none.md"] }), ["PLUGIN-02"]);
    assert.deepEqual(found({ ...MANIFEST, description: "Another" }), ["PLUGIN-02"]);
  });
});
