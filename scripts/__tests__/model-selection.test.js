const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

for (const model of [undefined, "user-selected-model"]) {
  test(`skill eval ${model ? "honors an explicit model" : "does not override the host model"}`, (t) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "model-selection-"));
    t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
    const argsFile = path.join(tmp, "args.json");
    const stub = path.join(tmp, "claude.cjs");
    fs.writeFileSync(stub, [
      'const fs = require("node:fs");',
      'fs.writeFileSync(process.env.MODEL_SELECTION_ARGS, JSON.stringify(process.argv.slice(2)));',
      'fs.writeFileSync("Makefile-shadow-report.md", "stub report");',
    ].join("\n"));
    const preload = path.join(tmp, "preload.cjs");
    fs.writeFileSync(preload, [
      'const childProcess = require("node:child_process");',
      'const spawn = childProcess.spawn;',
      `childProcess.spawn = (command, args, options) => command === "claude"`,
      `  ? spawn(process.execPath, [${JSON.stringify(stub)}, ...args], options)`,
      '  : spawn(command, args, options);',
      'require("node:module").syncBuiltinESMExports();',
    ].join("\n"));
    const result = spawnSync(process.execPath, [
      "--require", preload,
      path.join(ROOT, "scripts/skill-eval.mjs"),
      "--case=filename rule keeps a dotless name",
      ...(model ? [`--model=${model}`] : []),
    ], {
      encoding: "utf8",
      env: { ...process.env, MODEL_SELECTION_ARGS: argsFile },
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const args = JSON.parse(fs.readFileSync(argsFile, "utf8"));
    const at = args.indexOf("--model");
    if (model) {
      assert.notEqual(at, -1);
      assert.equal(args[at + 1], model);
    } else {
      assert.equal(at, -1);
    }
  });
}
