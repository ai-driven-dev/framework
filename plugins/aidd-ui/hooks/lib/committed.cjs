// A project file as git last committed it, the baseline a validated record is held to. git is
// read through its command line; without git, a repository, a commit or the file, there is no
// baseline, and nothing is held to it. git is asked once which files changed, and for the text of
// those alone, so a run costs a call per changed file, not per element.
const childProcess = require("node:child_process");
const { clean, UI_DIR } = require("./project.cjs");

const GIT_TIMEOUT_MS = 5000;
const GIT_VARIABLE_PREFIX = "GIT_";
const NUL = "\0";

/** The environment without git's own variables, which would point git at another repository, as a
 * commit hook's do. */
const environment = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith(GIT_VARIABLE_PREFIX)));

/** git's output for `args` run in the project root; throws without git, a repository or a commit.
 * The paths it names are relative to that root, which may lie below the repository's root. */
const git = (root, args) =>
  childProcess.execFileSync("git", args, { cwd: root, env: environment(), encoding: "utf8", timeout: GIT_TIMEOUT_MS, stdio: ["ignore", "pipe", "ignore"], windowsHide: true });

/** `file` as HEAD holds it, cleaned; null when git, the repository, HEAD or the file is missing. */
function show(root, file) {
  try {
    return clean(git(root, ["show", `HEAD:./${file}`]));
  } catch {
    return null;
  }
}

/** The design system's files that differ from HEAD, read once per run; empty when git cannot say.
 * A file git does not list is unchanged, or new and without a baseline: nothing to compare. */
function changed(project) {
  if (!project.changedFiles) {
    try {
      project.changedFiles = new Set(git(project.root, ["diff", "--name-only", "--relative", "-z", "HEAD", "--", UI_DIR]).split(NUL).filter(Boolean));
    } catch {
      project.changedFiles = new Set();
    }
  }
  return project.changedFiles;
}

/** A project-relative file as HEAD holds it, whether or not it changed, read once per run. */
function baseline(project, file) {
  project.committedTexts ??= new Map();
  if (!project.committedTexts.has(file)) project.committedTexts.set(file, show(project.root, file));
  return project.committedTexts.get(file);
}

/** A file's committed text when it changed since, else null. */
const committed = (project, file) => (changed(project).has(file) ? baseline(project, file) : null);

module.exports = { committed, baseline, changed };
