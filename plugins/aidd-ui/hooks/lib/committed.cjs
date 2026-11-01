// A project file as git last committed it, the baseline a validated record is held to. git is
// read through its command line; without git, a repository, a commit or the file, there is no
// baseline, and nothing is held to it. Any other failure is kept for H8 to name. git is asked once
// which files changed, and for the text of those alone, so a run costs a call per changed file, not
// per element. C4 asks two questions more, only when it found a literal, however many files hold one.
const childProcess = require("node:child_process");
const { clean, UI_DIR } = require("./project.cjs");

const GIT_TIMEOUT_MS = 5000;
const GIT_VARIABLE_PREFIX = "GIT_";
const NUL = "\0";
const NOT_INSTALLED = "ENOENT";
const NO_BASELINE = [/not a git repository/, /bad revision 'HEAD'/, /Not a valid object name HEAD/, /exists on disk, but not in 'HEAD'/]; // git's words under C
const NO_COMMIT = "no git commit to compare it with";
const NOT_COMMITTED = "it is not committed"; // untracked, or kept out by .gitignore
const CHANGED = "it changed since HEAD";
const TREE_ENTRY = /^\S+ \S+ (\S+)\t(.*)$/s; // <mode> <type> <id>, a tab, <path>

/** The environment without git's own variables, which would point git at another repository, as a
 * commit hook's do, and with git's messages in the one language NO_BASELINE reads. */
const environment = () => ({ ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith(GIT_VARIABLE_PREFIX))), LC_ALL: "C" });

/** git's output for `args` run in the project root; null when it fails, the project keeping the
 * first failure that is no mere absence of a baseline. The paths it names are relative to that
 * root, which may lie below the repository's root. */
function git(project, args) {
  try {
    return childProcess.execFileSync("git", args, { cwd: project.root, env: environment(), encoding: "utf8", timeout: GIT_TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  } catch (error) {
    const said = error.stderr ?? "";
    if (error.code !== NOT_INSTALLED && !NO_BASELINE.some((absence) => absence.test(said))) project.gitFailure ??= said.trim().split("\n")[0] || error.message;
    return null;
  }
}

/** `file` as HEAD holds it, cleaned; null when there is no such baseline or git failed. */
function show(project, file) {
  const content = git(project, ["show", `HEAD:./${file}`]);
  return content === null ? null : clean(content);
}

/** The design system's files that differ from HEAD, read once per run; empty when git cannot say.
 * A file git does not list is unchanged, or new and without a baseline: nothing to compare.
 * `diff-index`, since `git diff` falls back to comparing two paths when it cannot use a repository,
 * so a repository git refuses would read as none. */
function changed(project) {
  project.changedFiles ??= new Set((git(project, ["diff-index", "--name-only", "--relative", "-z", "HEAD", "--", UI_DIR]) ?? "").split(NUL).filter(Boolean));
  return project.changedFiles;
}

/** A project-relative file as HEAD holds it, whether or not it changed, read once per run. */
function baseline(project, file) {
  project.committedTexts ??= new Map();
  if (!project.committedTexts.has(file)) project.committedTexts.set(file, show(project, file));
  return project.committedTexts.get(file);
}

/** A file's committed text when it changed since, else null. */
const committed = (project, file) => (changed(project).has(file) ? baseline(project, file) : null);

/** Why git cannot vouch that each of `files` holds the bytes HEAD holds, by file; a file it can,
 * comparing blob ids so a file only touched since still counts, is absent. */
function unclearedByHead(project, files) {
  const unanswered = () => new Map(files.map((file) => [file, project.gitFailure ? `git failed: ${project.gitFailure}` : NO_COMMIT]));
  const listed = git(project, ["ls-tree", "-z", "HEAD", "--", ...files]);
  if (listed === null) return unanswered();
  const atHead = new Map(listed.split(NUL).filter(Boolean).map((entry) => TREE_ENTRY.exec(entry).slice(1).reverse()));
  const held = files.filter((file) => atHead.has(file));
  const ids = held.length ? git(project, ["hash-object", "--", ...held]) : "";
  if (ids === null) return unanswered();
  const now = ids.trim().split("\n");
  const changedFiles = held.filter((file, index) => now[index] !== atHead.get(file));
  return new Map([...files.filter((file) => !atHead.has(file)).map((file) => [file, NOT_COMMITTED]), ...changedFiles.map((file) => [file, CHANGED])]);
}

module.exports = { committed, baseline, changed, unclearedByHead };
