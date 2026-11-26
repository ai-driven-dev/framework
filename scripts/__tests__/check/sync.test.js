const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { ENGINE_FILES } = require("../../check/engine/sync.cjs");

const SYNC = path.resolve(__dirname, "../../check/engine/sync.cjs");

/** The vendored engine copies: sync writes them, --check reads only and names the stale ones. */

let root;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "contract-sync-"));
  for (const skill of ["a", "b"]) {
    fs.mkdirSync(path.join(root, "plugins", "p", "skills", skill, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(root, "plugins", "p", "skills", skill, "scripts", "contract.json"), "{}");
  }
  fs.mkdirSync(path.join(root, "plugins", "p", "skills", "none"), { recursive: true });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const sync = (...args) => spawnSync(process.execPath, [SYNC, ...args, "--root", root], { encoding: "utf8" });
const copy = (skill, name = "engine.cjs") => path.join(root, "plugins", "p", "skills", skill, "scripts", "lib", name);

describe("contract sync", () => {
  it("--check names every missing copy and writes nothing", () => {
    const run = sync("--check");
    assert.equal(run.status, 1);
    assert.equal(run.stdout.trim().split("\n").length, 2 * ENGINE_FILES.length);
    assert.equal(fs.existsSync(copy("a")), false);
  });

  it("copies the engine into each skill holding a contract and nowhere else", () => {
    assert.equal(sync().status, 0);
    for (const name of ENGINE_FILES) assert.ok(fs.readFileSync(copy("b", name)).equals(fs.readFileSync(path.resolve(__dirname, "../../check/engine", name))));
    assert.equal(fs.existsSync(path.join(root, "plugins", "p", "skills", "none", "scripts")), false);
    assert.equal(sync("--check").status, 0);
  });

  it("--check exits 1 and names the copy after an edit, and the sync repairs it", () => {
    sync();
    fs.appendFileSync(copy("a", "ops.cjs"), "// edited\n");
    const run = sync("--check");
    assert.equal(run.status, 1);
    assert.match(run.stdout, /skills\/a\/scripts\/lib\/ops\.cjs differs/u);
    assert.equal(sync().status, 0);
    assert.equal(sync("--check").status, 0);
  });

  describe("hook copies", () => {
    const plugin = () => path.join(root, "plugins", "p");
    const scope = () => {
      const contract = path.join(plugin(), "skills", "a", "scripts", "contract.json");
      fs.writeFileSync(contract, JSON.stringify({ scope: ["x/*.md"], rules: { R: { template: "../assets/t.md" } } }));
      fs.mkdirSync(path.join(plugin(), "skills", "a", "assets"), { recursive: true });
      fs.writeFileSync(path.join(plugin(), "skills", "a", "assets", "t.md"), "# t\n");
      wire("start", "mark", "check");
    };
    const wire = (...goals) => {
      fs.mkdirSync(path.join(plugin(), "hooks"), { recursive: true });
      fs.writeFileSync(path.join(plugin(), "hooks", "hooks.json"), JSON.stringify(goals.map((goal) => `node \${CLAUDE_PLUGIN_ROOT}/hooks/artifacts.cjs ${goal}`)));
    };

    it("a plugin with a scoped contract gets artifacts.cjs and the contract, engine and named template", () => {
      scope();
      sync();
      const hooks = path.join(plugin(), "hooks");
      assert.ok(fs.existsSync(path.join(hooks, "artifacts.cjs")));
      for (const file of ["a/scripts/contract.json", "a/assets/t.md", ...ENGINE_FILES.map((name) => `lib/${name}`)]) assert.ok(fs.existsSync(path.join(hooks, "lib", "contracts", file)), file);
      assert.equal(fs.existsSync(path.join(hooks, "lib", "contracts", "a", "scripts", "lib")), false);
      assert.ok(fs.readFileSync(path.join(hooks, "lib", "host.cjs")).equals(fs.readFileSync(path.resolve(__dirname, "../../../cli/assets/hooks-runtime/host-claude.cjs"))));
      assert.equal(sync("--check").status, 0);
    });

    it("names each goal the plugin's hooks.json does not call, and a Stop relayed by another hook script passes", () => {
      scope();
      wire("start");
      const run = sync();
      assert.equal(run.status, 1);
      assert.match(run.stdout, /plugins\/p\/hooks\/hooks\.json does not call artifacts\.cjs mark \(PostToolUse\)/u);
      assert.match(run.stdout, /does not call artifacts\.cjs check \(Stop\)/u);
      wire("start", "mark");
      fs.writeFileSync(path.join(plugin(), "hooks", "memory.cjs"), 'require("./artifacts.cjs");\n');
      assert.equal(sync("--check").status, 0);
    });

    it("a plugin whose contracts have no scope gets nothing", () => {
      sync();
      assert.equal(fs.existsSync(path.join(plugin(), "hooks")), false);
    });

    it("a plugin whose hook requires the host adapter gets it, and one that stops requiring it is named", () => {
      fs.mkdirSync(path.join(plugin(), "hooks"), { recursive: true });
      fs.writeFileSync(path.join(plugin(), "hooks", "h.cjs"), 'require("./lib/host.cjs");\n');
      sync();
      assert.equal(sync("--check").status, 0);
      fs.writeFileSync(path.join(plugin(), "hooks", "h.cjs"), "");
      assert.match(sync("--check").stdout, /hooks\/lib\/host\.cjs has no source/u);
      sync();
      assert.equal(fs.existsSync(path.join(plugin(), "hooks", "lib", "host.cjs")), false);
    });

    it("an orphan copy and a hook left without a scoped contract are named, then removed", () => {
      scope();
      sync();
      const orphan = path.join(plugin(), "hooks", "lib", "contracts", "gone", "x.md");
      fs.mkdirSync(path.dirname(orphan), { recursive: true });
      fs.writeFileSync(orphan, "");
      assert.match(sync("--check").stdout, /gone\/x\.md has no source/u);
      sync();
      assert.equal(fs.existsSync(path.dirname(orphan)), false);
      fs.writeFileSync(path.join(plugin(), "skills", "a", "scripts", "contract.json"), "{}");
      assert.match(sync("--check").stdout, /hooks\/artifacts\.cjs has no source/u);
      sync();
      assert.equal(fs.existsSync(path.join(plugin(), "hooks", "artifacts.cjs")), false);
      assert.equal(fs.existsSync(path.join(plugin(), "hooks", "lib", "contracts")), false);
    });
  });
});
