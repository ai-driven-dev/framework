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

const FIELDS = {
  task: ".aiddtask",
  ticket: ".aiddticket",
  declared_for: ".aidddeclaredfor",
  declared_at: ".aidddeclaredat",
};

/** `git config --local -z --get-regexp` output for one branch. git lists the variable part of
 * a key in lower case and the branch name keeps its case; the branch name may hold dots, so
 * the known suffix is cut off the end. */
function parseBranchConfig(output, branch) {
  const held = { task: null, ticket: null, declared_for: null, declared_at: null, listed_twice: false };
  const seen = new Set();
  for (const entry of output.split("\0")) {
    if (!entry.startsWith("branch.")) continue;
    const newline = entry.indexOf("\n");
    const key = newline === -1 ? entry : entry.slice(0, newline);
    const value = newline === -1 ? "" : entry.slice(newline + 1);
    const lower = key.toLowerCase();
    for (const [field, suffix] of Object.entries(FIELDS)) {
      if (!lower.endsWith(suffix)) continue;
      if (key.slice("branch.".length, key.length - suffix.length) === branch) {
        held.listed_twice ||= seen.has(field);
        seen.add(field);
        held[field] = value === "" ? null : value;
      }
    }
  }
  return held;
}

/** Only the command declares, and it writes `aiddDeclaredAt` last: a key without it was set by
 * hand or cut short. A stamp naming another branch was carried here by `git branch -c` or
 * `-m`. A key listed twice mixes the declaration copied by `-C` or `-M` with the branch's own:
 * neither is whole. A declaration with no stamp was written before stamping existed and still
 * counts. */
function declaredByTheCommand(held, branch) {
  return !held.listed_twice && held.declared_at !== null && (held.declared_for ?? branch) === branch;
}

/** The branch's declaration ({task, ticket, declared_at}) when the command made it on this
 * branch, else null. */
function branchDeclaration(cwd, branch, env) {
  const run = git(cwd, ["config", "--local", "-z", "--get-regexp", "^branch\\..*\\.aidd(task|ticket|declaredfor|declaredat)$"], env);
  if (run.status !== 0) return null;
  const held = parseBranchConfig(run.stdout, branch);
  return declaredByTheCommand(held, branch) ? { task: held.task, ticket: held.ticket, declared_at: held.declared_at } : null;
}

/** HEAD and origin/HEAD for the working tree at `cwd`, and the role they give. */
function headOf(cwd, env) {
  const head = symbolicRef(cwd, "HEAD", env);
  const originHead = symbolicRef(cwd, "refs/remotes/origin/HEAD", env);
  return { branch: currentBranchOf(head), role: branchRoleOf(head, originHead) };
}

module.exports = { git, branchRoleOf, currentBranchOf, parseBranchConfig, branchDeclaration, headOf, cleanEnv };
