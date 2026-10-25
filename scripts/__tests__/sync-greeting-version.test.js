const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const SCRIPT = path.resolve(__dirname, "..", "sync-greeting-version.mjs");

const TARGETS = [
  "AGENTS.md",
  "CLAUDE.md",
  "cli/CLAUDE.md",
  "plugins/aidd-context/skills/02-project-memory/assets/templates/AGENTS.md",
];

const GREETING = (v) =>
  `# AGENTS.md\n\n> On 1st message, greet user with: "AI-Driven Development On ⚡ · Framework v${v} · [Releases](https://github.com/ai-driven-dev/framework/releases)"\n`;

/** A throwaway framework checkout: a marketplace manifest and the four greeting targets. */
function makeCheckout(version, greetingVersion = "0.0.0") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sync-greeting-version-"));
  fs.mkdirSync(path.join(root, ".claude-plugin"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".claude-plugin/marketplace.json"),
    JSON.stringify({ name: "aidd-framework", version }),
  );
  for (const target of TARGETS) {
    const file = path.join(root, target);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, GREETING(greetingVersion));
  }
  return root;
}

function run(root, ...flags) {
  return spawnSync(process.execPath, [SCRIPT, "--root", root, ...flags], { encoding: "utf8" });
}

test("the greeting version check agrees with the release in the repository", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--check"], { encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
});

test("the script stamps the release version into every greeting target", () => {
  const root = makeCheckout("5.13.0");
  try {
    const result = run(root);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    for (const target of TARGETS) {
      const md = fs.readFileSync(path.join(root, target), "utf8");
      assert.match(md, /Framework v5\.13\.0/u);
      assert.doesNotMatch(md, /Framework v0\.0\.0/u);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the script is idempotent and --check passes once synced", () => {
  const root = makeCheckout("5.13.0");
  try {
    assert.equal(run(root).status, 0);
    const before = TARGETS.map((t) => fs.readFileSync(path.join(root, t), "utf8"));
    assert.equal(run(root).status, 0);
    const after = TARGETS.map((t) => fs.readFileSync(path.join(root, t), "utf8"));
    assert.deepEqual(after, before);
    assert.equal(run(root, "--check").status, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("--check fails on a stale greeting and the script fixes it", () => {
  const root = makeCheckout("5.13.0", "5.12.0");
  try {
    const stale = run(root, "--check");
    assert.equal(stale.status, 1, `${stale.stdout}${stale.stderr}`);
    assert.match(stale.stderr, /stale/u);
    assert.equal(run(root).status, 0);
    assert.match(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), /Framework v5\.13\.0/u);
    assert.equal(run(root, "--check").status, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a target without a stamped greeting fails loudly", () => {
  const root = makeCheckout("5.13.0");
  try {
    fs.writeFileSync(path.join(root, "AGENTS.md"), "# AGENTS.md\n\nno greeting here\n");
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no stamped greeting/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
