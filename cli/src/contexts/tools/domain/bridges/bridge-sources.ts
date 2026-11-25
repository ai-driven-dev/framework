/**
 * The source text a generated event bridge is written from: the spawn, stdin, tool-input,
 * stop-reason, appended-answer and prompt-sending snippets every host's module shares.
 */

function padded(lines: readonly string[], indent: number): string {
  return lines.map((line) => " ".repeat(indent) + line).join("\n");
}

/** Spawns one hook script under node from the plugin's scripts folder, in the payload's directory. */
export function spawnHookSource(indent: number, stdio: string): string {
  return padded(
    [
      'const child = spawn("node", [HOOKS_DIR + script, ...args], {',
      "  cwd: directory,",
      `  stdio: ${stdio},`,
      "  timeout: 5000,",
      "});",
    ],
    indent
  );
}

/** Hands the payload to the script's stdin; a script that never reads it must not throw. */
export function feedStdinSource(indent: number): string {
  return padded(
    ['child.stdin.on("error", () => {});', "child.stdin.end(JSON.stringify(payload));"],
    indent
  );
}

/** The hosts name the written file `filePath`; the scripts read Claude Code's `file_path`. */
export const TOOL_INPUT_SOURCE =
  'const toolInput = typeof args?.filePath === "string" ? { ...args, file_path: args.filePath } : args;';

/** A Stop script's `{"decision":"block","reason"}`: the reason to keep working on, else nothing. */
export const STOP_REASON_SOURCE =
  'output?.decision === "block" ? String(output.reason ?? "").trim() : ""';

/** A PostToolUse answer joins the tool's own output. */
// Written as a split literal to avoid biome's noTemplateCurlyInString warning.
export const APPEND_ANSWER_SOURCE = `if (answer) output.output = \`$${"{"}output.output ?? ""}\\n\\n$${"{"}answer}\`;`;

/** What differs between two sends of a prompt: the generated expressions naming the client, the
 * session and the text, and the host's call and mark. */
export interface SendPrompt {
  readonly client: string;
  readonly method: string;
  readonly session: string;
  readonly text: string;
  readonly mark?: string;
  readonly failure?: string;
}

/** Sends a prompt as the session's next turn through the host's client. `method` is the host's
 * call, awaitable or not; `mark` is the host's metadata for a prompt the bridge sent itself. With
 * `failure`, a refusal is reported under that prefix, never thrown. One owner, so a Stop follow-up
 * and a queued finding are sent the same way. */
export function sendPromptSource(
  indent: number,
  { client, method, session, text, mark, failure }: SendPrompt
): string {
  const meta = mark === undefined ? "" : `, metadata: ${mark}`;
  const lines = [
    `${client}.session.${method}({ path: { id: ${session} }, body: { parts: [{ type: "text", text: ${text}${meta} }] } })`,
  ];
  if (failure !== undefined) {
    lines.push(
      `  .catch((error) => reportHookFailure(hook.script, ${JSON.stringify(failure)} + String(error)));`
    );
  }
  return padded(lines, indent);
}

/** A required PostToolUse answer queued as the session's next prompt, which the model takes up
 * after the current step. Not awaited, so the host's prompt call never holds the tool. */
export function queueRequiredSource(
  indent: number,
  target: { client: string; session: string; mark?: string }
): string {
  const send = sendPromptSource(indent + 2, {
    ...target,
    method: "promptAsync",
    text: "answer",
    failure: "finding not queued: ",
  });
  return [padded(["if (required) {"], indent), send, padded(["}"], indent)].join("\n");
}
