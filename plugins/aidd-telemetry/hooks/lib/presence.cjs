// Both variables are undocumented, so the block needs both to agree that a person is at the
// keyboard, on a surface seen to show the person a block's reason. Anything else, a missing
// variable or a surface never seen included, is "not present": a change in Claude can only stop
// the asking, never block work wrongly. The VS Code extension sets no ATTENDED and shows no
// reason, so it is never asked.
const SHOWS_A_BLOCK = new Set(["cli", "claude-desktop"]);

function personIsPresent(env = process.env) {
  return env.CLAUDE_CODE_SESSION_ATTENDED === "1" && SHOWS_A_BLOCK.has(env.CLAUDE_CODE_ENTRYPOINT);
}

module.exports = { personIsPresent };
