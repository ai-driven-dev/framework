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
  write("validate.config.json", JSON.stringify({ contracts: [{ contract: AGENT_CONTRACT, targets: "agents/*.md" }] }));
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

  const baselined = (text) => {
    write("agents/b.md", text);
    run("--update-baseline");
  };

  it("lets baselined findings pass, and fails on one more", () => {
    baselined("no front matter\n");
    assert.equal(run().status, 0);
    write("agents/c.md", "no front matter\n");
    assert.equal(run().status, 1);
  });

  it("fails on a swap: one finding fixed, another added in the same file and rule", () => {
    baselined("---\nname: b\n---\n\n# Role\n");
    assert.equal(run().status, 0);
    write("agents/b.md", "---\nname: b\ndescription: changed\n---\n\n# Role\n");
    const swapped = run();
    assert.equal(swapped.status, 1);
  });

  it("fails on a stale entry and says how to update", () => {
    baselined("no front matter\n");
    fs.rmSync(path.join(root, "agents/b.md"));
    const stale = run();
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, /no longer fires, run node scripts\/contract\/run\.cjs --update-baseline/u);
    assert.equal(run("--update-baseline").status, 0);
    assert.equal(run().status, 0);
  });

  it("never lets --update-baseline absorb a new finding", () => {
    baselined("no front matter\n");
    const before = fs.readFileSync(path.join(root, "validate.config.json"), "utf8");
    write("agents/c.md", "no front matter\n");
    const update = run("--update-baseline");
    assert.equal(update.status, 1);
    assert.match(update.stdout, /^agents\/c\.md:/mu);
    assert.equal(fs.readFileSync(path.join(root, "validate.config.json"), "utf8"), before);
    assert.equal(run().status, 1);
  });

  it("lowers a count and drops a fixed entry on --update-baseline", () => {
    baselined("no front matter\n");
    const entries = () => Object.keys(JSON.parse(fs.readFileSync(path.join(root, "validate.config.json"), "utf8")).baseline).length;
    const before = entries();
    fs.rmSync(path.join(root, "agents/b.md"));
    assert.equal(run("--update-baseline").status, 0);
    assert.ok(entries() < before);
    assert.equal(run().status, 0);
  });

  it("ignores a line shift above a baselined finding", () => {
    baselined("no front matter\n");
    write("agents/b.md", "\n\nno front matter\n");
    assert.equal(run().status, 0);
  });

  it("exits 1 when a vendored engine copy is edited", () => {
    const skill = path.join(root, "plugins/aidd-context/skills/06-agent-generate/scripts");
    fs.rmSync(path.join(skill, "lib"), { recursive: true, force: true });
    write("plugins/aidd-context/skills/06-agent-generate/scripts/lib/engine.cjs", "// edited\n");
    assert.match(run().stdout, /lib\/engine\.cjs differs from scripts\/contract/u);
  });

  it("exits 2 when a mapping matches no file", () => {
    fs.rmSync(path.join(root, "agents"), { recursive: true });
    const out = run();
    assert.equal(out.status, 2);
    assert.match(out.stderr, /agents\/\*\.md: matches no file/u);
  });

  it("exits 2 when --root has no value", () => {
    assert.equal(spawnSync(process.execPath, [RUN, "--root"], { encoding: "utf8" }).status, 2);
    assert.equal(spawnSync(process.execPath, [path.join(REPO, "scripts/contract/sync.cjs"), "--root"], { encoding: "utf8" }).status, 2);
  });

  it("exits 2 on a missing config", () => {
    fs.rmSync(path.join(root, "validate.config.json"));
    assert.equal(run().status, 2);
  });
});
