const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { findings } = require("./helpers.js");

const CONTRACT = path.resolve(__dirname, "../../check/contracts/runner.json");

/** A scratch skill folder: RUNNER-01 is silent on it, a hardcoded runner wakes it. */
let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "runner-contract-"));
  fs.mkdirSync(path.join(dir, "references"));
  fs.writeFileSync(path.join(dir, "SKILL.md"), "# Skill\n\nRun `<runner> tool` here.\n");
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const write = (file, text) => fs.writeFileSync(path.join(dir, file), text);
const ids = () => [...new Set(findings(CONTRACT, dir).map((found) => found.id))];

describe("runner contract", () => {
  it("RUNNER-01 flags a hardcoded npx in the skill text", () => {
    assert.deepEqual(ids(), []);
    write("references/setup.md", "Install with `npx tool@latest`.\n");
    assert.deepEqual(ids(), ["RUNNER-01"]);
  });

  it("RUNNER-01 lets the one file that defines the runner name the alternatives", () => {
    write("references/recipe-contract.md", "`<runner>` is `npx`, `pnpm dlx` or `bunx`.\n");
    assert.deepEqual(ids(), []);
  });
});
