const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { readOrNull } = require("../../check/read-or-null.cjs");

describe("readOrNull", () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "read-or-null-"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("returns the content of a file that exists", () => {
    fs.writeFileSync(path.join(dir, "a"), "x");
    assert.equal(readOrNull(path.join(dir, "a"), "utf8"), "x");
  });

  it("returns null for a file that does not exist", () => {
    assert.equal(readOrNull(path.join(dir, "missing"), "utf8"), null);
  });

  it("throws any other read error", () => {
    assert.throws(() => readOrNull(dir, "utf8"), { code: "EISDIR" });
  });
});
