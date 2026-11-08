// What `node aidd-ui.cjs help <command>` prints: each command's usage, effects, output and exit codes, written once.
const ROOT_FLAG = "--root";
const FORCE_FLAG = "--force";
const TASK_FLAG = "--task";
const CHANGE_FLAG = "--change";
const BREAKING_FLAG = "--breaking";
const CREATED_FLAG = "--created";
const REMOVED_FLAG = "--removed";

const VALIDATE_USAGE = "node aidd-ui.cjs validate [project-root]";
const TOKENS_USAGE = "node aidd-ui.cjs tokens [project-root]";
const HOOK_USAGE = "node aidd-ui.cjs hook < <host event>";
const IMPACT_USAGE = `node aidd-ui.cjs impact <id or token>… [${ROOT_FLAG} <dir>]`;
const EXTRACT_USAGE = `node aidd-ui.cjs extract [${FORCE_FLAG}] [${ROOT_FLAG} <dir>]`;
const BUMP_USAGE = `node aidd-ui.cjs bump ${TASK_FLAG} <aidd_docs/tasks/…> (${CHANGE_FLAG} "<text>" [${BREAKING_FLAG}] | ${CREATED_FLAG} | ${REMOVED_FLAG}) <token or id>… [${ROOT_FLAG} <dir>]`;
const PUBLISH_USAGE = `node aidd-ui.cjs publish ([${BREAKING_FLAG}] | <id>…) [${ROOT_FLAG} <dir>]`;
const HELP_USAGE = "node aidd-ui.cjs help [<command>]";

const COUNT_LINE = "aidd-ui: <n> errors, <m> warnings";
const ERROR_LINE = '<file>[:<line>] <rule> ["<excerpt>"] => <fix>';
const WARNING_LINE = "<file>[:<line>] <rule> warning <message> => <fix>";
const GROUPED_LINE = '<rule> ×<count> in <file>|<folder>/* ["<excerpt>"] => <fix>';

const REFUSED = "2 a request refused with a message, nothing written.";

