/**
 * The module source of every event a bridge relays: the session's start, the tool calls before
 * and after it, the user's message and the turn's end, and `bridgeHooks`, the hooks object that
 * wires them to the host's events. Written once, so a host's template holds only the names its
 * own events carry and where its directory comes from.
 */

/** A hook's `tools` are its matcher's names, split and lowercased when the module is written:
 * the hosts name their tools in lowercase. Absent, every tool matches. */
export const MATCHES_TOOL_SOURCE = `function matchesTool(tools, tool) {
  return !tools || tools.includes(tool.toLowerCase());
}`;

/** The host names the written file `filePath`; scripts read Claude Code's `file_path`. */
const TOOL_INPUT_SOURCE =
  'const toolInput = typeof args.filePath === "string" ? { ...args, file_path: args.filePath } : args;';

/** The calls of a tool use, before and after it runs. A PreToolUse script refuses the call it is
 * told of by exiting 2: its stderr is the reason the model reads. A script that fails to run, or
 * exits any other way, is reported and refuses nothing. A PostToolUse answer joins the tool's own output. */
export const TOOL_USE_SOURCE = `${MATCHES_TOOL_SOURCE}

/** Pure: a tool call -> every hook of one event whose matcher allows its tool. */
function toolUseCallsFor(event, hooks, call, args, directory) {
  const tool = call.tool;
  ${TOOL_INPUT_SOURCE}
  return hooks.filter((hook) => matchesTool(hook.tools, tool)).map((hook) => ({
    script: hook.script,
    args: hook.args,
    payload: {
      hook_event_name: event,
      session_id: call.sessionID,
      cwd: directory,
      tool_name: tool,
      tool_input: toolInput,
    },
  }));
}

/** A call about to run: the host hands the arguments in the output, not in the call. */
function preToolUseCallsFor(call, output, directory) {
  return toolUseCallsFor("PreToolUse", PRE_TOOL_USE, call, output.args, directory);
}

/** A call that ran. */
function postToolUseCallsFor(call, directory) {
  return toolUseCallsFor("PostToolUse", POST_TOOL_USE, call, call.args, directory);
}

/** The reason the first script that refuses gave, or null when none does. */
async function refusalOf(calls) {
  for (const call of calls) {
    const run = await settledRun(call.script, call.args, call.payload, call.payload.cwd);
    if (run?.code === 2) return run.stderr.trim();
  }
  return null;
}

/** The refusal is thrown out of the host's hook, the one way it stops the call. */
async function refuseToolUse(call, output, directory) {
  const refusal = await refusalOf(preToolUseCallsFor(call, output, directory));
  if (refusal !== null) throw new Error(refusal);
}

/** Each PostToolUse answer is appended to the output the model reads, its message for the person
 * handed to \`show\` where the host has one. An answer the script marks required is also queued as
 * the session's next prompt, which the model takes up after the current step; not awaited, so the
 * host's prompt call never holds the tool. A client with no \`promptAsync\` queues nothing: the
 * answer is appended alone. */
async function addToolAnswers(call, output, directory, client, show) {
  try {
    for (const hook of postToolUseCallsFor(call, directory)) {
      const { text, person, required } = await answerOf(hook.script, hook.args, hook.payload, directory);
      show?.(person);
      if (!text) continue;
      output.output = output.output + "\\n\\n" + text;
      if (required && typeof client.session.promptAsync === "function") sendPrompt(client, "promptAsync", call.sessionID, text, FINDING, hook.script, "finding not queued: ");
    }
  } catch (error) {
    reportHookFailure("PostToolUse", error);
  }
}`;

/** A UserPromptSubmit script's answer joins the user's message as a part of its own. A prompt a
 * bridge sent itself is no prompt of the user's: it carries a mark, and is read by no script. */
export function userPromptSource(plugin: string): string {
  return `/** Pure: the user's message -> every UserPromptSubmit hook's call, none for a prompt a bridge
 * sent. The text is the user's own: a part another hook added is not. */
function userPromptCallsFor(input, output, directory) {
  const parts = output.parts;
  if (isBridgePrompt(parts)) return [];
  const prompt = parts
    .filter((part) => part.type === "text" && !part.synthetic)
    .map((part) => part.text)
    .join("\\n");
  return USER_PROMPT_SUBMIT.map((hook) => ({
    script: hook.script,
    args: hook.args,
    payload: {
      hook_event_name: "UserPromptSubmit",
      session_id: input.sessionID,
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
    const { text } = await answerOf(call.script, call.args, call.payload, directory);
    if (!text) continue;
    output.parts.push({
      id: output.parts[0].id + "-" + ${JSON.stringify(plugin)} + "-" + index,
      messageID: output.message.id,
      sessionID: input.sessionID,
      type: "text",
      text,
      synthetic: true,
    });
  }
}`;
}

