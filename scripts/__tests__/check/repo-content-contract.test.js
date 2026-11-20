const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const engine = require("../../check/engine/engine.cjs");

const CONTRACT = path.resolve(__dirname, "../../check/contracts/repo.json");
const HOST = "module.exports = { host: true };\n";
const LIBRARY = "module.exports = { rules: true };\n";

/** The contract with only the content rules: the others read anchor files a scratch repository does not hold. */
function contentContract() {
  const contract = engine.loadContract(CONTRACT);
  for (const id of Object.keys(contract.rules)) if (!/^REPO-0[456]$/u.test(id)) delete contract.rules[id];
  return contract;
}

/** Inside a git hook GIT_DIR and GIT_INDEX_FILE point at this repository: a scratch repo must not inherit them. */
const CLEAN_ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

const PLUGIN = { name: "a", source: "./plugins/a", description: "d", strict: true, metadata: { recommended: true } };
const marketplace = (plugin) => JSON.stringify({ name: "m", version: "1", description: "d", owner: { name: "o" }, plugins: [plugin] });

/** A small tracked repository: REPO-04 to REPO-06 are silent on it. */
const CLEAN = {
  ".claude-plugin/marketplace.json": marketplace(PLUGIN),
  "notes.md": "Nothing from a machine here.\n",
  "data.json": '{"a":1}\n',
  "cli/assets/hooks-runtime/host-claude.cjs": HOST,
  "plugins/a/hooks/h.cjs": 'require("./lib/host.cjs");\nrequire("./lib/common-rules.cjs");\n',
  "plugins/a/hooks/lib/host.cjs": HOST,
  "plugins/a/hooks/lib/common-rules.cjs": LIBRARY,
};

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-content-"));
  put(CLEAN);
  cp.execFileSync("git", ["init", "-q"], { cwd: dir, env: CLEAN_ENV });
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function put(files) {
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
}

/** Ids found once the files are written and tracked. */
function ids(files = {}) {
  put(files);
  cp.execFileSync("git", ["add", "-A"], { cwd: dir, env: CLEAN_ENV });
  const inherited = Object.keys(process.env).filter((key) => key.startsWith("GIT_"));
  const saved = Object.fromEntries(inherited.map((key) => [key, process.env[key]]));
  for (const key of inherited) delete process.env[key];
  try {
    return [...new Set(engine.check(contentContract(), path.join(dir, ".claude-plugin/marketplace.json")).map((f) => f.id))];
  } finally {
    Object.assign(process.env, saved);
  }
}

describe("repo content rules", () => {
  it("accept a clean repository", () => {
    assert.deepEqual(ids(), []);
  });

  it("REPO-04 flags a tracked file holding a path from a machine", () => {
    assert.deepEqual(ids({ "notes.md": `see /${"Users"}/realperson/work\n` }), ["REPO-04"]);
  });

  it("REPO-04 lets a placeholder account through", () => {
    assert.deepEqual(ids({ "notes.md": `see /${"Users"}/alice/work\n` }), []);
  });

  it("REPO-05 flags a JSON file that does not parse", () => {
    assert.deepEqual(ids({ "data.json": "{" }), ["REPO-05"]);
  });

  it("REPO-05 leaves plugin manifests to PLUGIN-01, and flags a marketplace source that does not exist", () => {
    assert.deepEqual(ids({ "plugins/a/.claude-plugin/plugin.json": "{}" }), []);
    const marketplace = { name: "m", version: "1", description: "d", owner: { name: "o" }, plugins: [{ name: "a", source: "./nowhere", description: "d", strict: true, metadata: { recommended: true } }] };
    assert.deepEqual(ids({ ".claude-plugin/marketplace.json": JSON.stringify(marketplace), }), ["REPO-05"]);
  });

  it("REPO-05 skips fixture trees", () => {
    assert.deepEqual(ids({ "cli/tests/fixtures/broken.json": "{" }), []);
  });

  it("REPO-06 flags a host adapter that differs from the CLI's asset", () => {
    assert.deepEqual(ids({ "plugins/a/hooks/lib/host.cjs": "module.exports = {};\n" }), ["REPO-06"]);
  });

  it("REPO-06 flags a host adapter no hook requires, and one a hook requires but is missing", () => {
    assert.deepEqual(ids({ "plugins/a/hooks/h.cjs": 'require("./lib/common-rules.cjs");\n' }), ["REPO-06"]);
    fs.rmSync(path.join(dir, "plugins/a/hooks/lib/host.cjs"));
    assert.deepEqual(ids({ "plugins/a/hooks/h.cjs": 'require("./lib/host.cjs");\nrequire("./lib/common-rules.cjs");\n' }), ["REPO-06"]);
  });
});
