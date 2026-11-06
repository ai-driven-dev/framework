const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, PATHS, HOOKS, LIB, ENGINE, makeTmp, removeTmp, lines, validate, writeProject, edit, editTokens, propose } = require("../fixtures/aidd-ui/project.js");

// The entries are scripts a user's machine runs, so each is driven as a subprocess with its
// argument or its hook payload on stdin, which is what ships.
const { problemsOf, findingOf } = require(ENGINE);
const { formatFindings } = require(path.join(LIB, "common-rules.cjs"));
const { load } = require(path.join(LIB, "project.cjs"));
const { HEADER } = require(path.join(LIB, "css.cjs"));

const { BRAND, BUTTON, DIALOG, SEARCH, HOME, TOKENS, STYLESHEET, RESOLVER, BUTTON_RENDER: RENDER } = PATHS;

// The fixture's tokens as CSS: the base in :root, then the one theme system.md names after the base.
const FIXTURE_STYLESHEET = [
  HEADER,
  "",
  ":root {",
  "  --color-brand-primary: #336699;",
  "  --color-text-default: var(--color-brand-primary);",
  "  --color-action-default: var(--color-brand-primary);",
  "  --space-md: 1rem;",
  "  --border-thin: 0.0625rem;",
  "  --motion-fast: 150ms;",
  "  --font-body: Inter, sans-serif;",
  "  --font-weight-bold: 700;",
  "}",
  "",
  ':root[data-theme="dark"] {',
  "  --color-brand-primary: #6699cc;",
  "}",
  "",
  "@media (min-width: 64rem) {",
  "  :root {",
  "    --space-md: 1.5rem;",
  "  }",
  "}",
  "",
].join("\n");

/** One mutation from each family: records, tokens, code, as the formatter prints each. */
const FAILURES = [
  `${BRAND} R14 => add a "## Users" section`,
  `${TOKENS} T4 "space.md" => set the unit to px or rem`,
  `${DIALOG} C1 "package:@radix-ui/react-dialog#Root" => add @<version> to the link`,
];
const [BRAND_FAILURE, TOKENS_FAILURE, DIALOG_FAILURE] = FAILURES;

let tmp;
let sid;
let sessionCount = 0;

// The contract's state folder: one per user where the system has users, the temp dir being per user elsewhere.
const HOOKS_FOLDER = typeof process.getuid === "function" ? `aidd-hooks-${process.getuid()}` : "aidd-hooks";
/** The folder aidd-ui keeps its turn marks in, under the temp dir `base`. */
const stateFolder = (base = os.tmpdir()) => path.join(base, HOOKS_FOLDER, "aidd-ui");
/** The turn mark of session `id`. */
const markPath = (id, base) => path.join(stateFolder(base), id);
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  tmp = fs.realpathSync(makeTmp("aidd-ui-validate-")); // the real path: the engine is found relative to it
  writeProject(tmp);
  propose(tmp, BUTTON); // the entries' cases edit the button and its render, which a validation would hold
  sid = `t${process.pid}-${sessionCount++}`;
});

afterEach(() => {
  removeTmp(tmp);
  fs.rmSync(markPath(sid), { force: true });
  fs.rmSync(`${markPath(sid)}.base`, { force: true });
});

function breakOnePerFamily() {
  edit(tmp, BRAND, "## Users\n\nAnalysts.\n\n", "");
  editTokens(tmp, (tree) => (tree.space.md.$value = { value: 1, unit: "em" }));
  edit(tmp, DIALOG, "package:@radix-ui/react-dialog#Root@1", "package:@radix-ui/react-dialog#Root");
}

/** The `tokens` command, with the stylesheet it writes: null when it writes none. */
function generate(root) {
  const run = spawnSync(process.execPath, [ENGINE, "tokens", root], { encoding: "utf8" });
  const file = path.join(root, STYLESHEET);
  return { code: run.status, out: lines(run.stdout), err: run.stderr, css: fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null };
}

/** The hook run on `input`; `temp` points it at another temp dir, so a test can plant files there. */
function hook(input, temp = null) {
  const env = temp ? { ...process.env, TMPDIR: temp, TMP: temp, TEMP: temp } : process.env;
  const run = spawnSync(process.execPath, [ENGINE, "hook"], { input, encoding: "utf8", env });
  return { code: run.status, out: run.stdout, err: run.stderr };
}

// The plugin tree ships Claude Code's host adapter, so these payloads are Claude Code's. Every
// other host reaches the hook through its own adapter, tested where the adapters live.
/** A Write of the file as it now stands, the whole of it being the write's. */
/** A Write of `filePath` as it stands; given `originalFile`, the file it replaced, as Claude Code says it. */
const postToolUse = (filePath, originalFile) => {
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const response = originalFile === undefined ? {} : { type: "update", originalFile };
  return JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, session_id: sid, tool_name: "Write", tool_input: { file_path: filePath, content }, tool_response: response });
};
/** An Edit replacing `from` with `to` in `file`, made on disk as the tool makes it. */
const editTool = (file, from, to) => {
  edit(tmp, file, from, to);
  return JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, session_id: sid, tool_name: "Edit", tool_input: { file_path: path.join(tmp, file), old_string: from, new_string: to }, tool_response: {} });
};
const shell = (command) => JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, session_id: sid, tool_name: "Bash", tool_input: { command }, tool_response: {} });
const marked = () => fs.existsSync(markPath(sid));
const sessionStart = () => JSON.stringify({ hook_event_name: "SessionStart", cwd: tmp, source: "startup" });
/** Starts the session: the hook notes the errors the project holds now, which no turn then answers for. */
const begin = () => hook(JSON.stringify({ hook_event_name: "SessionStart", cwd: tmp, session_id: sid, source: "startup" }));
const stop = (active = false) => JSON.stringify({ hook_event_name: "Stop", cwd: tmp, session_id: sid, stop_hook_active: active });
const silent = { code: 0, out: "", err: "" };
/** The one text every host gets: the count line, then the lines. */
const counted = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;
const text = (errors, warnings, lines) => [`aidd-ui: ${counted(errors, "error")}, ${counted(warnings, "warning")}`, ...lines].join("\n");
/** The text of `lines` that are all errors. */
const errorsText = (lines) => text(lines.length, 0, lines);
// Claude Code reads additionalContext under hookSpecificOutput, and a block's reason at Stop.
const claudeFeedback = (report) => ({ code: 0, out: `${JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: report } })}\n`, err: "" });
const finish = (report) => ({ code: 0, out: `${JSON.stringify({ decision: "block", reason: report })}\n`, err: "" });
/** A render holding `errors` colour literals and `warnings` hairlines, one line each, from line 28. */
const rendered = () => fs.readFileSync(path.join(tmp, RENDER), "utf8");
const littering = (errors, warnings) => edit(tmp, RENDER, "</body>", `${'<p style="color: #000000">x</p>\n'.repeat(errors)}${'<p style="border-width: 1px">x</p>\n'.repeat(warnings)}</body>`);
const literal = (line) => `${RENDER}:${line} V4 "#000000" => replace it with a token`;
const hairline = (line) => `${RENDER}:${line} V6 warning literal "1px", only tokens carry values => replace it with a token`;
const range = (from, count) => Array.from({ length: count }, (_, index) => from + index);