/** One entry per command: `summary` for the list, then `usage` lines, `effects`, `output` and `exits`. */
const HELP = {
  validate: {
    summary: "Check the design system and print its problems.",
    usage: [VALIDATE_USAGE],
    effects: ["Reads the design system and writes nothing."],
    output: [
      "Prints VALID when nothing is wrong.",
      "Otherwise prints a line counting errors, then warnings:",
      COUNT_LINE,
      "Then one line per error:",
      ERROR_LINE,
      "Then one line per warning:",
      WARNING_LINE,
      "The fix names the engine command when the engine owns the write.",
    ],
    exits: ["0 no error, a warning allowed.", "1 at least one error."],
  },
  tokens: {
    summary: "Write the stylesheet from the tokens.",
    usage: [TOKENS_USAGE],
    effects: ["Writes `aidd_docs/ui/tokens.css`.", "Writes the resolver when needed."],
    output: ["Prints the path of `tokens.css`.", "When blocked, prints the problems as `help validate` shows."],
    exits: ["0 the stylesheet is written.", "1 blocked, naming what blocks it."],
  },
  hook: {
    summary: "Answer a host event with the problems it caused.",
    usage: [HOOK_USAGE],
    effects: ["Reads a host event on standard input.", "Writes nothing in the project."],
    output: [
      "Prints problems as `help validate` shows, and grouped errors:",
      GROUPED_LINE,
      "A grouped line joins errors of one rule, fix and folder.",
      "It names the file when all are in it.",
      "The hook prints at most ten warnings.",
      "After a write, it prints problems on the lines it changed.",
      "Once per turn, it prints errors left new in other files, grouped.",
      "New means absent at the session's start or the last turn's end.",
      "At the turn's end, it asks once for new errors.",
      "It asks only for those on lines the turn changed.",
      "It never asks for a warning, or an error with no line.",
    ],
    exits: ["0 always."],
  },
  impact: {
    summary: "List what a token or element reaches.",
    usage: [IMPACT_USAGE],
    effects: ["Reads the design system and writes nothing.", "Takes a token as its path or its CSS name."],
    output: ["Prints JSON: tokens, same-value, elements, screens, wireframes, journeys, renders, code."],
    exits: ["0 the report is printed.", "2 an unknown ref, or a wrong usage."],
  },
  extract: {
    summary: "Write the tokens from the code the system names.",
    usage: [EXTRACT_USAGE],
    effects: ["Writes `tokens.json` and the context files from the `code-tokens` files.", "Refuses when `tokens.json` exists without `--force`."],
    output: ["Prints JSON `written` and `left`."],
    exits: ["0 the files are written.", REFUSED],
  },
  bump: {
    summary: "Raise the versions a change reaches, or start a history.",
    usage: [BUMP_USAGE],
    effects: [
      "`--task` names a folder under `aidd_docs/tasks/`, never written.",
      "`--change` raises the versions the refs reach.",
      "It sets each element reached back to `proposed`.",
      "It writes its `history.md` row.",
      "It adds a `pending` row per state.",
      "The row goes to the `## Verdicts` of each reached screen's review.",
      "`--created` writes the first `history.md` row of each ref.",
      "`--created system` also writes `aidd_docs/ui/code-debt.json`.",
      "`--removed` writes a breaking `removed` row one version above the last.",
      "`--removed` refuses an id without rows, and `system`.",
    ],
    output: ["Prints JSON `changed`.", "With `--change`, it also prints `left`: the elements reached and not raised."],
    exits: ["0 the rows are written.", REFUSED],
  },
  publish: {
    summary: "Publish the system, or validate elements.",
    usage: [PUBLISH_USAGE],
    effects: [
      "Without ids, it appends the `system` row to `history.md`.",
      "Its Task lists every unpublished task with an element row, sorted.",
      "The version is major when one of them broke an element.",
      "The version is also major with `--breaking` for tokens alone.",
      "Otherwise the version is minor.",
      "With ids, it sets each element `validated`.",
      "It writes its fingerprint in its version's `history.md` row.",
      "It refuses a deprecated id, or one that is no element.",
      "It refuses an id with no row at its version.",
      "It refuses an id whose row holds a fingerprint.",
      "A change of a validated element goes through `bump`.",
    ],
    output: ["Without ids, prints JSON `version` and `tasks`.", "With ids, prints JSON `validated`: each `id`, `version`, `fingerprint`.", "Refuses when no task is unpublished."],
    exits: ["0 the rows are written.", REFUSED],
  },
  help: {
    summary: "Print a command's usage, effects, output and exit codes.",
    usage: [HELP_USAGE],
    effects: ["Writes nothing."],
    output: ["Without a command, prints the list of commands."],
    exits: ["0 the help is printed.", "2 an unknown command, the list on standard error."],
  },
};

/** One line per command, for the list. */
const commandList = () => Object.entries(HELP).map(([name, { summary }]) => `${name}: ${summary}`).join("\n");

/** The help of `name` as printed. */
function helpText(name) {
  const { usage, effects, output, exits } = HELP[name];
  const bullets = (list) => list.map((line) => `- ${line}`).join("\n");
  return [`usage: ${usage.join("\n       ")}`, `Effects:\n${bullets(effects)}`, `Output:\n${bullets(output)}`, `Exit codes:\n${bullets(exits)}`].join("\n\n");
}

module.exports = {
  HELP,
  commandList,
  helpText,
  ROOT_FLAG,
  FORCE_FLAG,
  TASK_FLAG,
  CHANGE_FLAG,
  BREAKING_FLAG,
  CREATED_FLAG,
  REMOVED_FLAG,
  IMPACT_USAGE,
  EXTRACT_USAGE,
  BUMP_USAGE,
  PUBLISH_USAGE,
};
