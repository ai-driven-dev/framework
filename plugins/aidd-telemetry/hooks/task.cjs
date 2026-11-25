// Sync SessionStart: tells the person, once, that the working branch has no task. Never blocks, never reaches the model.
const { guardedContext } = require("./lib/context.cjs");
const { branchDeclaration, headOf } = require("./lib/git.cjs");
const { answer, readEvent } = require("./lib/host.cjs");

/** The working branch of `cwd` when no declaration was made on it, else null. */
function undeclaredBranch(cwd) {
  const { branch, role } = headOf(cwd, process.env);
  return role === "working" && branchDeclaration(cwd, branch, process.env) === null ? branch : null;
}

function remind() {
  const event = readEvent();
  if (event?.event !== "SessionStart") return;
  const context = guardedContext(event.raw);
  if (context === null) return;
  const branch = undeclaredBranch(context.cwd);
  if (branch === null) return;
  answer({ level: 1, person: `Telemetry: no task on ${branch}. aidd telemetry task <name> [--ticket <ref>] when you want.` });
}

const COMMANDS = { remind };

try {
  COMMANDS[process.argv[2]]?.();
} catch {
  // a reminder never fails a session
}
process.exitCode = 0;
