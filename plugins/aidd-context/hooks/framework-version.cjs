#!/usr/bin/env node
/**
 * SessionStart: tells the conversation which AIDD framework release this installation runs, so
 * the startup greeting can name it, and whether a newer release of the same source is known.
 *
 * The version is the marketplace's own (`.claude-plugin/marketplace.json`), never a plugin's or
 * the CLI's: the three are versioned apart. It is read locally, from wherever this installation
 * came from:
 *
 * - Claude Code's plugin cache: `<plugins>/cache/<marketplace>/<plugin>/<version>/`, resolved
 *   through `<plugins>/known_marketplaces.json` to the marketplace it was installed from;
 * - an `aidd` CLI install copied into the project: its `.aidd/manifest.json`, then the
 *   `marketplaces.json` that registered the plugin's marketplace, project scope first;
 * - a marketplace directory holding this script: a local checkout, or the framework itself.
 *
 * Anything else is reported as unknown rather than guessed.
 *
 * Discovering a newer release needs the network, which a session start never waits on: only a
 * cached answer is read here, and a stale one is refreshed by a detached child for the next
 * session. A source compared remotely is a GitHub repository on a branch; a local checkout, a
 * pinned tag or commit, or any other host is never compared, so nothing claims an installation
 * is up to date when it was not checked.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const MANIFEST = path.join(".claude-plugin", "marketplace.json");
const OWNING_PLUGIN = "aidd-context";
const RELEASES_URL = "https://github.com/ai-driven-dev/framework/releases";
const CHECK_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
// A ref naming a release, not a branch: following it is the person's choice, not an update.
const PINNED_REF = /(^|-)v?\d+\.\d+\.\d+$|^[0-9a-f]{40}$/;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function marketplaceAt(dir) {
  const manifest = readJson(path.join(dir, MANIFEST));
  if (manifest === null || !Array.isArray(manifest.plugins)) return null;
  if (!manifest.plugins.some((p) => p?.name === OWNING_PLUGIN)) return null;
  return manifest;
}

function semverOrNull(value) {
  return typeof value === "string" && SEMVER.test(value) ? value : null;
}

function compareSemver(a, b) {
  const pa = SEMVER.exec(a).slice(1).map(Number);
  const pb = SEMVER.exec(b).slice(1).map(Number);
  for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** The same directory the CLI resolves, so a machine-scope `aidd clean` purges this cache too. */
function userConfigDir(env) {
  if (env.AIDD_USER_CONFIG_DIR) return env.AIDD_USER_CONFIG_DIR;
  if (env.XDG_CONFIG_HOME) return path.join(env.XDG_CONFIG_HOME, "aidd");
  return path.join(os.homedir(), ".config", "aidd");
}

/** `owner/repo` of a github.com remote, or null. */
function githubRepoOf(url) {
  const match = /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(url ?? "");
  return match ? match[1] : null;
}

/** Claude Code's and the CLI's source shapes, reduced to what a comparison needs. */
function normalizeSource(raw) {
  if (raw === null || typeof raw !== "object") return null;
  const kind = raw.source ?? raw.kind;
  if (kind === "directory" || kind === "local") return { kind: "local", path: raw.path };
  if (kind === "github") return { kind: "github", repo: raw.repo, ref: raw.ref, sha: raw.sha };
  if (kind === "git" || kind === "url") {
    const repo = githubRepoOf(raw.url);
    if (repo !== null) return { kind: "github", repo, ref: raw.ref, sha: raw.sha };
    // A Claude Code `url` source points at the manifest itself.
    if (kind === "url" && /marketplace\.json$/.test(raw.url ?? "")) {
      return { kind: "manifest-url", url: raw.url };
    }
    return { kind: "other", url: raw.url };
  }
  return null;
}

function fromClaudeCache(pluginRoot) {
  const parts = pluginRoot.split(path.sep);
  const at = parts.lastIndexOf("cache");
  if (at < 1 || parts.length !== at + 4) return null;
  const pluginsDir = parts.slice(0, at).join(path.sep);
  const name = parts[at + 1];
  const known = readJson(path.join(pluginsDir, "known_marketplaces.json"));
  const entry = known?.[name];
  if (!entry || typeof entry.installLocation !== "string") return null;
  const manifest = marketplaceAt(entry.installLocation);
  return {
    mode: "claude",
    marketplace: name,
    version: semverOrNull(manifest?.version),
    source: normalizeSource(entry.source),
  };
}

