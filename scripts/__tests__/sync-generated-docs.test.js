const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const SCRIPT = path.resolve(__dirname, "..", "sync-generated-docs.mjs");
const REPOSITORY = path.resolve(__dirname, "..", "..");

const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

/** A tree with one plugin that declares one hook, one tool, and both documents emptied. */
function scratchTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-sync-docs-"));
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
  write(
    "plugins/aidd-x/hooks/hooks.json",
    JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ command: "node ${CLAUDE_PLUGIN_ROOT}/hooks/a.js" }] }] } })
  );
  write(
    "cli/tests/golden/snapshots/tool-support/surface.json",
    JSON.stringify([
      {
        id: "claude",
        name: "Claude Code",
        directory: ".claude/",
        pluginMode: "native",
        nativeCli: "claude",
        builds: {
          marketplace: { skills: "yes", agents: "yes", mcp: "yes", hooks: "bridge", rules: "no", commands: "no" },
          flat: { skills: "yes", agents: "yes", mcp: "no", hooks: "bridge", rules: "no", commands: "no" },
        },
      },
    ])
  );
  write("docs/CATALOG.md", "<!--extras-aidd-x:start-->\n<!--extras-aidd-x:end-->\n");
  write("plugins/aidd-x/agents/helper.md", "---\nname: helper\ndescription: Does a small job. Use when asked.\n---\n");
  write("docs/COMPATIBILITY.md", "<!--support:start-->\n<!--support:end-->\n");
  write(
    "README.md",
    "<!--tools:start-->\n<!--tools:end-->\n<!--plugins:start-->\n<!--plugins:end-->\n"
  );
  write("plugins/aidd-x/skills/01-a/SKILL.md", "---\nname: 01-a\n---\n");
  write(
    "docs/assets/plugins/plugins.json",
    JSON.stringify({ "aidd-x": { status: "beta", emoji: "🧪", description: "Does one thing" } })
  );
  return root;
}

test("the generated tables agree with the tree", () => {
  const result = run(["--check"]);

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
});

test("an empty block is reported stale, and syncing fills it from the tree", () => {
  const root = scratchTree();
  try {
    assert.equal(run(["--check", "--root", root]).status, 1);

    assert.equal(run(["--root", root]).status, 0);
    const catalog = fs.readFileSync(path.join(root, "docs/CATALOG.md"), "utf8");
    const compatibility = fs.readFileSync(path.join(root, "docs/COMPATIBILITY.md"), "utf8");
    assert.match(catalog, /\| `SessionStart` \| `hooks\/a\.js` \|/);
    assert.match(compatibility, /\| Claude Code \| `\.claude\/` \| ✅ \| ✅ \| ✅ \| ✅ \| Marketplace only \| Some events \|/);
    assert.doesNotMatch(compatibility, /Rules|Commands/);
    assert.match(catalog, /\| `helper` \| Does a small job \|/);
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    assert.match(readme, /<tr><td><b>Claude Code<\/b><\/td><td align="center">✅<\/td><td align="center">✅<\/td><td align="center">✅<\/td><\/tr>/);
    assert.match(readme, /<table>/);
    assert.match(readme, /<a href="plugins\/aidd-x\/README\.md">\n<img align="right" alt="beta"/);
    assert.match(readme, /<h3>🧪 aidd-x<\/h3>/);
    assert.match(readme, /1 skill · 1 agent · 1 hook<br \/>\nDoes one thing/);

    assert.equal(run(["--check", "--root", root]).status, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a plugin with no entry in plugins.json is refused", () => {
  const root = scratchTree();
  try {
    fs.mkdirSync(path.join(root, "plugins/aidd-y/skills"), { recursive: true });

    const result = run(["--check", "--root", root]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /No entry: aidd-y/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a plugin grid edited by hand is reported stale", () => {
  const root = scratchTree();
  try {
    run(["--root", root]);
    const file = path.join(root, "README.md");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Does one thing", "Does another thing"));

    assert.equal(run(["--check", "--root", root]).status, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a hand-edited row is overwritten rather than kept", () => {
  const root = scratchTree();
  try {
    run(["--root", root]);
    const file = path.join(root, "docs/CATALOG.md");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("`SessionStart`", "`Stop`"));

    assert.equal(run(["--check", "--root", root]).status, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the real catalog carries a block for every plugin that ships agents or hooks", () => {
  const catalog = fs.readFileSync(path.join(REPOSITORY, "docs/CATALOG.md"), "utf8");
  for (const plugin of fs.readdirSync(path.join(REPOSITORY, "plugins"))) {
    const ships = ["agents", "hooks/hooks.json"].some((entry) => fs.existsSync(path.join(REPOSITORY, "plugins", plugin, entry)));
    assert.equal(catalog.includes(`<!--extras-${plugin}:start-->`), ships, plugin);
  }
});

test("the real documents carry the markers the script writes between", () => {
  for (const [file, marker] of [
    ["docs/COMPATIBILITY.md", "support"],
    ["README.md", "tools"],
    ["README.md", "plugins"],
  ]) {
    const text = fs.readFileSync(path.join(REPOSITORY, file), "utf8");
    assert.ok(text.includes(`<!--${marker}:start-->`) && text.includes(`<!--${marker}:end-->`), file);
  }
});
