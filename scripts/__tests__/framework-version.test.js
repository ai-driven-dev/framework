const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

// The hook is a script the hosts copy, so each case copies it into the layout one installation
// mode leaves on disk and runs it as a subprocess, which is what ships.
const SCRIPT = path.resolve(__dirname, "../../plugins/aidd-context/hooks/framework-version.cjs");
const GITHUB_MANIFEST_URL =
  "https://raw.githubusercontent.com/ai-driven-dev/framework/HEAD/.claude-plugin/marketplace.json";

function sandbox(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-framework-version-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content));
}

function marketplace(version) {
  return { name: "aidd-framework", version, plugins: [{ name: "aidd-context", source: "./x" }] };
}

function installScript(hooksDir) {
  fs.mkdirSync(hooksDir, { recursive: true });
  const target = path.join(hooksDir, "framework-version.cjs");
  fs.copyFileSync(SCRIPT, target);
  return target;
}

function run(script, { cwd, configDir }) {
  const result = spawnSync(process.execPath, [script], {
    cwd,
    env: { PATH: process.env.PATH, AIDD_USER_CONFIG_DIR: configDir },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function seedCache(configDir, url, latest, checkedAt = Date.now()) {
  write(path.join(configDir, "cache", "framework-release-check.json"), { [url]: { checkedAt, latest } });
}

function readCache(configDir) {
  return JSON.parse(fs.readFileSync(path.join(configDir, "cache", "framework-release-check.json"), "utf8"));
}

/** Claude Code's layout: the plugin copied into its cache, the marketplace cloned beside it. */
function claudeInstall(root, { version, source }) {
  const plugins = path.join(root, "claude", "plugins");
  const clone = path.join(plugins, "marketplaces", "aidd-framework");
  write(path.join(clone, ".claude-plugin", "marketplace.json"), marketplace(version));
  write(path.join(plugins, "known_marketplaces.json"), {
    "aidd-framework": { source, installLocation: clone },
  });
  return installScript(path.join(plugins, "cache", "aidd-framework", "aidd-context", "2.9.0", "hooks"));
}

test("a Claude Code install names the marketplace's version and where it came from", (t) => {
  const root = sandbox(t);
  const script = claudeInstall(root, {
    version: "5.12.0",
    source: { source: "github", repo: "ai-driven-dev/framework" },
  });
  const configDir = path.join(root, "config");
  seedCache(configDir, GITHUB_MANIFEST_URL, "5.12.0");

  const output = run(script, { cwd: root, configDir });

  assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
  assert.equal(
    output.hookSpecificOutput.additionalContext,
    "AIDD framework: v5.12.0, marketplace aidd-framework, installed from github.com/ai-driven-dev/framework."
  );
  assert.equal(output.systemMessage, undefined);
});

test("a newer release on the same source is announced with the host's update path, never installed", (t) => {
  const root = sandbox(t);
  const script = claudeInstall(root, {
    version: "5.12.0",
    source: { source: "github", repo: "ai-driven-dev/framework" },
  });
  const configDir = path.join(root, "config");
  seedCache(configDir, GITHUB_MANIFEST_URL, "5.13.0");

  const output = run(script, { cwd: root, configDir });

  assert.equal(
    output.systemMessage,
    "AIDD framework v5.13.0 is available (installed: v5.12.0). To update, run " +
      "`/plugin marketplace update aidd-framework`, then update the AIDD plugins from `/plugin`. " +
      "Nothing is installed automatically."
  );
  assert.match(output.hookSpecificOutput.additionalContext, /AIDD framework update: .*v5\.13\.0/);
  assert.match(output.hookSpecificOutput.additionalContext, /each plugin keeps its own version/);
});

test("an older or equal cached release announces nothing", (t) => {
  const root = sandbox(t);
  const script = claudeInstall(root, {
    version: "5.12.0",
    source: { source: "github", repo: "ai-driven-dev/framework" },
  });
  const configDir = path.join(root, "config");
  seedCache(configDir, GITHUB_MANIFEST_URL, "5.11.0");

  assert.equal(run(script, { cwd: root, configDir }).systemMessage, undefined);
});

test("a stale check claims the refresh and still answers from what was known", (t) => {
  const root = sandbox(t);
  // A manifest URL on a closed local port: the detached refresh this starts never leaves the box.
  const url = "http://127.0.0.1:9/.claude-plugin/marketplace.json";
  const script = claudeInstall(root, { version: "5.12.0", source: { source: "url", url } });
  const configDir = path.join(root, "config");
  const stale = Date.now() - 2 * 24 * 60 * 60 * 1000;
  seedCache(configDir, url, "5.13.0", stale);

  const output = run(script, { cwd: root, configDir });

  assert.match(output.systemMessage, /v5\.13\.0 is available/);
  const entry = readCache(configDir)[url];
  assert.ok(entry.checkedAt > stale, "the stale entry is claimed so concurrent sessions do not refresh too");
});

test("a local marketplace directory is its own channel: version read, never compared", (t) => {
  const root = sandbox(t);
  write(path.join(root, "checkout", ".claude-plugin", "marketplace.json"), marketplace("5.12.0"));
  const script = installScript(path.join(root, "checkout", "plugins", "aidd-context", "hooks"));
  const configDir = path.join(root, "config");

  const output = run(script, { cwd: root, configDir });

  assert.equal(
    output.hookSpecificOutput.additionalContext,
    `AIDD framework: v5.12.0, marketplace aidd-framework, installed from local directory ${path.join(root, "checkout")}.`
  );
  assert.equal(fs.existsSync(path.join(configDir, "cache")), false);
});

test("an aidd CLI copy reads the CLI's record, and a pinned release is never compared", (t) => {
  const root = sandbox(t);
  const project = path.join(root, "project");
  write(path.join(project, ".aidd", "manifest.json"), {
    version: 8,
    tools: { opencode: { plugins: [{ name: "aidd-context", marketplace: "aidd-framework" }] } },
  });
  write(path.join(project, ".aidd", "marketplaces.json"), {
    version: 1,
    marketplaces: [
      {
        name: "aidd-framework",
        source: { kind: "github", repo: "ai-driven-dev/framework", ref: "v5.12.0" },
        version: "5.12.0",
      },
    ],
  });
  const script = installScript(path.join(project, ".opencode", "hooks", "aidd-context"));
  const configDir = path.join(root, "config");

  const output = run(script, { cwd: project, configDir });

  assert.equal(
    output.hookSpecificOutput.additionalContext,
    "AIDD framework: v5.12.0, marketplace aidd-framework, installed from github.com/ai-driven-dev/framework@v5.12.0."
  );
  assert.equal(fs.existsSync(path.join(configDir, "cache")), false);
});

test("an aidd CLI copy registered at user scope announces the CLI's own update path", (t) => {
  const root = sandbox(t);
  const project = path.join(root, "project");
  const configDir = path.join(root, "config");
  write(path.join(project, ".aidd", "manifest.json"), {
    version: 8,
    tools: { codex: { plugins: [{ name: "aidd-context", marketplace: "aidd-framework" }] } },
  });
  write(path.join(configDir, "marketplaces.json"), {
    version: 1,
    marketplaces: [
      { name: "aidd-framework", source: { kind: "url", url: "https://github.com/ai-driven-dev/framework.git" }, version: "5.12.0" },
    ],
  });
  seedCache(configDir, GITHUB_MANIFEST_URL, "5.13.0");
  const script = installScript(path.join(project, ".codex", "hooks", "aidd-context"));

  const output = run(script, { cwd: project, configDir });

  assert.match(output.systemMessage, /run `aidd marketplace refresh aidd-framework`, then `aidd plugin update`/);
});

test("an installation with no manifest anywhere says unknown, never another version", (t) => {
  const root = sandbox(t);
  const script = installScript(path.join(root, "loose", "hooks"));

  const output = run(script, { cwd: root, configDir: path.join(root, "config") });

  assert.match(output.hookSpecificOutput.additionalContext, /^AIDD framework: version unknown/);
  assert.match(output.hookSpecificOutput.additionalContext, /Framework version unknown/);
  assert.equal(output.systemMessage, undefined);
});

function serve(t, handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      t.after(() => server.close());
      resolve(`http://127.0.0.1:${server.address().port}/.claude-plugin/marketplace.json`);
    });
  });
}

function refresh(url, configDir) {
  return new Promise((resolve, reject) => {
    const child = require("node:child_process").spawn(process.execPath, [SCRIPT, "--refresh", url], {
      env: { PATH: process.env.PATH, AIDD_USER_CONFIG_DIR: configDir },
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("close", resolve);
  });
}

test("the background refresh records the newest release its source publishes", async (t) => {
  const root = sandbox(t);
  const configDir = path.join(root, "config");
  const url = await serve(t, (_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(marketplace("5.14.0")));
  });

  await refresh(url, configDir);

  assert.equal(readCache(configDir)[url].latest, "5.14.0");
});

test("an unreachable source keeps what was known instead of claiming up to date", async (t) => {
  const root = sandbox(t);
  const configDir = path.join(root, "config");
  const url = await serve(t, (_req, res) => {
    res.statusCode = 503;
    res.end();
  });
  seedCache(configDir, url, "5.13.0", 0);

  await refresh(url, configDir);

  const entry = readCache(configDir)[url];
  assert.equal(entry.latest, "5.13.0");
  assert.ok(entry.checkedAt > 0);
});