function fromAncestorMarketplace(start) {
  let dir = start;
  for (;;) {
    const manifest = marketplaceAt(dir);
    if (manifest !== null) {
      return {
        mode: "local",
        marketplace: manifest.name ?? null,
        version: semverOrNull(manifest.version),
        source: { kind: "local", path: dir },
      };
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function fromAiddCli(projectRoot, env) {
  const manifest = readJson(path.join(projectRoot, ".aidd", "manifest.json"));
  const tools = manifest?.tools && typeof manifest.tools === "object" ? manifest.tools : {};
  const name = Object.values(tools)
    .flatMap((tool) => (Array.isArray(tool?.plugins) ? tool.plugins : []))
    .find((plugin) => plugin?.name === OWNING_PLUGIN)?.marketplace;
  if (typeof name !== "string") return null;
  const registries = [
    path.join(projectRoot, ".aidd", "marketplaces.json"),
    path.join(userConfigDir(env), "marketplaces.json"),
  ];
  for (const file of registries) {
    const entry = readJson(file)?.marketplaces?.find?.((m) => m?.name === name);
    if (!entry) continue;
    return {
      mode: "aidd",
      marketplace: name,
      version: semverOrNull(entry.version),
      source: normalizeSource(entry.source),
    };
  }
  return null;
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** A copy the CLI wrote into the project answers to the CLI's record of where it came from,
 * before any marketplace that happens to sit above the project. */
function resolveInstallation({ scriptDir, projectRoot, env }) {
  const unknown = { mode: "unknown", marketplace: null, version: null, source: null };
  const cliCopy = isInside(scriptDir, projectRoot) ? fromAiddCli(projectRoot, env) : null;
  return (
    fromClaudeCache(path.dirname(scriptDir)) ?? cliCopy ?? fromAncestorMarketplace(scriptDir) ?? unknown
  );
}

/** Where the newest release on the installation's own source and channel is published, or null
 * when that source is not one to compare against. */
function releaseManifestUrl(source) {
  if (source?.kind === "manifest-url") return source.url;
  if (source?.kind !== "github" || typeof source.repo !== "string") return null;
  if (source.sha || (source.ref && PINNED_REF.test(source.ref))) return null;
  return `https://raw.githubusercontent.com/${source.repo}/${source.ref || "HEAD"}/${MANIFEST.split(path.sep).join("/")}`;
}

function cacheFile(env) {
  return path.join(userConfigDir(env), "cache", "framework-release-check.json");
}

function readCache(env) {
  const cache = readJson(cacheFile(env));
  return cache && typeof cache === "object" ? cache : {};
}

function writeCacheEntry(env, url, entry) {
  const file = cacheFile(env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const cache = readCache(env);
  cache[url] = entry;
  fs.writeFileSync(file, JSON.stringify(cache));
}

/** The cached newest release, refreshed in the background when stale. Never waits on the
 * network: a first session learns nothing, the next one reads what the refresh found. */
function knownLatest(url, env, now) {
  const entry = readCache(env)[url];
  const latest = semverOrNull(entry?.latest);
  if (typeof entry?.checkedAt === "number" && now - entry.checkedAt < CHECK_TTL_MS) return latest;
  try {
    // Claimed before the child runs, so concurrent sessions start one refresh, not one each.
    writeCacheEntry(env, url, { checkedAt: now, latest });
    const child = spawn(process.execPath, [__filename, "--refresh", url], {
      // Not the project: on Windows a live child's working directory cannot be removed.
      cwd: os.tmpdir(),
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("error", () => {});
    child.unref();
  } catch {
    // An unwritable cache or a failed spawn only costs the notice.
  }
  return latest;
}

async function refresh(url, env) {
  const previous = semverOrNull(readCache(env)[url]?.latest);
  let latest = previous;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (response.ok) latest = semverOrNull((await response.json())?.version) ?? previous;
  } catch {
    // Unreachable is not "up to date": the previous answer, or none, stands.
  }
  writeCacheEntry(env, url, { checkedAt: Date.now(), latest });
}

function updateInstruction(installation) {
  const name = installation.marketplace ?? "aidd-framework";
  if (installation.mode === "claude") {
    return `run \`/plugin marketplace update ${name}\`, then update the AIDD plugins from \`/plugin\``;
  }
  if (installation.mode === "aidd") {
    return `run \`aidd marketplace refresh ${name}\`, then \`aidd plugin update\``;
  }
  return `see ${RELEASES_URL}`;
}

function describeSource(source) {
  if (source?.kind === "github") return `github.com/${source.repo}${source.ref ? `@${source.ref}` : ""}`;
  if (source?.kind === "local") return `local directory ${source.path}`;
  if (source?.kind === "manifest-url" || source?.kind === "other") return source.url;
  return "an unrecorded source";
}

/** The hook's whole answer: what the model is told, and what the person is shown directly. */
function startupReport({ scriptDir, projectRoot, env, now }) {
  const installation = resolveInstallation({ scriptDir, projectRoot, env });
  if (installation.version === null) {
    return {
      context:
        "AIDD framework: version unknown (no marketplace manifest found for this installation). " +
        "Greet with `Framework version unknown`; never substitute a plugin or CLI version.",
      notice: null,
    };
  }
  const lines = [
    `AIDD framework: v${installation.version}, marketplace ${installation.marketplace ?? "unnamed"}, ` +
      `installed from ${describeSource(installation.source)}.`,
  ];
  const url = releaseManifestUrl(installation.source);
  const latest = url === null ? null : knownLatest(url, env, now);
  let notice = null;
  if (latest !== null && compareSemver(latest, installation.version) > 0) {
    notice =
      `AIDD framework v${latest} is available (installed: v${installation.version}). ` +
      `To update, ${updateInstruction(installation)}. Nothing is installed automatically.`;
    lines.push(
      `AIDD framework update: ${notice} This is the marketplace release; each plugin keeps its own version.`
    );
  }
  return { context: lines.join("\n"), notice };
}

function main() {
  const env = process.env;
  if (process.argv[2] === "--refresh") {
    refresh(process.argv[3], env).catch(() => {});
    return;
  }
  try {
    const report = startupReport({
      scriptDir: __dirname,
      projectRoot: process.cwd(),
      env,
      now: Date.now(),
    });
    const output = {
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: report.context },
    };
    if (report.notice !== null) output.systemMessage = report.notice;
    process.stdout.write(JSON.stringify(output));
  } catch {
    // A version line is never worth a failed session start.
  }
}

main();
