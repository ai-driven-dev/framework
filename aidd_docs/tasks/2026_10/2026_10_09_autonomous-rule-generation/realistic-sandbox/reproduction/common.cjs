const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");

const owner = "aidd-realistic-rule-reproduction-v1";
const prefix = "aidd-realistic-rule-repro-";
const tools = ["claude", "cursor", "copilot", "codex", "opencode"];

function create(repoArgument, smoke) {
  assert.ok(Number(process.versions.node.split(".")[0]) >= 24, "Fixture requires Node 24 native TypeScript support.");
  const repo = fs.realpathSync(repoArgument || process.env.AIDD_REPO_ROOT || assert.fail("Pass --repo or AIDD_REPO_ROOT."));
  assert.ok(fs.existsSync(path.join(repo, "cli/dist/cli.js")), "Build the CLI before reproduction: pnpm --dir cli build.");
  const temp = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(temp, prefix));
  const hosts = smoke ? ["opencode"] : [...tools, "mixed"];
  fs.writeFileSync(path.join(root, ".sandbox-owner.json"), JSON.stringify({ owner, root, repo, hosts, tools }), { mode: 0o600 });
  fs.cpSync(path.resolve(__dirname, "../fixture"), path.join(root, "baseline"), { recursive: true });
  fs.mkdirSync(path.join(root, "projects"));
  for (const host of hosts) fs.cpSync(path.join(root, "baseline"), path.join(root, "projects", host), { recursive: true });
  return { root, repo, hosts, tools };
}

function open() {
  const root = path.resolve(process.argv[2] || assert.fail("Pass the owned temporary sandbox root."));
  assert.equal(fs.realpathSync(root), root, "Sandbox path must be physical.");
  assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()), "Refuse sandbox outside this process's temporary directory.");
  assert.ok(path.basename(root).startsWith(prefix), "Refuse an unrelated directory.");
  const marker = path.join(root, ".sandbox-owner.json");
  assert.ok(!fs.lstatSync(marker).isSymbolicLink(), "Refuse a symlink ownership marker.");
  const metadata = JSON.parse(fs.readFileSync(marker, "utf8"));
  assert.equal(metadata.owner, owner, "Refuse a directory not owned by this reproduction.");
  assert.equal(metadata.root, root, "Ownership marker must identify this exact root.");
  const repo = fs.realpathSync(process.argv[3] || process.env.AIDD_REPO_ROOT || metadata.repo);
  assert.equal(repo, metadata.repo, "Do not silently change the recorded source repository.");
  return { ...metadata, root, repo };
}

module.exports = { create, open };
