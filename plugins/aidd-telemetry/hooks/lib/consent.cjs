const fs = require("node:fs");
const path = require("node:path");
const { git } = require("./git.cjs");
const { appendRecord } = require("./jsonl.cjs");
const { telemetryDir } = require("./telemetry-dir.cjs");

/** A key that grants names an interval: `2:` (this version of measurement) and its token. */
const GRANTING = /^2:(\S+)$/u;

/** The token a key names, or null when it grants nothing: a bare `2`, `off`, another number or
 * nothing. */
function tokenOfKey(value) {
  if (typeof value !== "string") return null;
  const match = GRANTING.exec(value);
  return match === null ? null : match[1];
}

/** The environment refuses on exactly "0". */
function refusedByEnvironment(env = process.env) {
  return env.AIDD_TELEMETRY === "0";
}

/** `git config --local aidd.telemetry` as seen from `cwd`, or null when it is unset, or git
 * cannot answer (not a repository, no git). `--local` is the repository's own config, which
 * every linked worktree of it shares and no commit carries. */
function readConsent(cwd, env = process.env) {
  const run = git(cwd, ["config", "--local", "--get", "aidd.telemetry"], env);
  return run.status === 0 ? run.stdout.replace(/\r?\n$/u, "") : null;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sameKeys(object, keys) {
  const held = Object.keys(object);
  return held.length === keys.length && keys.every((key) => held.includes(key));
}

function instant(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? Date.parse(value) : null;
}

function nonEmpty(value) {
  return typeof value === "string" && value !== "";
}

/** The clone of an `open` line, as the CLI writes it, or null when it is not exactly that. */
function parseClone(value) {
  if (!isObject(value)) return null;
  const { path: clonePath, dev, ino, birthtimeMs } = value;
  if (!nonEmpty(clonePath) || !nonEmpty(dev) || !nonEmpty(ino) || ino === "0") return null;
  if (typeof birthtimeMs !== "number" || !Number.isFinite(birthtimeMs) || birthtimeMs < 0) return null;
  return { path: clonePath, identity: { dev, ino, birthtimeMs } };
}

/** The identity of a directory from `fs.statSync(path, { bigint: true })`, normalised exactly as
 * the CLI's `clone-identity.ts` does, and pinned by the shared fixture (`cloneIdentity` cases):
 * the inode and device as text, so a Windows file index is not rounded; a birth time that is
 * missing, or equal to the change time to the nanosecond (what Linux gives when the file system
 * keeps none), as `0`; null when there is no inode. */
function identityFromStat(stat) {
  if (stat.ino === 0n) return null;
  const born = stat.birthtimeMs <= 0n || stat.birthtimeNs === stat.ctimeNs ? 0n : stat.birthtimeMs;
  return { dev: String(stat.dev), ino: String(stat.ino), birthtimeMs: Number(born) };
}

function sameIdentity(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.birthtimeMs === b.birthtimeMs;
}

/** One line of `consents.jsonl`: `{token, clone, open}` or `{token, close}`, exactly. Anything
 * else is null. */
function parseLine(line) {
  let value;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isObject(value) || typeof value.token !== "string" || !/^\S+$/u.test(value.token)) return null;
  if (sameKeys(value, ["token", "clone", "open"])) {
    const clone = parseClone(value.clone);
    const at = instant(value.open);
    return clone === null || at === null
      ? null
      : { kind: "open", token: value.token, path: clone.path, identity: clone.identity, at };
  }
  if (sameKeys(value, ["token", "close"])) {
    const at = instant(value.close);
    return at === null ? null : { kind: "close", token: value.token, at };
  }
  return null;
}

/** The intervals the file says, and whether a line of it was not an event. Same rules as the
 * CLI, pinned by the shared fixture: a blank line is not damage, a token opened twice is its
 * first opening, a token closed twice ends at the earliest close, and an unterminated last
 * line is not written yet. */
