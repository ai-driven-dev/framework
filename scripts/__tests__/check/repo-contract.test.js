const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const engine = require("../../check/engine/engine.cjs");
const { findings } = require("./helpers.js");

const ROOT = path.resolve(__dirname, "../../..");
const CONTRACT = path.join(ROOT, "scripts/check/contracts/repo.json");
const PIECES = ["plugins", "docs", "README.md", ".claude-plugin", "release-please-config.json", ".github/workflows/ci.yml"];

/** The anchor-file rules only: REPO-04 to REPO-08 and REPO-10 read git's tracked files, which a copy has none of. */
function anchorFindings(target) {
  const contract = engine.loadContract(CONTRACT);
  for (const id of Object.keys(contract.rules)) if (/^REPO-(0[45678]|10)$/u.test(id)) delete contract.rules[id];
  return engine.check(contract, target);
}

/** A copy of the repository's anchor files, mutated per test. */
let copy;
beforeEach(() => {
  copy = fs.mkdtempSync(path.join(os.tmpdir(), "repo-contract-"));
  for (const piece of PIECES) {
    fs.mkdirSync(path.dirname(path.join(copy, piece)), { recursive: true });
    fs.cpSync(path.join(ROOT, piece), path.join(copy, piece), { recursive: true });
  }
});
afterEach(() => fs.rmSync(copy, { recursive: true, force: true }));

/** Ids found after one replacement in one file of the copy. */
function ids(file, from, to) {
  const target = path.join(copy, file);
  const text = fs.readFileSync(target, "utf8");
  assert.ok(text.includes(from), `${file} no longer holds ${from}`);
  fs.writeFileSync(target, text.replace(from, to));
  return [...new Set(anchorFindings(path.join(copy, ".claude-plugin/marketplace.json")).map((f) => f.id))];
}

describe("repo contract", () => {
  it("flags a plugin missing from the build matrix", () => {
    assert.deepEqual(ids(".github/workflows/ci.yml", "            aidd-qa,\n", ""), ["REPO-02"]);
  });

  it("flags a plugin release-please does not version", () => {
    assert.deepEqual(ids("release-please-config.json", '"plugins/aidd-ui"', '"plugins/aidd-uix"'), ["REPO-02"]);
  });

  it("flags an animation or a document naming a skill that does not exist", () => {
    assert.deepEqual(ids("docs/assets/sdlc-demo/scenes.json", "/aidd-dev:03-assert", "/aidd-dev:03-asserts"), ["REPO-03"]);
    assert.deepEqual(ids("README.md", "/aidd-dev:01-plan", "/aidd-dev:01-planx"), ["REPO-03"]);
  });
});
