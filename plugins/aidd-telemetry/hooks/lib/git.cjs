const { spawnSync } = require("node:child_process");

const HEADS = "refs/heads/";
const REMOTE_HEAD_TARGET = "refs/remotes/origin/";
const CONVENTIONAL_DEFAULTS = ["main", "master"];
const GIT_TIMEOUT_MS = 5000;

/** git's own variables would point it at another repository, a commit hook's included. */
function cleanEnv(env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith("GIT_")));
}

function git(cwd, args, env = process.env) {
  const run = spawnSync("git", args, {
    cwd,
    env: cleanEnv(env),
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: GIT_TIMEOUT_MS,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (run.error || run.status === null) return { status: null, stdout: "" };
  return { status: run.status, stdout: run.stdout };
}

/** `symbolic-ref --quiet`: the ref text, or null when it is not symbolic (detached) or absent. */
function symbolicRef(cwd, ref, env) {
  const run = git(cwd, ["symbolic-ref", "--quiet", ref], env);
  return run.status === 0 ? run.stdout.trim() : null;
}

function after(prefix, ref) {
  const name = ref === null ? "" : ref.trim();
  return name.startsWith(prefix) && name.length > prefix.length ? name.slice(prefix.length) : null;
}

function currentBranchOf(headRef) {
  return after(HEADS, headRef);
}

/** working | default | detached. The default is where the remote's head points, else main or
 * master. Only a working branch is ever bound. */
function branchRoleOf(headRef, originHeadRef) {
  const branch = currentBranchOf(headRef);
  if (branch === null) return "detached";
  const remoteDefault = after(REMOTE_HEAD_TARGET, originHeadRef);
  const isDefault = remoteDefault === null ? CONVENTIONAL_DEFAULTS.includes(branch) : branch === remoteDefault;
  return isDefault ? "default" : "working";
}

const FIELDS = { task: ".aiddtask", ticket: ".aiddticket", declared_at: ".aidddeclaredat" };

/** `git config --local -z --get-regexp` output for one branch. git lists the variable part of
 * a key in lower case and the branch name keeps its case; the branch name may hold dots, so
 * the known suffix is cut off the end. */
function parseBranchConfig(output, branch) {
  const held = { task: null, ticket: null, declared_at: null };
  for (const entry of output.split("\0")) {
    if (!entry.startsWith("branch.")) continue;
    const newline = entry.indexOf("\n");
    const key = newline === -1 ? entry : entry.slice(0, newline);
    const value = newline === -1 ? "" : entry.slice(newline + 1);
    const lower = key.toLowerCase();
    for (const [field, suffix] of Object.entries(FIELDS)) {
      if (!lower.endsWith(suffix)) continue;
      if (key.slice("branch.".length, key.length - suffix.length) === branch) {
        held[field] = value === "" ? null : value;
      }
    }
  }
  return held;
}

function branchDeclaration(cwd, branch, env) {
  const run = git(cwd, ["config", "--local", "-z", "--get-regexp", "^branch\\..*\\.aidd(task|ticket|declaredat)$"], env);
  if (run.status !== 0) return { task: null, ticket: null, declared_at: null };
  return parseBranchConfig(run.stdout, branch);
}

/** HEAD and origin/HEAD for the working tree at `cwd`, and the role they give. */
function headOf(cwd, env) {
  const head = symbolicRef(cwd, "HEAD", env);
  const originHead = symbolicRef(cwd, "refs/remotes/origin/HEAD", env);
  return { branch: currentBranchOf(head), role: branchRoleOf(head, originHead) };
}

module.exports = { branchRoleOf, currentBranchOf, parseBranchConfig, branchDeclaration, headOf, cleanEnv };
