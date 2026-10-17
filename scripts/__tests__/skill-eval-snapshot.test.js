const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const { treeSnapshot } = require("../skill-eval-snapshot.mjs");

test("skill-eval snapshots nested file bytes and directory entries", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-eval-snapshot-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "nested"));
  fs.writeFileSync(path.join(root, "nested", "fixture.txt"), "controlled bytes");
  fs.writeFileSync(path.join(root, "z-last.txt"), "last");
  fs.writeFileSync(path.join(root, "a-first.txt"), "first");
  fs.writeFileSync(path.join(root, ".skill-eval-last-message.txt"), "ignored output");

  const snapshot = treeSnapshot(root);
  assert.equal(snapshot.get("nested/fixture.txt").split(":").at(-1), Buffer.from("controlled bytes").toString("base64"));
  assert.match(snapshot.get("nested/"), /^directory:/);
  assert.deepEqual([...snapshot.keys()], ["a-first.txt", "nested/", "nested/fixture.txt", "z-last.txt"]);
  assert.equal(snapshot.has(".skill-eval-last-message.txt"), false);
});

test("skill-eval refuses a file replaced between inspection and reading", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-eval-snapshot-race-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, "fixture.txt");
  fs.writeFileSync(target, "controlled bytes");
  const fixture = path.join(__dirname, "fixtures/skill-eval-snapshot-race.mjs");
  const result = spawnSync(process.execPath, [fixture], {
    encoding: "utf8",
    env: { ...process.env, AIDD_SNAPSHOT_ROOT: root, AIDD_SNAPSHOT_TARGET: target },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /snapshot refused a substituted file/u);
});

test("skill-eval records a symlink without reading its target", { skip: process.platform === "win32" }, (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-eval-snapshot-link-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "skill-eval-outside-"));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  fs.writeFileSync(path.join(outside, "secret.txt"), "outside bytes");
  fs.symlinkSync(outside, path.join(root, "link"), "dir");

  const snapshot = treeSnapshot(root);
  assert.equal(snapshot.get("link"), "other:true");
  assert.equal(snapshot.has("link/secret.txt"), false);
});
