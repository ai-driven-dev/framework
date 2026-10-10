// Both variables are undocumented, so the block needs both to agree that a person is at the
// keyboard. Anything else, a missing variable included, is "not present": a change in Claude
// can only stop the asking, never block work wrongly.
function personIsPresent(env = process.env) {
  if (env.CLAUDE_CODE_SESSION_ATTENDED !== "1") return false;
  const entrypoint = env.CLAUDE_CODE_ENTRYPOINT;
  return typeof entrypoint === "string" && entrypoint !== "" && !entrypoint.startsWith("sdk");
}

module.exports = { personIsPresent };
