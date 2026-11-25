/**
 * The module source of the events a bridge relays around the model's own acts: the session's
 * start, the tool calls before and after it, and the user's message. Written once, so a host's
 * template holds only the names its own events carry and where its directory comes from.
 */

import { MATCHES_TOOL_SOURCE, TOOL_INPUT_SOURCE } from "./bridge-source.js";

/** The calls of a tool use, before and after it runs. A PreToolUse script refuses the call it is
 * told of by exiting 2: its stderr is the reason the model reads. A script that fails to run, or
 * exits any other way, refuses nothing. A PostToolUse answer joins the tool's own output. */
export const TOOL_USE_SOURCE = `${MATCHES_TOOL_SOURCE}

/** Pure: a tool call -> every hook of one event whose matcher allows its tool. The host names the
 * written file \`filePath\`; the scripts read Claude Code's \`file_path\`. */
function toolUseCallsFor(event, hooks, call, args, directory) {
  const tool = String(call?.tool ?? "");
  ${TOOL_INPUT_SOURCE}
  return hooks.filter((hook) => matchesTool(hook.matcher, tool)).map((hook) => ({
    script: hook.script,
    args: hook.args,
    payload: {
      hook_event_name: event,
      session_id: call?.sessionID ?? null,
      cwd: directory,
      tool_name: tool,
      tool_input: toolInput,
    },
  }));
}

/** A call about to run: the host hands the arguments in the output, not in the call. */
function preToolUseCallsFor(call, output, directory) {
  return toolUseCallsFor("PreToolUse", PRE_TOOL_USE, call, output?.args, directory);
}

/** A call that ran. */
function postToolUseCallsFor(call, directory) {
  return toolUseCallsFor("PostToolUse", POST_TOOL_USE, call, call?.args, directory);
}

/** The reason the first script that refuses gave, or null when none does. */
async function refusalOf(calls) {
  for (const call of calls) {
    const { code, stderr } = await runCapture(call.script, call.args, call.payload, call.payload.cwd);
    if (code === 2) return stderr.trim();
  }
  return null;
}

/** The refusal is thrown out of the host's hook, the one way it stops the call. */
async function refuseToolUse(call, output, directory) {
  let refusal = null;
  try {
    refusal = await refusalOf(preToolUseCallsFor(call, output, directory));
  } catch (error) {
    reportHookFailure("PreToolUse", error);
  }
  if (refusal !== null) throw new Error(refusal);
}

/** Each PostToolUse answer is appended to the output the model reads, a failure reported. */
async function addToolAnswers(call, output, directory) {
  try {
    for (const hook of postToolUseCallsFor(call, directory)) {
      const answer = await answerOf(hook.script, hook.args, hook.payload, directory);
      if (answer) output.output = (output.output ?? "") + "\\n\\n" + answer;
    }
  } catch (error) {
    reportHookFailure("PostToolUse", error);
  }
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
  try {
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
  } catch (error) {
    reportHookFailure("UserPromptSubmit", error);
  }
}`;
}

/** SessionStart runs on the first event that names a session, so the script knows its session.
 * That event is `session.created` for a new session; a continued one is created no more, and its
 * first event is another. A new session's first event names its folder under info; a continued
 * one's names none. The set is module-level: the host creates the plugin again, and a fresh set
 * would run it again.
 *
 * Limit: `session.deleted` clears a session's entry through `properties.sessionID`, a shape no
 * captured payload shows for either host; were it named otherwise, the entry would only stay in
 * memory, session ids being unique. */
export const SESSION_START_SOURCE = `const started = new Set();

function runSessionStart(event, fallbackDirectory) {
  const named = event?.properties?.sessionID;
  if (typeof named !== "string") return;
  if (event.type === "session.deleted") {
    started.delete(named);
    return;
  }
  if (started.has(named)) return;
  started.add(named);
  const directory = event.properties.info?.directory ?? fallbackDirectory;
  for (const hook of SESSION_START) {
    runHook(hook.script, hook.args, { hook_event_name: "SessionStart", session_id: named, cwd: directory }, directory);
  }
}`;
