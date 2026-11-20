const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { main } = require("../../check/run.cjs");
const catalogs = require("../../check/generators/catalogs.cjs");
const { describe, it, beforeEach, afterEach } = require("node:test");

const REPO = path.resolve(__dirname, "../../..");
const RUN = path.join(REPO, "scripts/check/run.cjs");
const BASELINE = "scripts/check/baseline.json";
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
  const contractFile = path.join(root, AGENT_CONTRACT);
  fs.writeFileSync(contractFile, fs.readFileSync(contractFile, "utf8").replace("plugins/*/agents/*.md", "agents/*.md"));
  fs.mkdirSync(path.join(root, "agents"));
  fs.cpSync(path.join(REPO, "plugins/aidd-orchestrator/agents/executor.md"), path.join(root, "agents/executor.md"));
  catalogs.run({ root, write: true });
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

  it("lets a baselined finding be reworded, since its key is the file and the rule", () => {
    baselined("no front matter\n");
    write("agents/b.md", "another first line, still no front matter\n");
    assert.equal(run().status, 0);
    assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(root, BASELINE), "utf8"))).every((key) => /^\S+ [A-Z]+-\d{2}$/u.test(key)), true);
  });

  it("fails on a stale entry and says how to update", () => {
    baselined("no front matter\n");
    fs.rmSync(path.join(root, "agents/b.md"));
    const stale = run();
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, /no longer fires, run node scripts\/check\/run\.cjs --update-baseline/u);
    assert.equal(run("--update-baseline").status, 0);
    assert.equal(run().status, 0);
  });

  it("never lets --update-baseline absorb a new finding", () => {
    baselined("no front matter\n");
    const before = fs.readFileSync(path.join(root, BASELINE), "utf8");
    write("agents/c.md", "no front matter\n");
    const update = run("--update-baseline");
    assert.equal(update.status, 1);
    assert.match(update.stdout, /^agents\/c\.md:/mu);
    assert.equal(fs.readFileSync(path.join(root, BASELINE), "utf8"), before);
    assert.equal(run().status, 1);
  });

  it("lowers a count and drops a fixed entry on --update-baseline", () => {
    baselined("no front matter\n");
    const entries = () => Object.keys(JSON.parse(fs.readFileSync(path.join(root, BASELINE), "utf8"))).length;
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
    assert.match(run().stdout, /lib\/engine\.cjs differs from scripts\/check\/engine/u);
  });

  it("exits 2 when a mapping matches no file", () => {
    fs.rmSync(path.join(root, "agents"), { recursive: true });
    const out = run();
    assert.equal(out.status, 2);
    assert.match(out.stderr, /agents\/\*\.md: matches no file/u);
  });

  it("exits 2 when --root has no value", () => {
    assert.equal(spawnSync(process.execPath, [RUN, "--root"], { encoding: "utf8" }).status, 2);
    assert.equal(spawnSync(process.execPath, [path.join(REPO, "scripts/check/engine/sync.cjs"), "--root"], { encoding: "utf8" }).status, 2);
  });

  it("skips a contract that names no targets", () => {
    const contractFile = path.join(root, AGENT_CONTRACT);
    fs.writeFileSync(contractFile, fs.readFileSync(contractFile, "utf8").replace(/ *"targets": .*\n/u, ""));
    write("agents/b.md", "no front matter\n");
    assert.equal(run().status, 0);
  });

  it("checks only the artifacts of the given files", () => {
    assert.equal(run("agents/executor.md").status, 0);
    write("agents/b.md", "no front matter\n");
    assert.equal(run("agents/executor.md", "README.md").status, 0);
    const bad = run(path.join(root, "agents/b.md"));
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /^agents\/b\.md:/mu);
  });

  it("does not report a baselined finding as stale when its file is not given", () => {
    baselined("no front matter\n");
    fs.copyFileSync(path.join(root, "agents/executor.md"), path.join(root, "agents/b.md"));
    assert.equal(run("agents/executor.md").status, 0);
    assert.match(run("agents/b.md").stdout, /no longer fires/u);
    assert.equal(run().status, 1);
  });

  it("checks engine copies only when an engine file is given", () => {
    const skill = "plugins/aidd-context/skills/06-agent-generate/scripts/lib/engine.cjs";
    write(skill, "// edited\n");
    assert.equal(run("agents/executor.md").status, 0);
    assert.equal(run(skill).status, 1);
  });

  it("exits 2 on --update-baseline with files", () => {
    assert.equal(run("--update-baseline", "agents/executor.md").status, 2);
  });

  describe("generators", () => {
    const generator = { name: "fake", watch: ["docs/**"], run: ({ root: at, write: on }) => {
      const file = path.join(at, "generated.txt");
      if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === "fresh\n") return [];
      if (on) fs.writeFileSync(file, "fresh\n");
      return ["generated.txt"];
    } };
    const call = (...args) => {
      let text = "";
      const status = main(["--root", root, ...args], { generators: [generator], out: (t) => (text += t) });
      return { status, text };
    };

    it("reports a stale file without --fix, and writes it with --fix", () => {
      const stale = call();
      assert.equal(stale.status, 1);
      assert.match(stale.text, /generated\.txt is stale, run node scripts\/check\/run\.cjs --fix/u);
      assert.equal(fs.existsSync(path.join(root, "generated.txt")), false);
      const fixed = call("--fix");
      assert.equal(fixed.status, 0);
      assert.equal(fixed.text, "");
      assert.equal(fs.readFileSync(path.join(root, "generated.txt"), "utf8"), "fresh\n");
      assert.equal(call().status, 0);
    });

    it("runs on a scoped run only when a given file matches its watch", () => {
      assert.equal(call("agents/executor.md").status, 0);
      assert.equal(call("docs/a/b.md").status, 1);
    });
  });
});
