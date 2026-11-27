/** What a hook printed, read as Copilot reads it: progress lines are shown to the person and
 * dropped, then what is left is the answer. Other hosts print no progress line, so it is the whole output. */
function readHookOutput(stdout) {
  const progress = [];
  const kept = [];
  for (const line of stdout.split("\n")) {
    const message = progressMessage(line);
    if (message === null) kept.push(line);
    else progress.push(message);
  }
  return { progress, answer: kept.join("\n").trim() };
}

function progressMessage(line) {
  try {
    const parsed = JSON.parse(line);
    return parsed?.type === "progress" && typeof parsed.message === "string" ? parsed.message : null;
  } catch {
    return null;
  }
}

module.exports = { readHookOutput };
