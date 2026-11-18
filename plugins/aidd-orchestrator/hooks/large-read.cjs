const { createReadStream, readFileSync, statSync } = require("node:fs");
const { extname, isAbsolute, resolve } = require("node:path");

// Claude reads these as images or documents, not as line-oriented text.
const NON_TEXT_READ_FORMATS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf"]);

// Other hosts also receive translated plugin hooks. A nested host can inherit Claude's
// environment, so require both its session id and its own transcript path to match.
function isClaudeSession(input) {
  const id = input.session_id;
  const transcript = input.transcript_path;
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id === process.env.CLAUDE_CODE_SESSION_ID &&
    typeof transcript === "string" &&
    /(?:^|\/)projects\/.+\.jsonl$/u.test(transcript.replace(/\\/gu, "/"))
  );
}

// Read only until a line beyond the limit is found. CRLF is one line ending,
// including when its two bytes fall into separate stream chunks.
async function exceedsLineLimit(path, limit) {
  let lines = 0;
  let previousCR = false;
  for await (const chunk of createReadStream(path)) {
    for (const byte of chunk) {
      if (byte === 13) {
        lines += 1;
        previousCR = true;
      } else if (byte === 10) {
        if (!previousCR) lines += 1;
        previousCR = false;
      } else {
        if (lines >= limit) return true;
        previousCR = false;
      }
      if (lines > limit) return true;
    }
  }
  return false;
}

async function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    // Cursor treats invalid or empty hook output as a block; failed hooks proceed.
    process.exitCode = 1;
    return;
  }
  // Cursor translates this event from the plugin manifest. It requires a response,
  // even when the Claude-only guard is switched off or Claude is its parent process.
  if (input?.hook_event_name === "preToolUse") {
    process.stdout.write('{"permission":"allow"}\n');
    return;
  }

  const configured = process.env.AIDD_ORCHESTRATOR_MAX_READ_LINES;
  if (!configured || !/^[1-9]\d*$/u.test(configured)) return;
  const limit = Number(configured);
  if (!Number.isSafeInteger(limit)) return;
  if (!input || typeof input !== "object" || !isClaudeSession(input)) return;
  if (input.tool_name !== "Read" || (typeof input.agent_id === "string" && input.agent_id)) return;
  const path = input.tool_input?.file_path;
  if (typeof path !== "string" || !path) return;
  const cwd = typeof input.cwd === "string" ? input.cwd : process.cwd();
  const target = isAbsolute(path) ? path : resolve(cwd, path);
  if (NON_TEXT_READ_FORMATS.has(extname(target).toLowerCase())) return;

  try {
    if (!statSync(target).isFile() || !(await exceedsLineLimit(target, limit))) return;
  } catch {
    // Let Read report missing or inaccessible files and handle unsupported paths itself.
    return;
  }

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `This file exceeds the configured ${limit}-line limit. Partial Read calls are also blocked; do not retry Read. Delegate a focused question to the aidd-orchestrator explorer subagent and use its summary and citations.`,
      },
    })}\n`
  );
}

main().catch(() => {});