// The plugin's own declaration: every host builds its hooks from this file, so a missing event
// here means no install runs that check.
describe("aidd-ui hooks declaration", () => {
  const declared = JSON.parse(fs.readFileSync(path.join(HOOKS, "hooks.json"), "utf8")).hooks;

  // The tools the host adapters read, under each host's own name: a hook fired for another would read nothing.
  it("fires after the tools the host adapter reads, a shell command among them since the engine writes through one", () => {
    assert.deepEqual(declared.PostToolUse.map((group) => group.matcher), ["Write|Edit|Delete|Bash|Shell|bash|PowerShell"]);
  });

  it("bounds every hook to the contract's 5 seconds", () => {
    const timeouts = Object.values(declared).flatMap((groups) => groups.flatMap((group) => group.hooks.map((hook) => hook.timeout)));
    assert.deepEqual([...new Set(timeouts)], [5]);
  });

  it("runs the engine's hook command at every moment it handles: session start, after a write, turn end", () => {
    for (const event of ["SessionStart", "PostToolUse", "Stop"]) {
      const commands = declared[event].flatMap((group) => group.hooks.map((hook) => hook.command));
      assert.deepEqual(commands, [`node \${CLAUDE_PLUGIN_ROOT}/hooks/aidd-ui.cjs hook`]);
    }
  });
});