function parseConsentLog(text) {
  const events = [];
  let damaged = false;
  // The text after the last newline is a write a crash cut short, or one still in flight: not
  // written yet, so ignored whole, even when it would parse.
  const terminated = (text ?? "").split("\n");
  terminated.pop();
  for (const line of terminated) {
    if (line.trim() === "") continue;
    const event = parseLine(line);
    if (event === null) damaged = true;
    else events.push(event);
  }
  const closes = new Map();
  for (const event of events) {
    if (event.kind === "close") closes.set(event.token, Math.min(event.at, closes.get(event.token) ?? event.at));
  }
  const intervals = new Map();
  for (const event of events) {
    if (event.kind !== "open" || intervals.has(event.token)) continue;
    intervals.set(event.token, {
      token: event.token,
      path: event.path,
      identity: event.identity,
      from: event.at,
      to: closes.has(event.token) ? closes.get(event.token) : null,
    });
  }
  return { damaged, intervals: [...intervals.values()] };
}

/** What a clone's key and the consent log say together, for the clone whose git common dir has
 * the real path `realpath` and the identity `identity` (null when the platform gives it none).
 * The clone consents only when its key names an interval that is open and was opened for this
 * very clone, path and identity both: a key set by hand, one carried by a copy, one left in a
 * clone that was moved, or a copy swapped in at the path of a deleted original names no
 * interval open here. `close` lists the open intervals of this clone that the key no longer
 * names, which the hook ends. Another clone's interval at the same path is not this clone's to
 * end: the CLI closes it when it sees the swap. */
function decideConsent({ key, log, realpath, identity }) {
  if (log.damaged) return { granted: false, close: [] };
  const token = tokenOfKey(key);
  const here = log.intervals.filter(
    (interval) =>
      interval.to === null &&
      interval.path === realpath &&
      identity !== null &&
      identity !== undefined &&
      sameIdentity(interval.identity, identity)
  );
  return {
    granted: here.some((interval) => interval.token === token),
    close: here.filter((interval) => interval.token !== token).map((interval) => interval.token),
  };
}

function consentLogFile(env) {
  return path.join(telemetryDir({ env }), "ledger", "consents.jsonl");
}

function readConsentLog(file) {
  try {
    return parseConsentLog(fs.readFileSync(file, "utf8"));
  } catch {
    return parseConsentLog("");
  }
}

/** The real path of the clone's git common dir, spelled as the CLI records it. */
function commonDirRealpath(cwd, env) {
  const run = git(cwd, ["rev-parse", "--git-common-dir"], env);
  if (run.status !== 0) return null;
  try {
    return fs.realpathSync.native(path.resolve(fs.realpathSync.native(cwd), run.stdout.trim()));
  } catch {
    return null;
  }
}

/** The identity of the directory at `realpath`, null when it cannot be looked at or has none. */
function identityOf(realpath) {
  try {
    return identityFromStat(fs.statSync(realpath, { bigint: true }));
  } catch {
    return null;
  }
}

/** Whether the clone at `cwd` is measured: its key names an open interval opened for it. The
 * environment is asked first, then the log, so a refusal and a machine where nobody ever opted
 * in spawn nothing. Along the way, an open interval of this clone that its key no longer names
 * is closed, now, whoever is present: that is what ends a manual `git config aidd.telemetry
 * off` before the next prompt's calls. Nothing in the work tree is consent: a committed file
 * cannot opt a teammate in. */
function consentGranted(cwd, env = process.env, now = new Date()) {
  if (refusedByEnvironment(env)) return false;
  const file = consentLogFile(env);
  const log = readConsentLog(file);
  if (log.damaged || !log.intervals.some((interval) => interval.to === null)) return false;
  const realpath = commonDirRealpath(cwd, env);
  if (realpath === null) return false;
  const decision = decideConsent({
    key: readConsent(cwd, env),
    log,
    realpath,
    identity: identityOf(realpath),
  });
  for (const token of decision.close) appendRecord(file, { token, close: now.toISOString() }, { dropTornTail: true });
  return decision.granted;
}

module.exports = {
  consentGranted,
  decideConsent,
  identityFromStat,
  parseConsentLog,
  readConsent,
  refusedByEnvironment,
  tokenOfKey,
};
