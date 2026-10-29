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
          marketplace: { skills: "yes", agents: "yes", mcp: "yes", hooks: "yes", rules: "no", commands: "no" },
          flat: { skills: "yes", agents: "yes", mcp: "no", hooks: "bridge", rules: "no", commands: "no" },
        },
      },
    ])
  );
  write("docs/ARCHITECTURE.md", "<!--hooks:start-->\n<!--hooks:end-->\n");
  write("docs/COMPATIBILITY.md", "<!--support:start-->\n<!--support:end-->\n");
  write("CONTRIBUTING.md", "<!--contribute:start-->\n<!--contribute:end-->\n");
  write("RELEASE.md", "<!--release:start-->\n<!--release:end-->\n");
  write("docs/MAINTAINERS.md", "<!--add-plugin:start-->\n<!--add-plugin:end-->\n");
  for (const name of ["contribute", "release", "add-plugin"]) {
    write(`docs/assets/diagrams/${name}.json`, JSON.stringify({ title: name, steps: [{ label: "First", note: "one" }, { label: "Second", note: "two" }] }));
  }
  write(
    "README.md",
    "<!--tools:start-->\n<!--tools:end-->\n<!--sdlc:start-->\n<!--sdlc:end-->\n<!--plugins:start-->\n<!--plugins:end-->\n"
  );
  write(
    "docs/assets/diagrams/sdlc.json",
    JSON.stringify({
      zones: [
        { name: "Frame", steps: [{ label: "spec", note: "the contract" }] },
        { name: "Deliver", steps: [{ label: "plan", note: "phases" }, { label: "implement", note: "the code" }, { label: "assert", note: "checks" }] },
        { name: "Check", steps: [{ label: "review", note: "a reviewer" }] },
      ],
      repeat: { from: "assert", to: "implement", label: "until checks pass" },
      return: { from: "Check", to: "Deliver", label: ["Back"] },
    })
  );
  write("plugins/aidd-x/skills/01-a/SKILL.md", "---\nname: 01-a\n---\n");
  write(
    "docs/assets/plugins/plugins.json",
    JSON.stringify({ "aidd-x": { status: "beta", icon: "code", accent: "#0969da", description: "Does one thing" } })
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
    const architecture = fs.readFileSync(path.join(root, "docs/ARCHITECTURE.md"), "utf8");
    const compatibility = fs.readFileSync(path.join(root, "docs/COMPATIBILITY.md"), "utf8");
    assert.match(architecture, /\| \[`aidd-x`\]\(\.\.\/plugins\/aidd-x\/README\.md\) \| `SessionStart` \| `hooks\/a\.js` \|/);
    assert.match(compatibility, /\| Claude Code \| `\.claude\/` \| ✅ \| ✅ \| ✅ \| ✅ \| ✅ marketplace, ❌ flat files \| ✅ marketplace, ✅ bridge flat files \|/);
    assert.doesNotMatch(compatibility, /Rules|Commands/);
    assert.match(fs.readFileSync(path.join(root, "CONTRIBUTING.md"), "utf8"), /contribute-light\.svg" alt="contribute: First, Second\."/);
    assert.ok(fs.existsSync(path.join(root, "docs/assets/diagrams/release-dark.svg")));
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    assert.match(readme, /<tr><td><b>Claude Code<\/b><\/td><td align="center">✅<\/td><td align="center">✅<\/td><td align="center">✅<\/td><\/tr>/);
    assert.match(readme, /<table>/);
    assert.match(readme, /sdlc-light\.svg" alt="Frame: spec\. Deliver: plan, implement, assert\. Check: review\./);
    const flow = fs.readFileSync(path.join(root, "docs/assets/diagrams/sdlc-dark.svg"), "utf8");
    assert.match(flow, />implement</);
    assert.match(flow, />until checks pass</);
    assert.match(readme, /<a href="plugins\/aidd-x\/README\.md">.*aidd-x-light\.svg" alt="aidd-x, beta, 1 skill: Does one thing"/);
    const card = fs.readFileSync(path.join(root, "docs/assets/plugins/aidd-x-dark.svg"), "utf8");
    assert.match(card, />aidd-x</);
    assert.match(card, />1 skill</);
    assert.match(card, />BETA</);

    assert.equal(run(["--check", "--root", root]).status, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a plugin with no card entry is refused", () => {
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

test("a card file edited by hand is reported stale", () => {
  const root = scratchTree();
  try {
    run(["--root", root]);
    fs.appendFileSync(path.join(root, "docs/assets/plugins/aidd-x-light.svg"), "<!-- hand edit -->");

    assert.equal(run(["--check", "--root", root]).status, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a hand-edited row is overwritten rather than kept", () => {
  const root = scratchTree();
  try {
    run(["--root", root]);
    const file = path.join(root, "docs/ARCHITECTURE.md");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("`SessionStart`", "`Stop`"));

    assert.equal(run(["--check", "--root", root]).status, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the real documents carry the markers the script writes between", () => {
  for (const [file, marker] of [
    ["docs/ARCHITECTURE.md", "hooks"],
    ["docs/COMPATIBILITY.md", "support"],
    ["README.md", "tools"],
    ["README.md", "sdlc"],
    ["CONTRIBUTING.md", "contribute"],
    ["RELEASE.md", "release"],
    ["docs/MAINTAINERS.md", "add-plugin"],
    ["README.md", "plugins"],
  ]) {
    const text = fs.readFileSync(path.join(REPOSITORY, file), "utf8");
    assert.ok(text.includes(`<!--${marker}:start-->`) && text.includes(`<!--${marker}:end-->`), file);
  }
});
