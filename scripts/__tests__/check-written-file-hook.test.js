const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const hook = path.join(root, ".claude/hooks/check-written-file.js");
const biome = path.join(root, "cli/node_modules/.bin", process.platform === "win32" ? "biome.cmd" : "biome");
const noBiome = !fs.existsSync(biome);

function runHook(payload) {
  return spawnSync(process.execPath, [hook], { input: payload, encoding: "utf8" });
}

function probe(name, content) {
  const file = path.join(root, "cli/src", `.hook-probe-${process.pid}-${name}.ts`);
  fs.writeFileSync(file, content);
  return file;
}

test("hands a broken Biome rule back to the agent, naming it", { skip: noBiome }, () => {
  const file = probe("broken", "export function one(x: number) {\n  return x == 1;\n}\n");
  try {
    const result = runHook(JSON.stringify({ tool_input: { file_path: file } }));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /noDoubleEquals/);
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test("formats a file in place and stays silent on what would not block a commit", { skip: noBiome }, () => {
  const file = probe("clean", "export function echo(value: any) {\n  return   value;\n}\n");
  try {
    const result = runHook(JSON.stringify({ tool_input: { file_path: file } }));
    assert.equal(result.status, 0);
    assert.equal(result.stdout + result.stderr, "");
    assert.equal(fs.readFileSync(file, "utf8"), "export function echo(value: any) {\n  return value;\n}\n");
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test("leaves a file outside cli/ alone", () => {
  const result = runHook(JSON.stringify({ tool_input: { file_path: path.join(root, "README.md") } }));
  assert.equal(result.status, 0);
  assert.equal(result.stdout + result.stderr, "");
});

test("answers an unreadable payload with silence, never a failure", () => {
  const result = runHook("not json");
  assert.equal(result.status, 0);
  assert.equal(result.stdout + result.stderr, "");
});
