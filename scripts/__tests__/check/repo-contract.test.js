const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { findings } = require("./helpers.js");

const CONTRACT = path.resolve(__dirname, "../../check/contracts/plugin.json");
const MARKET = { plugins: [{ name: "aidd-demo", description: "Demo." }] };
const MANIFEST = { name: "aidd-demo", version: "1.0.0", description: "Demo.", skills: ["./skills/01-a"] };

let root;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "repo-contract-"));
  fs.mkdirSync(path.join(root, ".claude-plugin"));
  fs.writeFileSync(path.join(root, ".claude-plugin/marketplace.json"), JSON.stringify(MARKET));
  fs.mkdirSync(path.join(root, "plugins/aidd-demo/.claude-plugin"), { recursive: true });
  fs.mkdirSync(path.join(root, "plugins/aidd-demo/skills/01-a"), { recursive: true });
  fs.writeFileSync(path.join(root, "plugins/aidd-demo/skills/01-a/SKILL.md"), "x\n");
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function ids(manifest) {
  const file = path.join(root, "plugins/aidd-demo/.claude-plugin/plugin.json");
  fs.writeFileSync(file, typeof manifest === "string" ? manifest : JSON.stringify(manifest, null, 2));
  return findings(CONTRACT, file).map((f) => `${f.id} ${f.message}`);
}

describe("plugin contract", () => {
  it("accepts a coherent manifest, whatever the description length", () => {
    assert.deepEqual(ids(MANIFEST), []);
    const long = "x".repeat(300);
    MARKET.plugins[0].description = long;
    fs.writeFileSync(path.join(root, ".claude-plugin/marketplace.json"), JSON.stringify(MARKET));
    MARKET.plugins[0].description = "Demo.";
    assert.deepEqual(ids({ ...MANIFEST, description: long }), []);
  });

  it("flags a skill folder missing from the manifest", () => {
    fs.mkdirSync(path.join(root, "plugins/aidd-demo/skills/02-b"));
    fs.writeFileSync(path.join(root, "plugins/aidd-demo/skills/02-b/SKILL.md"), "x\n");
    assert.deepEqual(ids(MANIFEST), ["PLUGIN-02 ./skills/02-b is not listed in skills"]);
  });

  it("flags a listed skill that does not exist", () => {
    assert.deepEqual(ids({ ...MANIFEST, skills: ["./skills/01-a", "./skills/09-z"] }), ["PLUGIN-02 ./skills/09-z is listed but has no SKILL.md"]);
  });

  it("flags a description that differs from the marketplace", () => {
    assert.deepEqual(ids({ ...MANIFEST, description: "Other." }), ["PLUGIN-02 description differs from marketplace.json"]);
  });

  it("flags a raw skeleton, then accepts the filled manifest", () => {
    assert.ok(ids({ name: "{{name}}", version: "0.0.0", description: "", skills: [] }).some((m) => m.startsWith("PLUGIN-01")));
    assert.deepEqual(ids(MANIFEST), []);
  });

  it("flags a blank description", () => {
    assert.ok(ids({ ...MANIFEST, description: "   " }).some((m) => m.startsWith("PLUGIN-01")));
  });
});
