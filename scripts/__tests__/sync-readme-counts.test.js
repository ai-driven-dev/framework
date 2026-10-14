const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const SCRIPT = path.resolve(__dirname, "..", "sync-readme-counts.mjs");

test("the README counts check finds the README and agrees with the tree", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--check"], { encoding: "utf8" });

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
});
