const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it, beforeEach, afterEach } = require("node:test");

const REPO = path.resolve(__dirname, "../../..");
const RUN = path.join(REPO, "scripts/contract/run.cjs");
const AGENT_CONTRACT = "plugins/aidd-context/skills/06-agent-generate/scripts/contract.json";

let root;
const run = (...args) => spawnSync(process.execPath, [RUN, "--root", root, ...args], { encoding: "utf8" });
const write = (rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "run-"));
  fs.cpSync(path.join(REPO, path.dirname(path.dirname(AGENT_CONTRACT))), path.join(root, path.dirname(path.dirname(AGENT_CONTRACT))), { recursive: true });
  write("validate.config.json", JSON.stringify({ contracts: [{ contract: AGENT_CONTRACT, targets: "agents/*.md" }], baseline: {} }));
  fs.mkdirSync(path.join(root, "agents"));
  fs.cpSync(path.join(REPO, "plugins/aidd-orchestrator/agents/executor.md"), path.join(root, "agents/executor.md"));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("repository run", () => {
  it("exits 0 on a clean tree and 1 on a new finding", () => {
    const first = run();
    assert.equal(first.status, 0, first.stdout);
    write("agents/b.md", "no front matter\n");
    const bad = run();
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /^agents\/b\.md:\d+ AGENT-/mu);
  });

  it("lets baselined findings pass, and fails when one more appears", () => {
    write("agents/b.md", "no front matter\n");
    assert.match(run("--update-baseline").stdout, /^baseline: \d+ findings/u);
    assert.equal(run().status, 0);
    const config = JSON.parse(fs.readFileSync(path.join(root, "validate.config.json"), "utf8"));
    const key = Object.keys(config.baseline)[0];
    config.baseline[key] -= 1;
    write("validate.config.json", JSON.stringify(config));
    assert.equal(run().status, 1);
  });

  it("exits 1 when a vendored engine copy is edited", () => {
    const skill = path.join(root, "plugins/aidd-context/skills/06-agent-generate/scripts");
    fs.rmSync(path.join(skill, "lib"), { recursive: true, force: true });
    write("plugins/aidd-context/skills/06-agent-generate/scripts/lib/engine.cjs", "// edited\n");
    assert.match(run().stdout, /lib\/engine\.cjs differs from scripts\/contract/u);
  });

  it("exits 2 on a missing config", () => {
    fs.rmSync(path.join(root, "validate.config.json"));
    assert.equal(run().status, 2);
  });
});
