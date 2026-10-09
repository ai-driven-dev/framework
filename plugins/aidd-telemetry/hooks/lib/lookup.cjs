const { readCarries, readDeclarations, resolveBinding, resolveSession } = require("./binding.cjs");
const { branchDeclaration, headOf } = require("./git.cjs");

/** Whether the work is bound, and on which kind of branch. The session's own files answer
 * first, git is asked only when they do not, and a branch is read only when it is a working
 * branch. `role` is null when git was never consulted. */
function lookup({ cwd, sessionId, at, dir, env }) {
  const facts = {
    sessionId,
    at,
    declarations: readDeclarations(dir),
    carries: readCarries(dir),
    branch: null,
  };
  const session = resolveSession(facts);
  if (session !== null) return { binding: session, role: null, branch: null };
  const head = headOf(cwd, env);
  const declared = head.role === "working" ? branchDeclaration(cwd, head.branch, env) : null;
  return { binding: resolveBinding({ ...facts, branch: declared }), role: head.role, branch: head.branch };
}

module.exports = { lookup };