describe("aidd-ui validator entries", () => {
  it("prints VALID for the valid project", () => {
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });

  describe("E8 warnings", () => {
    const ORPHAN = "src/ui/Orphan.tsx C3 warning no record links it and no ignore covers it => link it from a record's code, or list it in ignore";
    const orphan = () => fs.writeFileSync(path.join(tmp, "src/ui/Orphan.tsx"), "export function Orphan() {}\n");

    it("prints a warning and exits 0, since only errors fail the check", () => {
      orphan();
      assert.deepEqual(validate(tmp), { code: 0, out: text(0, 1, [ORPHAN]).split("\n"), err: "" });
    });

    it("says nothing at session start about warnings alone", () => {
      orphan();
      assert.deepEqual(hook(sessionStart()), silent);
    });

    it("never blocks the end of a turn on warnings", () => {
      orphan();
      hook(postToolUse(path.join(tmp, "src/ui/Orphan.tsx")));
      assert.deepEqual(hook(stop()), silent);
    });

    it("takes a colour literal the debt records as a warning: it fails no check and blocks no turn", () => {
      fs.appendFileSync(path.join(tmp, "src/ui/Button.tsx"), 'const style = "color: #ff0000";\n');
      fs.writeFileSync(path.join(tmp, UI, "code-debt.json"), `${JSON.stringify({ "src/ui/Button.tsx": { "#ff0000": 1 } })}\n`);
      assert.deepEqual(validate(tmp), { code: 0, out: text(0, 1, ['src/ui/Button.tsx:4 C4 warning colour literal "#ff0000", use a token (existing debt) => replace it with a token']).split("\n"), err: "" });
      hook(postToolUse(path.join(tmp, BRAND)));
      assert.deepEqual(hook(stop()), silent);
    });

    it("warns on a hairline width a render keeps literal, and fails on a wider one", () => {
      edit(tmp, `${UI}/components/button.html`, "</body>", '<p style="border-width: 1px; inset-block-start: 3px">x</p>\n</body>');
      assert.deepEqual(validate(tmp), {
        code: 1,
        out: [
          "aidd-ui: 1 error, 1 warning",
          `${UI}/components/button.html:28 V6 "3px" => replace it with a token`,
          `${UI}/components/button.html:28 V6 warning literal "1px", only tokens carry values => replace it with a token`,
        ],
        err: "",
      });
    });
  });

  describe("E9 commands", () => {
    it("names the commands and exits 2 on one it does not know", () => {
      const run = spawnSync(process.execPath, [ENGINE, "valdate", tmp], { encoding: "utf8" });
      assert.deepEqual({ code: run.status, out: run.stdout, err: run.stderr }, { code: 2, out: "", err: "usage: node aidd-ui.cjs <validate|tokens> [project-root]\n       node aidd-ui.cjs hook < <host event>\n       node aidd-ui.cjs impact <id or token>… [--root <dir>]\n       node aidd-ui.cjs extract [--force] [--root <dir>]\n       node aidd-ui.cjs bump --task <aidd_docs/tasks/…> (--change \"<text>\" [--breaking] | --created | --removed) <token or id>… [--root <dir>]\n       node aidd-ui.cjs publish ([--breaking] | <id>…) [--root <dir>]\n" });
    });
  });

  describe("E10 tokens command", () => {
    it("writes tokens.css, prints its path, and leaves a design system that validates", () => {
      fs.rmSync(path.join(tmp, STYLESHEET));
      const written = generate(tmp);
      assert.deepEqual({ code: written.code, out: written.out, err: written.err }, { code: 0, out: [STYLESHEET], err: "" });
      assert.equal(written.css, FIXTURE_STYLESHEET);
      assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
    });

    it("writes the same bytes on a second run", () => {
      const first = generate(tmp).css;
      assert.equal(generate(tmp).css, first);
    });

    it("regenerates a stylesheet the tokens left behind, then names the code's token file the change left behind", () => {
      propose(tmp, DIALOG, SEARCH, HOME);
      edit(tmp, TOKENS, '"value": 1,', '"value": 2,');
      assert.equal(validate(tmp).code, 1);
      generate(tmp);
      assert.deepEqual(validate(tmp).out, ["aidd-ui: 1 error, 0 warnings", `src/ui/tokens.css:3 C10 "--space-md" => set it to 2rem, the design system's value`]);
      edit(tmp, "src/ui/tokens.css", "--space-md: 1rem", "--space-md: 2rem");
      assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
    });

    describe("the resolver", () => {
      const resolverOf = () => JSON.parse(fs.readFileSync(path.join(tmp, RESOLVER), "utf8"));
      // The fixture's own resolver is what system.md and its context files imply: the engine must give it back.
      const held = () => {
        const resolver = resolverOf();
        fs.rmSync(path.join(tmp, RESOLVER));
        return resolver;
      };

      it("writes the resolver system.md and the context files imply, before the stylesheet", () => {
        const expected = held();
        fs.rmSync(path.join(tmp, STYLESHEET));
        assert.deepEqual(generate(tmp).out, [STYLESHEET]);
        assert.deepEqual(resolverOf(), expected);
        assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
      });

      it("takes a breakpoint's media query from the Query column of system.md", () => {
        held();
        edit(tmp, `${UI}/system.md`, "(min-width: 64rem)", "(min-width: 80rem)");
        assert.equal(generate(tmp).code, 0);
        assert.equal(resolverOf().modifiers.breakpoint.$extensions["dev.ai-driven.media"].desktop, "(min-width: 80rem)");
        assert.ok(fs.readFileSync(path.join(tmp, STYLESHEET), "utf8").includes("@media (min-width: 80rem) {"));
      });

      it("rewrites a resolver that no longer matches the context files", () => {
        fs.rmSync(path.join(tmp, UI, "themes/dark.json"));
        fs.writeFileSync(path.join(tmp, UI, "breakpoints/desktop.json"), "{}\n");
        generate(tmp);
        assert.deepEqual(resolverOf().modifiers.theme.contexts, { light: [], dark: [] });
      });

      it("writes a platform modifier only once a platform other than the first has a file", () => {
        edit(tmp, `${UI}/system.md`, "platforms: [web]", "platforms: [web, mobile]");
        edit(tmp, `${UI}/system.md`, "code-roots: [src/ui]", "code-roots: [web=src/ui, mobile=src/mobile]");
        edit(tmp, `${UI}/components/dialog.md`, "code: package", "code: web=package");
        generate(tmp);
        assert.equal(resolverOf().modifiers.platform, undefined);
        fs.mkdirSync(path.join(tmp, UI, "platforms"));
        fs.writeFileSync(path.join(tmp, UI, "platforms/mobile.json"), JSON.stringify({ border: { thin: { $value: { value: 0.125, unit: "rem" } } } }));
        generate(tmp);
        assert.deepEqual(resolverOf().modifiers.platform, { default: "web", contexts: { web: [], mobile: [{ $ref: "platforms/mobile.json" }] } });
        assert.deepEqual(resolverOf().resolutionOrder.map((step) => step.$ref), ["#/sets/base", "#/modifiers/theme", "#/modifiers/platform", "#/modifiers/breakpoint"]);
      });

      it("writes none while one theme and no context file ask for none", () => {
        held();
        edit(tmp, `${UI}/system.md`, "themes: [light, dark]", "themes: [light]");
        fs.rmSync(path.join(tmp, UI, "themes"), { recursive: true });
        fs.rmSync(path.join(tmp, UI, "breakpoints"), { recursive: true });
        assert.equal(generate(tmp).code, 0);
        assert.equal(fs.existsSync(path.join(tmp, RESOLVER)), false);
      });

      it("names a breakpoint file whose row has no query, and leaves the fix to system.md", () => {
        edit(tmp, `${UI}/system.md`, "| desktop | (min-width: 64rem) |", "| desktop | |");
        assert.deepEqual(generate(tmp).out, ["aidd-ui: 1 error, 0 warnings", `${RESOLVER} T6 "desktop" => give it a Query in system.md, then run node <engine> tokens`]);
      });
    });

    it("writes nothing, names the error and exits 1 while the tokens have one", () => {
      fs.rmSync(path.join(tmp, STYLESHEET));
      editTokens(tmp, (tree) => (tree.space.md.$value = { value: 1, unit: "em" }));
      assert.deepEqual(generate(tmp), { code: 1, out: ["aidd-ui: 1 error, 0 warnings", TOKENS_FAILURE], err: "", css: null });
    });

    it("writes nothing, names the token and exits 1 for a composite without raw CSS", () => {
      fs.rmSync(path.join(tmp, STYLESHEET));
      editTokens(tmp, (tree) => (tree.elevation = { low: { $type: "shadow", $value: { color: "#000000" } } }));
      assert.deepEqual(generate(tmp), {
        code: 1,
        out: ["aidd-ui: 1 error, 0 warnings", `${TOKENS} T10 "elevation.low" => give it a dev.ai-driven.css value`],
        err: "",
        css: null,
      });
    });

    it("prints nothing without aidd_docs/ui/ and writes nothing", () => {
      fs.rmSync(path.join(tmp, UI), { recursive: true });
      assert.deepEqual(generate(tmp), { code: 0, out: [], err: "", css: null });
    });
  });

  describe("E1 no design system", () => {
    it("prints nothing without aidd_docs/ui/", () => {
      fs.rmSync(path.join(tmp, UI), { recursive: true });
      assert.deepEqual(validate(tmp), { code: 0, out: [], err: "" });
    });
  });

  describe("E2 every check runs", () => {
    it("prints one line per broken rule, from each family, and exits 1", () => {
      breakOnePerFamily();
      assert.deepEqual(validate(tmp), { code: 1, out: ["aidd-ui: 3 errors, 0 warnings", ...FAILURES], err: "" });
    });

    it("prints one line, never an avalanche, for a design system written in another format", () => {
      breakOnePerFamily();
      edit(tmp, `${UI}/system.md`, "format: 1", "format: 2");
      assert.deepEqual(validate(tmp), { code: 1, out: ["aidd-ui: 1 error, 0 warnings", `${UI}/system.md U3 "2" => rewrite the design system for format 1`], err: "" });
    });

    it("names a check that throws and still runs the others", () => {
      breakOnePerFamily();
      const broken = { check: () => { throw new Error("boom"); } };
      const found = problemsOf(load(tmp), { broken, records: require(path.join(LIB, "records.cjs")) });
      assert.equal(formatFindings("aidd-ui", { errors: found.map(findingOf) }), text(2, 0, [`${UI} U2 "broken" => fix the input the error names, then run node <engine> validate`, BRAND_FAILURE]));
    });
  });

  // Rule 3 of the hooks' contract: after a write, only what the write itself produced. What it
  // reached in other files is named once, at Stop, where the design system's change is final.
  describe("E3 PostToolUse", () => {
    const RECORD = `${UI}/components/button.md`;
    const V2_GHOST = `${UI}/components/button.html V2 "data-variant=\\"ghost\\"" => add an element carrying it to the render`;
    const R17 = `${RECORD} R17 => add a "## Usage" section saying when to use it and when not`;
    const COLOUR = 'src/ui/Button.tsx:4 C4 "#ff0000" => replace it with a token';
    const colourInCode = () => fs.appendFileSync(path.join(tmp, "src/ui/Button.tsx"), 'const style = "color: #ff0000";\n');

    it("hands back the errors of a file written whole, every line of it being the write's", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(postToolUse(path.join(tmp, BRAND))), claudeFeedback(errorsText([BRAND_FAILURE])));
    });

    it("hands back the errors of a code file written whole under a code root", () => {
      colourInCode();
      assert.deepEqual(hook(postToolUse(path.join(tmp, "src/ui/Button.tsx"))), claudeFeedback(errorsText([COLOUR])));
    });

    it("hands back the errors of a code file under a code root written with a leading ./", () => {
      edit(tmp, `${UI}/system.md`, "code-roots: [src/ui]", "code-roots: [./src/ui]");
      colourInCode();
      assert.deepEqual(hook(postToolUse(path.join(tmp, "src/ui/Button.tsx"))), claudeFeedback(errorsText([COLOUR])));
    });

    it("tells the error the write left in the record citing the written one, and holds no turn for it", () => {
      begin();
      edit(tmp, RECORD, "kind: atom", "kind: composition");
      assert.deepEqual(hook(postToolUse(path.join(tmp, RECORD))), claudeFeedback(errorsText([`${UI}/components/search-field.md R6 "button" => use only elements of its own level or lower`])));
      assert.deepEqual(hook(stop()), silent);
    });

    it("tells the written record's errors and its render's after the write, the render's fix lying elsewhere", () => {
      begin();
      edit(tmp, RECORD, "variants: [primary, secondary]", "variants: [primary, secondary, ghost]");
      edit(tmp, RECORD, "## Usage\n\nAny action a person starts; never for navigation.\n\n", "");
      assert.deepEqual(hook(postToolUse(path.join(tmp, RECORD))), claudeFeedback(errorsText([R17, V2_GHOST])));
    });

    it("tells an error elsewhere once per turn, however many writes leave it", () => {
      begin();
      edit(tmp, RECORD, "kind: atom", "kind: composition");
      hook(postToolUse(path.join(tmp, RECORD)));
      assert.deepEqual(hook(postToolUse(path.join(tmp, RECORD))), silent);
    });

    it("tells nothing elsewhere without a baseline, nothing then proving an error new", () => {
      edit(tmp, RECORD, "kind: atom", "kind: composition");
      assert.deepEqual(hook(postToolUse(path.join(tmp, RECORD))), silent);
    });

    it("tells nothing elsewhere the session started with", () => {
      edit(tmp, RECORD, "kind: atom", "kind: composition");
      begin();
      assert.deepEqual(hook(postToolUse(path.join(tmp, RECORD))), silent);
    });

    /** A turn writes Button.tsx, so the session has read it; colours then land by hand in it and in HomePage.tsx, which no turn wrote. */
    const readThenColoured = () => {
      begin();
      hook(postToolUse(path.join(tmp, "src/ui/Button.tsx")));
      hook(stop());
      colourInCode();
      fs.appendFileSync(path.join(tmp, "src/ui/HomePage.tsx"), 'const style = "color: #00ff00";\n');
    };

    for (const written of ["code-debt.json", "system.md", "components/button.md"]) {
      it(`tells after a write to ${written} the new colour errors of the code files the session has read, and reads no other`, () => {
        readThenColoured();
        assert.deepEqual(hook(postToolUse(path.join(tmp, UI, written))), claudeFeedback(errorsText([COLOUR])));
      });
    }

    it("keeps reading a code file the session wrote in an earlier turn", () => {
      begin();
      hook(postToolUse(path.join(tmp, "src/ui/Button.tsx")));
      hook(stop());
      hook(postToolUse(path.join(tmp, "src/ui/HomePage.tsx")));
      hook(stop());
      colourInCode();
      assert.deepEqual(hook(postToolUse(path.join(tmp, RECORD))), claudeFeedback(errorsText([COLOUR])));
    });

    it("reads after a shell write only the code files the session has read", () => {
      readThenColoured();
      assert.deepEqual(hook(shell(`node ${ENGINE} tokens ${tmp}`)), claudeFeedback(errorsText([COLOUR])));
    });

    it("tells the written tokens' errors, then those of every record reading them", () => {
      begin();
      breakOnePerFamily();
      assert.deepEqual(hook(postToolUse(path.join(tmp, TOKENS))), claudeFeedback(errorsText([TOKENS_FAILURE, BRAND_FAILURE, DIALOG_FAILURE])));
    });

    describe("the errors elsewhere are grouped, the written ones are not", () => {
      const GROUP = `R17 ×3 in ${UI}/components/* => add a "## Usage" section saying when to use it and when not`;
      const usageless = () => {
        propose(tmp, SEARCH, DIALOG);
        edit(tmp, BUTTON, "## Usage\n\nAny action a person starts; never for navigation.\n\n", "");
        edit(tmp, SEARCH, "## Usage\n\nSearching a list; never for a form field.\n\n", "");
        edit(tmp, DIALOG, "## Usage\n\nA decision that blocks the page.\n\n", "");
      };
      const T4 = (name) => `${TOKENS} T4 "${name}" => set the unit to px or rem`;

      it("groups by rule, fix and folder the errors a write left in other files", () => {
        begin();
        usageless();
        assert.deepEqual(hook(postToolUse(path.join(tmp, TOKENS))), claudeFeedback(text(3, 0, [GROUP])));
      });

      it("prints each error of the written files on its own line, beside the groups", () => {
        begin();
        usageless();
        editTokens(tmp, (tree) => {
          tree.space.md.$value = { value: 1, unit: "em" };
          tree.border.thin.$value = { value: 1, unit: "em" };
        });
        assert.deepEqual(hook(postToolUse(path.join(tmp, TOKENS))), claudeFeedback(text(5, 0, [T4("space.md"), T4("border.thin"), GROUP])));
      });
    });

    describe("an edit answers for the lines it added or changed", () => {
      it("hands back the errors of its lines only, not those the file already held", () => {
        littering(2, 0);
        const input = editTool(RENDER, "</body>", '<p style="color: #111111">x</p>\n</body>');
        assert.deepEqual(hook(input), claudeFeedback(errorsText([`${RENDER}:30 V4 "#111111" => replace it with a token`])));
      });

      it("stays silent when its lines hold no error, whatever the file already holds, a line it repeats unchanged included", () => {
        littering(2, 0);
        const kept = '<p style="color: #000000">x</p>\n</body>';
        assert.deepEqual(hook(editTool(RENDER, kept, kept.replace("</body>", "<p>x</p>\n</body>"))), silent);
      });

      it("groups the file's errors under its name when it only removed lines, its effect being unknown", () => {
        littering(3, 0);
        const input = editTool(RENDER, '<p style="color: #000000">x</p>\n</body>', "</body>");
        assert.deepEqual(hook(input), claudeFeedback(text(2, 0, [`V4 ×2 in ${RENDER} "#000000" => replace it with a token`])));
      });
    });

    it("stays silent when the written files reach no problem, which Stop names", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(postToolUse(path.join(tmp, `${UI}/journeys/onboarding.md`))), silent);
    });

    it("prints every error of the written files, none cut and no count of what is left", () => {
      littering(12, 0);
      assert.deepEqual(hook(postToolUse(path.join(tmp, RENDER))), claudeFeedback(errorsText(range(28, 12).map(literal))));
    });

    it("prints the errors of the written files, then the warnings, up to ten of them", () => {
      littering(3, 12);
      assert.deepEqual(hook(postToolUse(path.join(tmp, RENDER))), claudeFeedback(text(3, 12, [...range(28, 3).map(literal), ...range(31, 10).map(hairline)])));
    });

    it("prints the warnings of the written files only", () => {
      for (const name of ["Orphan", "Stray"]) fs.writeFileSync(path.join(tmp, `src/ui/${name}.tsx`), `export function ${name}() {}\n`);
      const orphan = (name) => `src/ui/${name}.tsx C3 warning no record links it and no ignore covers it => link it from a record's code, or list it in ignore`;
      assert.deepEqual(hook(postToolUse(path.join(tmp, "src/ui/Orphan.tsx"))), claudeFeedback(text(0, 1, [orphan("Orphan")])));
      assert.deepEqual(hook(postToolUse(path.join(tmp, BRAND))), silent);
    });

    it("stays silent when a write lands elsewhere", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(postToolUse(path.join(tmp, "README.md"))), silent);
    });

    it("stays silent on a valid project", () => {
      assert.deepEqual(hook(postToolUse(path.join(tmp, BRAND))), silent);
    });
  });

  describe("E7 Stop", () => {
    it("holds the turn once on the errors on the lines its writes changed", () => {
      begin();
      const before = rendered();
      littering(1, 0);
      hook(postToolUse(path.join(tmp, RENDER), before));
      assert.deepEqual(hook(stop()), finish(errorsText([literal(28)])));
    });

    it("holds with every error of the changed lines, none cut, and no warning", () => {
      begin();
      const before = rendered();
      littering(12, 3);
      hook(postToolUse(path.join(tmp, RENDER), before));
      assert.deepEqual(hook(stop()), finish(errorsText(range(28, 12).map(literal))));
    });

    it("never holds on an error with no line, which no line proves the turn's: the check holds it", () => {
      begin();
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, BRAND)));
      assert.deepEqual(hook(stop()), silent);
    });

    it("holds nothing for a shell command, which proves no line, and tells what it left once", () => {
      begin();
      breakOnePerFamily();
      assert.deepEqual(hook(shell(`node ${ENGINE} tokens ${tmp}`)), claudeFeedback(errorsText(FAILURES)));
      assert.deepEqual(hook(shell(`node ${ENGINE} tokens ${tmp}`)), silent);
      assert.deepEqual(hook(stop()), silent);
    });

    it("holds a Write only on the lines it changed from the file it replaced", () => {
      littering(2, 0);
      begin();
      const before = rendered();
      littering(1, 0);
      hook(postToolUse(path.join(tmp, RENDER), before));
      assert.deepEqual(hook(stop()), finish(errorsText([literal(30)])));
    });

    it("holds a whole-file write that does not say what it replaced only past the errors the baseline counts", () => {
      littering(2, 0);
      begin();
      littering(1, 0);
      hook(postToolUse(path.join(tmp, RENDER)));
      assert.deepEqual(hook(stop()), finish(errorsText([literal(30)])));
    });

    it("holds nothing for such a write without a baseline, nothing proving its lines new", () => {
      littering(1, 0);
      hook(postToolUse(path.join(tmp, RENDER)));
      assert.deepEqual(hook(stop()), silent);
    });

    it("holds nothing for a line the turn changed and changed back", () => {
      littering(1, 0);
      const line = '<p style="color: #000000">x</p>';
      hook(editTool(RENDER, line, "<p>x</p>"));
      hook(editTool(RENDER, "<p>x</p>", line));
      assert.deepEqual(hook(stop()), silent);
    });

    it("asks once: the turn end it held takes the errors it asked for into the baseline", () => {
      begin();
      const before = rendered();
      littering(1, 0);
      hook(postToolUse(path.join(tmp, RENDER), before));
      assert.deepEqual(hook(stop()), finish(errorsText([literal(28)])));
      hook(postToolUse(path.join(tmp, RENDER), before));
      assert.deepEqual(hook(stop()), silent);
    });

    it("lets the turn end on the repeated Stop, the one it asked for", () => {
      begin();
      littering(1, 0);
      hook(postToolUse(path.join(tmp, RENDER)));
      hook(stop());
      assert.deepEqual(hook(stop(true)), silent);
    });

    it("ends the forced turn even when that turn writes an error again", () => {
      begin();
      littering(1, 0);
      hook(postToolUse(path.join(tmp, RENDER)));
      hook(stop());
      littering(1, 0);
      hook(postToolUse(path.join(tmp, RENDER)));
      assert.deepEqual(hook(stop(true)), silent);
    });

    it("hands the problems back on a second write in the same turn", () => {
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, BRAND)));
      assert.deepEqual(hook(postToolUse(path.join(tmp, BRAND))), claudeFeedback(errorsText([BRAND_FAILURE])));
    });

    it("still hands the problems back when the turn mark cannot be written", () => {
      breakOnePerFamily();
      const run = spawnSync(process.execPath, [ENGINE, "hook"], { input: postToolUse(path.join(tmp, BRAND)), encoding: "utf8", env: { ...process.env, TMPDIR: path.join(tmp, "no-such-dir"), TMP: path.join(tmp, "no-such-dir"), TEMP: path.join(tmp, "no-such-dir") } });
      assert.deepEqual({ code: run.status, out: run.stdout, err: run.stderr }, claudeFeedback(errorsText([BRAND_FAILURE])));
    });

    it("never writes through a link planted at the mark's path", () => {
      const target = path.join(tmp, "victim.txt");
      fs.writeFileSync(target, "keep");
      fs.mkdirSync(stateFolder(), { recursive: true, mode: 0o700 });
      fs.symlinkSync(target, markPath(sid));
      hook(postToolUse(path.join(tmp, BRAND)));
      assert.equal(fs.readFileSync(target, "utf8"), "keep");
    });

    it("keeps the mark in <tmpdir>/aidd-hooks-<uid>/aidd-ui/<session>, the turn's net changed lines in it", () => {
      const temp = path.join(tmp, "temp");
      fs.mkdirSync(temp);
      hook(editTool(BRAND, "Analysts.", "Analysts and buyers."), temp);
      assert.deepEqual(JSON.parse(fs.readFileSync(markPath(sid, temp), "utf8")), [
        [`+${JSON.stringify([BRAND, "Analysts and buyers."])}`, 1],
        [`+${JSON.stringify([BRAND, "Analysts."])}`, -1],
      ]);
    });

    it("keeps the baseline beside the mark, the errors the session started with counted by file, rule and excerpt", () => {
      const temp = path.join(tmp, "temp");
      fs.mkdirSync(temp);
      littering(2, 0);
      hook(JSON.stringify({ hook_event_name: "SessionStart", cwd: tmp, session_id: sid, source: "startup" }), temp);
      assert.deepEqual(JSON.parse(fs.readFileSync(`${markPath(sid, temp)}.base`, "utf8")), [[JSON.stringify([RENDER, "V4", "#000000"]), 2]]);
    });

    it("reads no code file at the session's start: a code file joins the baseline at the end of the first turn that writes it", () => {
      const temp = path.join(tmp, "temp");
      fs.mkdirSync(temp);
      fs.appendFileSync(path.join(tmp, "src/ui/Button.tsx"), 'const style = "color: #ff0000";\n');
      hook(JSON.stringify({ hook_event_name: "SessionStart", cwd: tmp, session_id: sid, source: "startup" }), temp);
      assert.deepEqual(JSON.parse(fs.readFileSync(`${markPath(sid, temp)}.base`, "utf8")), []);
      hook(postToolUse(path.join(tmp, "src/ui/Button.tsx")), temp);
      hook(stop(), temp);
      assert.deepEqual(JSON.parse(fs.readFileSync(`${markPath(sid, temp)}.base`, "utf8")), [[JSON.stringify(["src/ui/Button.tsx", "C4", "#ff0000"]), 1], [JSON.stringify(["src/ui/Button.tsx"]), 1]]);
    });

    it("keeps its folders to their owner, the mark to its owner alone", { skip: process.platform === "win32" }, () => {
      const temp = path.join(tmp, "temp");
      fs.mkdirSync(temp);
      hook(postToolUse(path.join(tmp, BRAND)), temp);
      const mode = (file) => fs.statSync(file).mode & 0o777;
      assert.deepEqual([mode(path.dirname(stateFolder(temp))), mode(stateFolder(temp)), mode(markPath(sid, temp))], [0o700, 0o700, 0o600]);
    });

    it("marks a shell command that may have written any file, with no changed line", () => {
      const temp = path.join(tmp, "temp");
      fs.mkdirSync(temp);
      hook(shell(`node ${ENGINE} tokens ${tmp}`), temp);
      assert.equal(fs.readFileSync(markPath(sid, temp), "utf8"), "[]");
    });

    it("reads a mark it cannot parse as one with no changed line", () => {
      begin();
      littering(1, 0);
      fs.writeFileSync(markPath(sid), "unknown\n", { mode: 0o600 });
      assert.deepEqual(hook(stop()), silent);
    });

    for (const level of ["the hooks folder", "the plugin's folder"]) {
      it(`leaves no mark through a link planted as ${level}, and still hands the problems back`, () => {
        breakOnePerFamily();
        const temp = path.join(tmp, "temp");
        const elsewhere = path.join(tmp, "elsewhere");
        fs.mkdirSync(elsewhere, { recursive: true });
        const planted = level === "the hooks folder" ? path.dirname(stateFolder(temp)) : stateFolder(temp);
        fs.mkdirSync(path.dirname(planted), { recursive: true, mode: 0o700 });
        fs.symlinkSync(elsewhere, planted, "junction");
        assert.deepEqual(hook(postToolUse(path.join(tmp, BRAND)), temp), claudeFeedback(errorsText([BRAND_FAILURE])));
        assert.deepEqual(fs.readdirSync(elsewhere), []);
      });
    }

    it("leaves no mark in a hooks folder others can write to", { skip: process.platform === "win32" }, () => {
      const temp = path.join(tmp, "temp");
      fs.mkdirSync(path.dirname(stateFolder(temp)), { recursive: true });
      fs.chmodSync(path.dirname(stateFolder(temp)), 0o777);
      hook(postToolUse(path.join(tmp, BRAND)), temp);
      assert.equal(fs.existsSync(markPath(sid, temp)), false);
    });

    it("consumes the turn mark: a later Stop without a new write is silent", () => {
      littering(1, 0);
      hook(editTool(RENDER, "</body>", '<p style="color: #111111">x</p>\n</body>'));
      hook(stop());
      assert.deepEqual(hook(stop()), silent);
    });

    it("stays silent at Stop when no UI file was written this turn", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(stop()), silent);
    });

    it("stays silent at Stop when the write landed elsewhere", () => {
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, "README.md")));
      assert.deepEqual(hook(stop()), silent);
    });

    it("stays silent at Stop once the problems are fixed", () => {
      begin();
      littering(1, 0);
      hook(postToolUse(path.join(tmp, RENDER)));
      writeProject(tmp);
      assert.deepEqual(hook(stop()), silent);
    });

    it("still hands the problems back when the session id is not a file-name part", () => {
      breakOnePerFamily();
      const input = JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, session_id: "a/b", tool_name: "Write", tool_input: { file_path: path.join(tmp, BRAND) }, tool_response: {} });
      assert.deepEqual(hook(input), claudeFeedback(errorsText([BRAND_FAILURE])));
    });

    it("stays silent without a session id, since it cannot tell a turn apart", () => {
      breakOnePerFamily();
      hook(JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, tool_name: "Write", tool_input: { file_path: path.join(tmp, BRAND) }, tool_response: {} }));
      assert.deepEqual(hook(JSON.stringify({ hook_event_name: "Stop", cwd: tmp })), silent);
    });
  });

  // Stop is the one answer that keeps the person waiting: it names what the turn produced, never
  // an error the project held before the turn began.
  describe("E13 Stop never holds the turn on a standing error", () => {
    for (const command of [`node ${ENGINE} validate ${tmp}`, `node ${ENGINE} impact button --root ${tmp}`, `node ${ENGINE} publish button --root ${tmp}`]) {
      it(`does not mark the turn when the engine only reads: ${command.replace(tmp, "<root>").replace(ENGINE, "aidd-ui.cjs")}`, () => {
        breakOnePerFamily();
        assert.deepEqual(hook(shell(command)), silent);
        assert.deepEqual(hook(stop()), silent);
      });
    }

    it("keeps the standing errors of a code file a turn did not write, for the next turn that writes it", () => {
      fs.appendFileSync(path.join(tmp, "src/ui/Button.tsx"), 'const style = "color: #ff0000";\n');
      begin();
      hook(editTool(BUTTON, "Any action a person starts; never for navigation.", "Any action a person starts, never for navigation."));
      assert.deepEqual(hook(stop()), silent);
      assert.deepEqual(hook(postToolUse(path.join(tmp, "src/ui/Button.tsx"))), claudeFeedback(errorsText(['src/ui/Button.tsx:4 C4 "#ff0000" => replace it with a token'])));
      assert.deepEqual(hook(stop()), silent);
    });

    it("notes every code file's standing errors at the first Stop of a session that started without a baseline", () => {
      fs.appendFileSync(path.join(tmp, "src/ui/Button.tsx"), 'const style = "color: #ff0000";\n');
      hook(editTool(BUTTON, "Any action a person starts; never for navigation.", "Any action a person starts, never for navigation."));
      assert.deepEqual(hook(stop()), silent);
      hook(postToolUse(path.join(tmp, "src/ui/Button.tsx")));
      assert.deepEqual(hook(stop()), silent);
    });

    it("holds no turn on a code file's standing errors when a whole-file write the session never read says nothing of what it replaced", () => {
      fs.appendFileSync(path.join(tmp, "src/ui/Button.tsx"), 'const style = "color: #ff0000";\n');
      begin();
      hook(postToolUse(path.join(tmp, "src/ui/Button.tsx")));
      assert.deepEqual(hook(stop()), silent);
    });

    it("ends the turn when an edit added a clean line to a file already holding errors", () => {
      littering(2, 0);
      hook(editTool(RENDER, "</body>", "<p>x</p>\n</body>"));
      assert.deepEqual(hook(stop()), silent);
    });

    it("ends the turn when a written record reaches a render already holding errors", () => {
      littering(2, 0);
      hook(editTool(BUTTON, "Any action a person starts; never for navigation.", "Any action a person starts, never for navigation."));
      assert.deepEqual(hook(stop()), silent);
    });

    it("still holds the turn on the error an edit added beside the standing ones", () => {
      littering(2, 0);
      hook(editTool(RENDER, "</body>", '<p style="color: #111111">x</p>\n</body>'));
      assert.deepEqual(hook(stop()), finish(errorsText([`${RENDER}:30 V4 "#111111" => replace it with a token`])));
    });
  });

  // Every host reaches the hook through hooks/lib/host.cjs, which the build swaps per tool. A stub
  // stands in for it here: it hands the hook the neutral event it reads on stdin, and prints what
  // the hook answers, so these cases hold whatever host the event came from.
  describe("E12 the host's neutral event", () => {
    const STUB = [
      'const fs = require("node:fs");',
      "const print = (output) => process.stdout.write(JSON.stringify(output));",
      "module.exports = {",
      "  readEvent() {",
      "    try {",
      '      return JSON.parse(fs.readFileSync(0, "utf8"));',
      "    } catch {",
      "      return undefined;",
      "    }",
      "  },",
      "  answer: ({ level, text }) => print({ answer: level, text }),",
      "  continueTurn: (text) => print({ continueTurn: text }),",
      "};",
      "",
    ].join("\n");
    let hooks;
    beforeEach(() => {
      hooks = makeTmp("aidd-ui-hooks-");
      fs.cpSync(HOOKS, hooks, { recursive: true });
      fs.writeFileSync(path.join(hooks, "lib", "host.cjs"), STUB);
    });
    afterEach(() => removeTmp(hooks));

    const neutral = (event, fields = {}) => {
      const input = JSON.stringify({ host: "stub", event, files: [], stopActive: false, sessionId: sid, cwd: tmp, raw: {}, ...fields });
      const run = spawnSync(process.execPath, [path.join(hooks, "aidd-ui.cjs"), "hook"], { input, encoding: "utf8" });
      return { code: run.status, out: run.stdout, err: run.stderr };
    };
    const write = (files, fields = {}) => neutral("PostToolUse", { files: files.map((file) => ({ path: path.join(tmp, file) })), ...fields });
    const informs = (report) => ({ code: 0, out: JSON.stringify({ answer: 1, text: report }), err: "" });
    const continues = (report) => ({ code: 0, out: JSON.stringify({ continueTurn: report }), err: "" });

    it("informs the model of what a write broke", () => {
      breakOnePerFamily();
      assert.deepEqual(write([BRAND]), informs(errorsText([BRAND_FAILURE])));
    });

    it("reads every file the event lists, one elsewhere among them", () => {
      breakOnePerFamily();
      assert.deepEqual(write(["README.md", BRAND]), informs(errorsText([BRAND_FAILURE])));
      assert.deepEqual(write([BRAND, "README.md"]), informs(errorsText([BRAND_FAILURE])));
    });

    it("stays silent and leaves no mark when every listed file is elsewhere", () => {
      breakOnePerFamily();
      assert.deepEqual(write(["README.md"]), silent);
      assert.equal(marked(), false);
    });

    // A patch that deletes a file lists it like one it writes; nothing on disk says what cited it.
    it("tells, after a write that deleted a file, what the records citing it lost, and holds no turn for it", () => {
      neutral("SessionStart");
      fs.rmSync(path.join(tmp, BUTTON));
      const citer = new RegExp(`R6 ×2 in ${UI}/components/\\* \\\\"button\\\\" => remove it from uses`);
      assert.match(write([BUTTON]).out, citer);
      assert.deepEqual(neutral("Stop"), silent);
    });

    it("continues the turn once at Stop on the errors of the lines a write added, through continueTurn", () => {
      littering(1, 0);
      neutral("PostToolUse", { files: [{ path: path.join(tmp, RENDER), written: '<p style="color: #000000">x</p>', replaced: "" }] });
      assert.deepEqual(neutral("Stop"), continues(errorsText([literal(28)])));
      assert.deepEqual(neutral("Stop"), silent);
    });

    it("tells what a command that runs the engine left, which names no file, and holds no turn for it", () => {
      neutral("SessionStart");
      breakOnePerFamily();
      assert.deepEqual(neutral("PostToolUse", { command: `node ${ENGINE} tokens` }), informs(errorsText(FAILURES)));
      assert.equal(marked(), true);
      assert.deepEqual(neutral("Stop"), silent);
    });

    it("does not mark the turn for a command that only reads", () => {
      breakOnePerFamily();
      assert.deepEqual(neutral("PostToolUse", { command: `cat ${BRAND}` }), silent);
      assert.equal(marked(), false);
    });

    it("lets the turn end at a Stop the host already continued, and consumes the mark", () => {
      breakOnePerFamily();
      write([BRAND]);
      assert.deepEqual(neutral("Stop", { stopActive: true }), silent);
      assert.equal(marked(), false);
    });

    it("informs without a session id, but leaves no mark for a Stop", () => {
      breakOnePerFamily();
      assert.deepEqual(write([BRAND], { sessionId: null }), informs(errorsText([BRAND_FAILURE])));
      assert.deepEqual(neutral("Stop", { sessionId: null }), silent);
    });

    it("reads the project in the event's folder, not the one the hook runs in", () => {
      breakOnePerFamily();
      const elsewhere = makeTmp("aidd-ui-elsewhere-");
      try {
        const input = JSON.stringify({ host: "stub", event: "PostToolUse", files: [{ path: path.join(tmp, BRAND) }], stopActive: false, sessionId: sid, cwd: elsewhere, raw: {} });
        const run = spawnSync(process.execPath, [path.join(hooks, "aidd-ui.cjs"), "hook"], { input, encoding: "utf8", cwd: tmp });
        assert.deepEqual({ code: run.status, out: run.stdout, err: run.stderr }, silent);
      } finally {
        removeTmp(elsewhere);
      }
    });

    it("prints nothing at session start", () => {
      breakOnePerFamily();
      assert.deepEqual(neutral("SessionStart"), silent);
    });

    it("prints nothing when the host reads no event", () => {
      breakOnePerFamily();
      const run = spawnSync(process.execPath, [path.join(hooks, "aidd-ui.cjs"), "hook"], { input: "", encoding: "utf8" });
      assert.deepEqual({ code: run.status, out: run.stdout, err: run.stderr }, silent);
    });
  });

  describe("E11 engine commands", () => {
    const ENGINE_COMMANDS = [
      ["runs the engine", `node ${ENGINE} tokens ${tmp}`],
      ["runs the engine installed flat", "node .claude/hooks/aidd-ui/aidd-ui.cjs bump --task aidd_docs/tasks/x --change y color.brand.primary"],
      ["extracts the tokens", `node ${ENGINE} extract --force --root ${tmp}`],
      ["publishes the system", `node ${ENGINE} publish --breaking --root ${tmp}`],
      ["writes after a read", `node ${ENGINE} validate ${tmp} && node ${ENGINE} tokens ${tmp}`],
      ["names aidd_docs/ui/ and writes", "sed -i s/a/b/ aidd_docs/ui/brand.md"],
    ];
    for (const [name, command] of ENGINE_COMMANDS) {
      it(`marks the turn and tells what it left when a shell command ${name}, holding no turn for it`, () => {
        begin();
        breakOnePerFamily();
        assert.deepEqual(hook(shell(command)), claudeFeedback(errorsText(FAILURES)));
        assert.equal(marked(), true);
        assert.deepEqual(hook(stop()), silent);
      });
    }

    const WRITES = [
      "echo x > aidd_docs/ui/brand.md",
      "echo x >> aidd_docs/ui/brand.md",
      "echo x | tee aidd_docs/ui/brand.md",
      "sed -i s/a/b/ aidd_docs/ui/brand.md",
      "mv a.md aidd_docs/ui/brand.md",
      "cp a.md aidd_docs/ui/brand.md",
      "rm aidd_docs/ui/brand.md",
      "touch aidd_docs/ui/brand.md",
      "mkdir aidd_docs/ui/components",
      "patch aidd_docs/ui/brand.md fix.diff",
      "apply_patch aidd_docs/ui/brand.md",
      "git apply aidd_docs/ui/fix.diff",
      "git checkout -- aidd_docs/ui/brand.md",
      "git restore aidd_docs/ui/brand.md",
    ];
    for (const command of WRITES) {
      it(`marks the turn when a command names aidd_docs/ui/ and writes: ${command}`, () => {
        breakOnePerFamily();
        assert.deepEqual(hook(shell(command)), silent);
        assert.equal(marked(), true);
      });
    }

    const READS = [
      "cat aidd_docs/ui/brand.md",
      "sed -n '1,40p' aidd_docs/ui/brand.md",
      "grep -rn color aidd_docs/ui/ 2>/dev/null",
      "ls aidd_docs/ui/components",
      "head -5 aidd_docs/ui/brand.md 2>&1",
      'grep -n "=>" aidd_docs/ui/brand.md',
      "git rm --cached aidd_docs/ui/brand.md",
      "git reset aidd_docs/ui/brand.md",
    ];
    for (const command of READS) {
      it(`does not mark the turn when a command only reads aidd_docs/ui/: ${command}`, () => {
        breakOnePerFamily();
        assert.deepEqual(hook(shell(command)), silent);
        assert.equal(marked(), false);
        assert.deepEqual(hook(stop()), silent);
      });
    }

    it("does nothing for any other shell command: no mark, no output at Stop", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(shell("git status && ls src")), silent);
      assert.equal(marked(), false);
      assert.deepEqual(hook(stop()), silent);
    });
  });

  describe("E4 SessionStart", () => {
    it("prints nothing, even over standing errors: they are no finding of this session", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(sessionStart()), silent);
    });

    it("sweeps the marks older than a day and keeps the fresh ones", () => {
      const temp = path.join(tmp, "temp");
      fs.mkdirSync(stateFolder(temp), { recursive: true, mode: 0o700 });
      const [old, fresh] = [markPath("old", temp), markPath("fresh", temp)];
      fs.writeFileSync(old, "unknown\n", { mode: 0o600 });
      fs.writeFileSync(fresh, "unknown\n", { mode: 0o600 });
      const past = new Date(Date.now() - DAY_MS - 60_000);
      fs.utimesSync(old, past, past);
      assert.deepEqual(hook(sessionStart(), temp), silent);
      assert.deepEqual(fs.readdirSync(stateFolder(temp)), ["fresh"]);
    });

    it("sweeps an old link as a link, never what it points to", { skip: process.platform === "win32" }, () => {
      const temp = path.join(tmp, "temp");
      fs.mkdirSync(stateFolder(temp), { recursive: true, mode: 0o700 });
      const target = path.join(tmp, "victim.txt");
      fs.writeFileSync(target, "keep");
      fs.symlinkSync(target, markPath("planted", temp));
      const past = new Date(Date.now() - DAY_MS - 60_000);
      fs.lutimesSync(markPath("planted", temp), past, past);
      hook(sessionStart(), temp);
      assert.deepEqual([fs.readdirSync(stateFolder(temp)), fs.readFileSync(target, "utf8")], [[], "keep"]);
    });

    it("stays silent without aidd_docs/ui/", () => {
      fs.rmSync(path.join(tmp, UI), { recursive: true });
      assert.deepEqual(hook(sessionStart()), silent);
    });
  });

  describe("E5 anything else is silent", () => {
    it("ignores a PostToolUse payload without tool_input.file_path, as a host without matcher sends", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, tool_input: {} })), silent);
    });

    for (const [name, input] of [["empty", ""], ["non-JSON", "not json"]]) {
      it(`ignores ${name} stdin`, () => {
        assert.deepEqual(hook(input), silent);
      });
    }
  });

  describe("E6 unreadable files", { skip: process.platform === "win32" }, () => {
    const DANGLING = `${UI}/dangling.md`;
    const UNREADABLE = `${DANGLING} U1 => make it readable, or remove it`;

    it("names an unreadable record and checks the rest, in every entry", () => {
      fs.symlinkSync(path.join(tmp, "nowhere.md"), path.join(tmp, DANGLING));
      assert.deepEqual(validate(tmp), { code: 1, out: text(1, 0, [UNREADABLE]).split("\n"), err: "" });
      assert.deepEqual(hook(postToolUse(path.join(tmp, DANGLING))), claudeFeedback(errorsText([UNREADABLE])));
    });

    it("names an unreadable file under a code root", () => {
      fs.symlinkSync(path.join(tmp, "src/ui"), path.join(tmp, "src/ui/Folder.css"));
      assert.deepEqual(validate(tmp), {
        code: 1,
        out: text(1, 1, ["src/ui/Folder.css U1 => make it readable, or remove it", "src/ui/Folder.css C3 warning no record links it and no ignore covers it => link it from a record's code, or list it in ignore"]).split("\n"),
        err: "",
      });
    });

    it("names an unreadable file of a techno with no reader once, not binary for want of a read", () => {
      fs.symlinkSync(path.join(tmp, "src/ui"), path.join(tmp, "src/ui/Folder.swift"));
      assert.deepEqual(validate(tmp), {
        code: 1,
        out: text(1, 1, ["src/ui/Folder.swift U1 => make it readable, or remove it", "src/ui/Folder.swift C3 warning no record links it and no ignore covers it => link it from a record's code, or list it in ignore"]).split("\n"),
        err: "",
      });
    });

    it("names an unreadable folder of the design system instead of crashing", { skip: process.getuid?.() === 0 }, () => {
      const folder = path.join(tmp, UI, "journeys");
      fs.chmodSync(folder, 0o000);
      try {
        assert.deepEqual(validate(tmp), { code: 1, out: text(1, 0, [`${UI}/journeys U1 => make it readable, or remove it`]).split("\n"), err: "" });
      } finally {
        fs.chmodSync(folder, 0o755);
      }
    });
  });
});
