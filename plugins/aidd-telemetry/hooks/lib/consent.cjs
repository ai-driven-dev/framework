const { git } = require("./git.cjs");

/** The one value of `aidd.telemetry` that is consent: this version of measurement. */
const GRANTED_VALUE = "2";

/** granted | absent. Only `2` is consent: `off`, another number or nothing grants nothing. */
function consentOf(value) {
  return value === GRANTED_VALUE ? "granted" : "absent";
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

/** Whether the clone at `cwd` has opted in. The environment is asked first, so a refusal
 * spawns nothing. Nothing in the work tree is consent: a committed file cannot opt a
 * teammate in. */
function consentGranted(cwd, env = process.env) {
  if (refusedByEnvironment(env)) return false;
  return consentOf(readConsent(cwd, env)) === "granted";
}

module.exports = { consentOf, consentGranted, readConsent, refusedByEnvironment };
