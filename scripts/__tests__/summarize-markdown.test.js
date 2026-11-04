const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const SCRIPT = path.resolve(__dirname, "../summarize-markdown.js");

test("a CommonJS hook is listed in the catalog beside a plain script", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-"));
  try {
    fs.mkdirSync(path.join(root, "hooks"));
    for (const name of ["a.cjs", "b.js"]) fs.writeFileSync(path.join(root, "hooks", name), "");
    const out = path.join(root, "CATALOG.md");
    const result = spawnSync(process.execPath, [SCRIPT, root, out, "--depth=4"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const catalog = fs.readFileSync(out, "utf8");
    assert.match(catalog, /\[b\.js\]/u);
    assert.match(catalog, /\[a\.cjs\]/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
