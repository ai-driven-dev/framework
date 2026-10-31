// A project file as git last committed it, the baseline a validated record is held to. git is
// read through its command line; without git, a repository, a commit or the file, there is no
// baseline, and nothing is held to it.
const { execFileSync } = require("node:child_process");
const { clean } = require("./project.cjs");

const GIT_TIMEOUT_MS = 5000;
const GIT_VARIABLE_PREFIX = "GIT_";

/** The environment without git's own variables, which would point git at another repository, as a
 * commit hook's do. */
const environment = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith(GIT_VARIABLE_PREFIX)));

/** `file` as HEAD holds it, cleaned; null when git, the repository, HEAD or the file is missing.
 * The path is relative to the project root, which may lie below the repository's root. */
function show(root, file) {
  try {
    return clean(execFileSync("git", ["show", `HEAD:./${file}`], { cwd: root, env: environment(), encoding: "utf8", timeout: GIT_TIMEOUT_MS, stdio: ["ignore", "pipe", "ignore"], windowsHide: true }));
  } catch {
    return null;
  }
}

/** A project-relative file's committed text, read once per run. */
function committed(project, file) {
  project.committedTexts ??= new Map();
  if (!project.committedTexts.has(file)) project.committedTexts.set(file, show(project.root, file));
  return project.committedTexts.get(file);
}

module.exports = { committed };
