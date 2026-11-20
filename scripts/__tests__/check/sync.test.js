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
});