/** SessionStart runs once per session, on its first event; the map is module-level because the host
 * re-creates the plugin. A child session (it names a parent) runs neither SessionStart nor Stop.
 *
 * Limit: a SessionStart exit 2 lands in the system prompt; a session's entry is never cleared. */
export const SESSION_START_SOURCE = `const sessions = new Map();
const childSessions = new Set();

function runSessionStart(event, fallbackDirectory) {
  const named = event.properties.sessionID;
  if (typeof named !== "string" || sessions.has(named) || childSessions.has(named)) return;
  if (typeof event.properties.info?.parentID === "string") {
    childSessions.add(named);
    return;
  }
  const directory = event.properties.info?.directory ?? fallbackDirectory;
  const answers = SESSION_START.map((hook) =>
    answerOf(hook.script, hook.args, { hook_event_name: "SessionStart", session_id: named, cwd: directory }, directory)
  );
  const joined = (texts) => texts.filter(Boolean).join("\\n\\n");
  sessions.set(named, {
    directory,
    started: Promise.all(answers).then((all) => ({
      context: joined(all.map((answer) => answer.text)),
      person: joined(all.map((answer) => answer.person)),
    })),
  });
}

/** The folder a session's hooks run in. */
function sessionDirectory(sessionId, fallbackDirectory) {
  return sessions.get(sessionId)?.directory ?? fallbackDirectory;
}

/** What SessionStart answered, added to the system prompt of the session's turn; its message for
 * the person handed to \`show\` once, where the host has one. */
async function addSessionContext(input, output, show) {
  const started = await sessions.get(input.sessionID)?.started;
  if (started === undefined) return;
  if (started.context) output.system.push(started.context);
  const person = started.person;
  started.person = "";
  show?.(person);
}`;

/** A Stop follow-up is told apart by its mark, never cleared: two plugins' follow-ups idle the host
 * between their turns.
 *
 * Limit: one Stop hook per plugin blocks; the ones after it are told the turn continues. */
export const TURN_END_SOURCE = `const continuedTurns = new Set();

/** An idle session's Stop calls; \`runStop\` adds \`stop_hook_active\` to each payload. */
function stopCallsFor(sessionId, directory) {
  return STOP.map((hook) => ({
    script: hook.script,
    args: hook.args,
    payload: { hook_event_name: "Stop", session_id: sessionId, cwd: directory },
  }));
}

function noteTurn(sessionId, parts) {
  if (!isFollowUp(parts)) continuedTurns.delete(sessionId);
}

function isFollowUp(parts) {
  return parts.some((part) => part.metadata?.aidd === FOLLOW_UP.aidd);
}

/** Returns the follow-ups still in flight: the prompt is the session's next turn, and the turn end
 * must not hold it. */
function runStop(sessionId, directory, { client, method, show }) {
  const sends = [];
  for (const call of stopCallsFor(sessionId, directory)) {
    const payload = { ...call.payload, stop_hook_active: continuedTurns.has(sessionId) };
    const { reason, person } = stopReasonOf(call.script, call.args, payload, directory);
    show?.(person);
    if (!reason) continue;
    continuedTurns.add(sessionId);
    sends.push(sendPrompt(client, method, sessionId, reason, FOLLOW_UP, call.script, "follow-up not delivered: "));
  }
  return sends;
}`;

/** The hooks every bridge hands its host, over the host's own client.
 *
 * Limit: a hook throws only on input no capture shows (a message with no part).
 * Limit: every idle is a turn end. */
export const BRIDGE_HOOKS_SOURCE = `function bridgeHooks({ directory, client, followUp, show, track }) {
  const folderOf = (sessionId) => sessionDirectory(sessionId, directory);
  return {
    event: async ({ event }) => {
      runSessionStart(event, directory);
      const sessionId = event.properties.sessionID;
      if (typeof sessionId !== "string" || event.type !== "session.idle" || childSessions.has(sessionId)) return;
      const sends = runStop(sessionId, folderOf(sessionId), { client, method: followUp, show });
      track?.(Promise.all(sends));
    },
    "experimental.chat.system.transform": (input, output) => addSessionContext(input, output, show),
    "chat.message": async (input, output) => {
      noteTurn(input.sessionID, output.parts);
      await addPromptContext(input, output, folderOf(input.sessionID));
    },
    "tool.execute.before": (call, output) => refuseToolUse(call, output, folderOf(call.sessionID)),
    "tool.execute.after": (call, output) =>
      addToolAnswers(call, output, folderOf(call.sessionID), client, show),
  };
}`;
