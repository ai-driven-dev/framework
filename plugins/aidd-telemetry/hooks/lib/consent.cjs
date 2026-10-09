const fs = require("node:fs");
const path = require("node:path");

/** Walks up from `start` to the first directory holding `.git`, without spawning git. For a
 * linked worktree (`.git` is a file) it also names the main working tree, found through the
 * gitdir's `commondir`, so the person's one `.aidd/config.json` answers for every worktree. */
function locateRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    const dotGit = path.join(dir, ".git");
    let stat = null;
    try {
      stat = fs.statSync(dotGit);
    } catch {
      // not here
    }
    if (stat !== null) return { root: dir, mainRoot: stat.isFile() ? mainRootOf(dir, dotGit) : dir };
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function mainRootOf(root, dotGitFile) {
  try {
    const match = /^gitdir:\s*(.+)$/mu.exec(fs.readFileSync(dotGitFile, "utf8"));
    if (!match) return root;
    const gitdir = path.resolve(root, match[1].trim());
    const commonFile = fs.readFileSync(path.join(gitdir, "commondir"), "utf8").trim();
    const common = path.resolve(gitdir, commonFile);
    return path.basename(common) === ".git" ? path.dirname(common) : root;
  } catch {
    return root;
  }
}

/** The text of `.aidd/config.json` under `root`, or null. */
function readConfig(root) {
  try {
    return fs.readFileSync(path.join(root, ".aidd", "config.json"), "utf8");
  } catch {
    return null;
  }
}

/** granted | absent | unreadable. Only `enabled: true` with `version: 2` is consent. */
function consentOf(text) {
  if (text === null) return "absent";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return "unreadable";
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return "unreadable";
  const telemetry = parsed.telemetry;
  const granted =
    telemetry !== null && typeof telemetry === "object" && telemetry.enabled === true && telemetry.version === 2;
  return granted ? "granted" : "absent";
}

/** The environment refuses on exactly "0". */
function refusedByEnvironment(env = process.env) {
  return env.AIDD_TELEMETRY === "0";
}

/** Whether the project at `located` has opted in. A linked worktree with no config of its own
 * takes the main working tree's. */
function consentGranted(located, env = process.env) {
  if (located === null || refusedByEnvironment(env)) return false;
  const own = readConfig(located.root);
  const text = own === null && located.mainRoot !== located.root ? readConfig(located.mainRoot) : own;
  return consentOf(text) === "granted";
}

module.exports = { locateRoot, consentOf, consentGranted, refusedByEnvironment };
