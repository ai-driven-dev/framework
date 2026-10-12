const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { create } = require("./common.cjs");

const args = process.argv.slice(2);
let repo;
let smoke = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--repo" && !repo) repo = args[++i] || assert.fail("Missing --repo value.");
  else if (args[i] === "--smoke" && !smoke) smoke = true;
  else assert.fail(`Unknown or duplicate argument: ${args[i]}`);
}
const sandbox = create(repo, smoke);
const results = [];
function run(name, argv, cwd) {
  const result = spawnSync(process.execPath, argv, { cwd, encoding: "utf8", timeout: 180000 });
  results.push({ name, args: [process.execPath, ...argv], cwd, exit: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message });
  fs.writeFileSync(path.join(sandbox.root, "reproduction-results.json"), JSON.stringify({ ...sandbox, smoke, results }, null, 2));
  assert.equal(result.status, 0, JSON.stringify(results.at(-1)));
}
console.log(JSON.stringify({ sandbox: sandbox.root, smoke }));
run("baseline API", ["--test", "tests/invoice.test.ts", "tests/http.test.ts"], path.join(sandbox.root, "baseline"));
for (const name of ["install", "lifecycle", ...(smoke ? [] : ["negative-pipeline"]), "cleanup-ownership"]) {
  run(name, [path.join(__dirname, `${name}.cjs`), sandbox.root, sandbox.repo], sandbox.root);
}
console.log(JSON.stringify({ sandbox: sandbox.root, checks: results.map(({ name, exit }) => ({ name, exit })), evidence: path.join(sandbox.root, "reproduction-results.json") }));
