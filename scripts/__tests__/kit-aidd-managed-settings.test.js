const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const yaml = require("js-yaml");

const root = path.resolve(__dirname, "../..");
const specPath = path.join(root, "kits/aidd/spec.yaml");

const RECOMMENDED_PLUGINS = [
  "aidd-context",
  "aidd-dev",
  "aidd-orchestrator",
  "aidd-pm",
  "aidd-refine",
  "aidd-vcs",
].sort();

function loadSpec() {
  return yaml.load(fs.readFileSync(specPath, "utf8"));
}

/** The exact `for plugin in ... do` list the install command loops over, read from the live
 * spec rather than re-typed, so a future edit to the loop cannot drift from this test unnoticed. */
function installedPlugins(installCommand) {
  const match = installCommand.match(/for plugin in([\s\S]*?)\ndo\b/);
  assert.ok(match, "expected a `for plugin in ... do` loop in the install command");
  return match[1]
    .split(/[\s\\]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Runs the merge command verbatim, pointed at fixture paths instead of its hardcoded
 * `/etc/claude-code/managed-settings.json` and `/home/agent/.claude/settings.json`. */
function runMerge(mergeCommand, managed, user) {
  const script = mergeCommand
    .replaceAll("/etc/claude-code/managed-settings.json", managed)
    .replaceAll("/home/agent/.claude/settings.json", user);
  execFileSync("sh", ["-c", script], { stdio: "pipe" });
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-kit-managed-settings-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("the install loop names the recommended plugins and never aidd-ui", () => {
  const spec = loadSpec();
  const plugins = installedPlugins(spec.setup.install[0].command);

  assert.deepEqual([...plugins].sort(), RECOMMENDED_PLUGINS);
  assert.ok(!plugins.includes("aidd-ui"), "aidd-ui must stay opt-in, not installed by default");
});

test("the managed-settings merge adds the marketplace and plugins, keeping unrelated keys", () => {
  const spec = loadSpec();
  const mergeCommand = spec.setup.install[1].command;

  withTempDir((dir) => {
    const managed = path.join(dir, "managed.json");
    const user = path.join(dir, "user.json");
    fs.writeFileSync(managed, JSON.stringify({ unrelated: "kept" }));
    fs.writeFileSync(
      user,
      JSON.stringify({
        extraKnownMarketplaces: {
          "aidd-framework": { source: { source: "github", repo: "ai-driven-dev/framework" } },
        },
        enabledPlugins: {
          "aidd-context@aidd-framework": true,
          "aidd-dev@aidd-framework": true,
        },
      })
    );

    runMerge(mergeCommand, managed, user);

    const merged = JSON.parse(fs.readFileSync(managed, "utf8"));
    assert.equal(merged.unrelated, "kept");
    assert.ok(merged.extraKnownMarketplaces["aidd-framework"]);
    assert.equal(merged.enabledPlugins["aidd-context@aidd-framework"], true);
    assert.equal(merged.enabledPlugins["aidd-ui@aidd-framework"], undefined);
  });
});

test("the managed-settings merge creates a missing managed file first", () => {
  const spec = loadSpec();
  const mergeCommand = spec.setup.install[1].command;

  withTempDir((dir) => {
    const managed = path.join(dir, "nested", "managed.json");
    const user = path.join(dir, "user.json");
    fs.writeFileSync(user, JSON.stringify({ enabledPlugins: { "aidd-dev@aidd-framework": true } }));

    runMerge(mergeCommand, managed, user);

    const merged = JSON.parse(fs.readFileSync(managed, "utf8"));
    assert.equal(merged.enabledPlugins["aidd-dev@aidd-framework"], true);
  });
});

test("the managed-settings merge is a no-op when the user settings file is absent", () => {
  const spec = loadSpec();
  const mergeCommand = spec.setup.install[1].command;

  withTempDir((dir) => {
    const managed = path.join(dir, "managed.json");
    const user = path.join(dir, "user.json"); // never created
    fs.writeFileSync(managed, JSON.stringify({ unrelated: "kept" }));

    runMerge(mergeCommand, managed, user);

    const merged = JSON.parse(fs.readFileSync(managed, "utf8"));
    assert.deepEqual(merged, { unrelated: "kept" });
  });
});
