// What `node aidd-ui.cjs help <command>` prints: each command's usage, effects, output and exit codes, written once.
const { VALIDATE_USAGE, TOKENS_USAGE, HOOK_USAGE, IMPACT_USAGE, EXTRACT_USAGE, BUMP_USAGE, PUBLISH_USAGE, KEEP_USAGE, SHOWCASE_USAGE, HELP_USAGE } = require("./cli.cjs");

const COUNT_LINE = "aidd-ui: <n> error(s), <m> warning(s)";
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
      "It prints every problem, ungrouped.",
      "C4, C6 and C10 are about the code, not the design system.",
    ],
    exits: ["0 no error, a warning allowed.", "1 at least one error.", REFUSED],
  },
  tokens: {
    summary: "Write the stylesheet from the tokens.",
    usage: [TOKENS_USAGE],
    effects: ["Writes `aidd_docs/ui/tokens.css`.", "Writes the resolver when needed."],
    output: ["Prints the path of `tokens.css`.", "When blocked, prints the problems as `help validate` shows."],
    exits: ["0 the stylesheet is written.", "1 blocked, naming what blocks it.", REFUSED],
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
    exits: ["0 the report is printed.", "2 an unknown ref, no design system, or a wrong usage."],
  },
  extract: {
    summary: "Write the tokens from the code the system names.",
    usage: [EXTRACT_USAGE],
    effects: ["Writes `tokens.json`, `tokens.resolver.json` and the context files from the `code-tokens` files.", "Refuses when `tokens.json` exists without `--force`.", "Refuses when it cannot: no `system.md`, no `code-tokens`, or an unreadable file."],
    output: ["Prints JSON `written` and `left`: what it did not write."],
    exits: ["0 the files are written.", REFUSED],
  },
  bump: {
    summary: "Raise the versions a change reaches, or start a history.",
    usage: [BUMP_USAGE],
    effects: [
      "`--task` names a folder under `aidd_docs/tasks/`, never written.",
      "`--task` need not exist: `history.md` rows only cite it.",
      "`--change` raises the versions the refs reach.",
      "It sets each element reached back to `proposed`.",
      "It writes its `history.md` row.",
      "It adds a `pending` row per state.",
      "The row goes to the `## Verdicts` of each reached screen's review.",
      "`--created` writes the first `history.md` row of each ref.",
      "`--created` refuses an id that already has rows.",
      "`--created system` writes 1, and 1.0.0 the first time.",
      "`--created system` also writes `aidd_docs/ui/code-debt.json`.",
      "`--change` raises `brand` or `system` only when named.",
      "`--removed` writes a breaking `removed` row one version above the last.",
      "`--removed` refuses an id without rows, and `system`.",
    ],
    output: ["Prints JSON `changed`.", "With `--change`, it also prints `left`: each record reached and not raised.", "Each `left` holds an `id` and its `why`: deprecated, or already raised."],
    exits: ["0 the rows are written.", REFUSED],
  },
  publish: {
    summary: "Publish the system, or validate elements.",
    usage: [PUBLISH_USAGE],
    effects: [
      "Without ids, it appends the `system` row to `history.md`.",
      "Its Task lists every unpublished task, sorted.",
      "A task counts with any row that is no publication.",
      "The version is major when one of them broke an element.",
      "The version is also major with `--breaking` for tokens alone.",
      "Otherwise the version is minor.",
      "With ids, it sets each element `validated`.",
      "It needs an `ok` verdict for each state at the current version.",
      "A `revise` or `pending` verdict does not count.",
      "A screen whose `code` link is at its version also needs captures.",
      "A capture is `screens/<id>.<state>@<version>.png`, beside the record.",
      "It writes its fingerprint in its version's `history.md` row.",
      "It refuses a deprecated id, or one that is no element.",
      "`brand` and `system` count as elements here.",
      "It refuses an id with no row at its version.",
      "It refuses an id whose row holds a fingerprint.",
      "Without ids, it refuses when no task is unpublished.",
      "A change of a validated element goes through `bump`.",
    ],
    output: ["Without ids, prints JSON `version` and `tasks`.", "With ids, prints JSON `validated`: each `id`, `version`, `fingerprint`."],
    exits: ["0 the rows are written.", REFUSED],
  },
  keep: {
    summary: "Make one variant of a set the design system's own.",
    usage: [KEEP_USAGE],
    effects: [
      "Checks the set as `showcase` does.",
      "Copies the variant's folder into `aidd_docs/ui/`, replacing files.",
      "It leaves out the variant's `preview.html`.",
      "Then it deletes the set's folder.",
      "Refuses a set with problems, or an unknown variant.",
      "A replaced record keeps its `version`; raise it with `bump`.",
    ],
    output: ["Prints JSON `kept` and `written`: the files copied."],
    exits: ["0 the variant is kept.", REFUSED],
  },
  showcase: {
    summary: "Write a static page for each record, to look at and review.",
    usage: [SHOWCASE_USAGE],
    effects: [
      "Writes `aidd_docs/ui/showcase/`, replacing it whole.",
      "It writes `index.html`, one page per record, and a `.gitignore` of `*`.",
      "A set lives in `aidd_docs/ui/drafts/<set>/`, which validation skips.",
      "Its `variants.md` holds a table: `Variant`, `Intent`, then one column per axis.",
      "`Round` and `Parent` are optional columns, never axes.",
      "A round is 1 by default.",
      "A parent is a variant of an earlier round.",
      "The page folds earlier rounds and marks changed cells.",
      "Each variant has a folder there, mirroring `aidd_docs/ui/`.",
      "A `preview.html` in a variant's folder is never kept.",
      "Two hex colours in a palette axis dress the project's wireframes.",
      "They read as background, text, then accent.",
      "A sans-serif, serif or monospace in another axis sets the font.",
      "Without them, the variant shows its `preview.html`.",
      "Each set gets a page, `_set-<set>.html`, to choose from.",
      "A set with problems shows them on its page, not its variants.",
      "It writes `drafts/.gitignore` when drafts exist.",
      "The review is remembered across reloads, until the set changes.",
      "The person pastes the copy of the review in the chat.",
      "Each page holds the records it uses and those that use it.",
      "A record with states and a render holds a review.",
      "A coded screen shows its captures beside each render.",
      "The pages need no server and no network.",
      "`--lang` picks `en` or `fr`, `en` by default.",
    ],
    output: [
      "Prints JSON `page`, `pages` and `lang`, then each set's problems.",
      "The copy of a set is JSON inside a json code fence.",
      'It reads {"set": "<set>", "variants": [<entry>…]}.',
      'An entry is {"name", "verdict", "comment"}.',
      'A verdict is "keep", "revise", "discard", or null if undecided.',
      "A comment is trimmed.",
      "Entries follow the order of `variants.md`.",
      'The person may pick an axis of a variant: "picks": {"<axis>": "<variant>"}.',
      "`picks` is absent when nothing is picked.",
      "With records too, the copy is a list of both.",
      "A set's problems print as `help validate` shows them.",
      "D1 fewer than two variants.",
      "D2 a variant with no intent.",
      "D3 no axis column, or an empty axis cell.",
      "D4 two variants alike on every axis.",
      "D5 a variant with no folder, or an empty one.",
    ],
    exits: ["0 the pages are written.", "1 a set has problems: every page is written.", "2 an unknown argument, or a request refused, nothing written."],
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

module.exports = { HELP, COUNT_LINE, ERROR_LINE, WARNING_LINE, GROUPED_LINE, commandList, helpText };
