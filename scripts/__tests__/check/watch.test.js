const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it, beforeEach, afterEach } = require("node:test");

const CHECK = path.resolve(__dirname, "../../check");
const RUN = path.join(CHECK, "run.cjs");

/** A repository clean for the DOC contract, but for a broken link in docs/GUIDES.md. */
const FILES = {
  "README.md": "# Repo\n\nSee [guides](docs/GUIDES.md).\n",
  "docs/GUIDES.md": "# Guides\n\n[x](nowhere.md)\n",
  "plugins/aidd-context/hooks/memory.cjs": 'const TARGET_FILES = [{ path: "CLAUDE.md", syntax: "at" }];\n',
  "src/a.js": "module.exports = 1;\n",
};

let root;
const run = (...args) => spawnSync(process.execPath, [RUN, "--root", root, ...args], { encoding: "utf8" });

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "watch-"));
  fs.mkdirSync(path.join(root, "scripts/check/contracts"), { recursive: true });
  fs.copyFileSync(path.join(CHECK, "contracts/doc.json"), path.join(root, "scripts/check/contracts/doc.json"));
  fs.cpSync(path.join(CHECK, "contracts/custom"), path.join(root, "scripts/check/contracts/custom"), { recursive: true });
  for (const [file, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("contract watch", () => {
  it("runs a repo-wide contract when a given file is one it reads", () => {
    const out = run("docs/GUIDES.md");
    assert.equal(out.status, 1, out.stdout + out.stderr);
    assert.match(out.stdout, /DOC-01 docs\/GUIDES\.md:3: nowhere\.md/u);
  });

  it("does not run it for a file it does not read", () => {
    const out = run("src/a.js");
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.equal(out.stdout, "");
  });

  it("is refused when it is not a list of globs", () => {
    const file = path.join(root, "scripts/check/contracts/doc.json");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/"watch": \[.*\]/u, '"watch": "**"'));
    const out = run("docs/GUIDES.md");
    assert.equal(out.status, 2);
    assert.match(out.stderr, /watch must be an array/u);
  });
});
