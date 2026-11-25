/**
 * The module source of the two events a bridge relays before the model acts: a PreToolUse script
 * that refuses a call, and a UserPromptSubmit script that adds to the user's message.
 */

import { TOOL_INPUT_SOURCE } from "./bridge-source.js";

/** A PreToolUse script refuses the call it is told of by exiting 2: its stderr is the reason the
 * model reads. A script that fails to run, or exits any other way, refuses nothing. */
export const PRE_TOOL_USE_SOURCE = `/** Pure: a call about to run -> every PreToolUse hook whose matcher allows its tool. The host
 * hands the arguments in the output, and names the written file \`filePath\`. */
function preToolUseCallsFor(call, output, directory) {
  const tool = String(call?.tool ?? "");
  const args = output?.args;
  ${TOOL_INPUT_SOURCE}
  return PRE_TOOL_USE.filter((hook) => matchesTool(hook.matcher, tool)).map((hook) => ({
    script: hook.script,
    args: hook.args,
    payload: {
      hook_event_name: "PreToolUse",
      session_id: call?.sessionID ?? null,
      cwd: directory,
      tool_name: tool,
      tool_input: toolInput,
    },
  }));
}

/** The reason the first script that refuses gave, or null when none does. */
async function refusalOf(calls) {
  for (const call of calls) {
    const { code, stderr } = await runCapture(call.script, call.args, call.payload, call.payload.cwd);
    if (code === 2) return stderr.trim();
  }
  return null;
}`;

/** A UserPromptSubmit script's answer joins the user's message as a part of its own. A follow-up a
 * bridge sent at Stop is no prompt of the user's: it carries a mark, and is read by no script. */
export function userPromptSource(plugin: string): string {
  return `const FOLLOW_UP = { aidd: "stop-follow-up" };

function isFollowUp(parts) {
  return parts.some((part) => part?.metadata?.aidd === FOLLOW_UP.aidd);
}

/** Pure: the user's message -> every UserPromptSubmit hook's call, none for a follow-up. The text
 * is the user's own: a part another hook added is not. */
function userPromptCallsFor(input, output, directory) {
  const parts = output?.parts ?? [];
  if (isFollowUp(parts)) return [];
  const prompt = parts
    .filter((part) => part?.type === "text" && !part.synthetic)
    .map((part) => part.text)
    .join("\\n");
  return USER_PROMPT_SUBMIT.map((hook) => ({
    script: hook.script,
    args: hook.args,
    payload: {
      hook_event_name: "UserPromptSubmit",
      session_id: input?.sessionID ?? null,
      cwd: directory,
      prompt,
    },
  }));
}

/** Each answer becomes a synthetic text part after the user's, its id derived from the first
 * part's, this plugin's name and the hook's place in its list, so no two parts share one. */
async function addPromptContext(input, output, directory) {
  const calls = userPromptCallsFor(input, output, directory);
  for (const [index, call] of calls.entries()) {
    const answer = await answerOf(call.script, call.args, call.payload, directory);
    if (!answer) continue;
    output.parts.push({
      id: output.parts[0].id + "-" + ${JSON.stringify(plugin)} + "-" + index,
      messageID: output.message?.id,
      sessionID: input?.sessionID,
      type: "text",
      text: answer,
      synthetic: true,
    });
  }
}`;
}
