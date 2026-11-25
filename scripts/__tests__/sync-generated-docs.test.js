const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const SCRIPT = path.resolve(__dirname, "..", "sync-generated-docs.mjs");

const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

/** A tree with one tool in the support record and both documents emptied. */
function scratchTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-sync-docs-"));
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
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
  write("docs/COMPATIBILITY.md", "<!--support:start-->\n<!--support:end-->\n");
  write("README.md", "<!--tools:start-->\n<!--tools:end-->\n");
  return root;
}

test("an empty block is reported stale, and syncing fills it from the support record", () => {
  const root = scratchTree();
  try {
    assert.equal(run(["--check", "--root", root]).status, 1);

    assert.equal(run(["--root", root]).status, 0);
    const compatibility = fs.readFileSync(path.join(root, "docs/COMPATIBILITY.md"), "utf8");
    assert.match(compatibility, /\| Claude Code \| `\.claude\/` \| ✅ \| ✅ \| ✅ \| ✅ \| Marketplace only \| Some events \|/);
    assert.doesNotMatch(compatibility, /Rules|Commands/);
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    assert.match(readme, /<tr><td><b>Claude Code<\/b><\/td><td align="center">✅<\/td><td align="center">✅<\/td><td align="center">✅<\/td><\/tr>/);

    assert.equal(run(["--check", "--root", root]).status, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a hand-edited row is overwritten rather than kept", () => {
  const root = scratchTree();
  try {
    run(["--root", root]);
    const file = path.join(root, "docs/COMPATIBILITY.md");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Claude Code", "Claude"));

    assert.equal(run(["--check", "--root", root]).status, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a rules column reads as what a build carries, not what an install delivers", () => {
  const root = scratchTree();
  try {
    const record = path.join(root, "cli/tests/golden/snapshots/tool-support/surface.json");
    const tools = JSON.parse(fs.readFileSync(record, "utf8"));
    tools[0].builds.flat.rules = "yes";
    fs.writeFileSync(record, JSON.stringify(tools));

    run(["--root", root]);

    assert.match(fs.readFileSync(path.join(root, "docs/COMPATIBILITY.md"), "utf8"), /\| Rules in a build \|/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
