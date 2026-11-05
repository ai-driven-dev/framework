const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, PATHS, HOOKS, LIB, ENGINE, HOOK, makeTmp, removeTmp, lines, validate, writeProject, edit, editTokens, propose } = require("../fixtures/aidd-ui/project.js");

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
  const run = spawnSync(process.execPath, [HOOK], { input, encoding: "utf8", env });
  return { code: run.status, out: run.stdout, err: run.stderr };
}

// The plugin tree ships Claude Code's host adapter, so these payloads are Claude Code's. Every
// other host reaches the hook through its own adapter, tested where the adapters live.
/** A Write of the file as it now stands, the whole of it being the write's. */
const postToolUse = (filePath) => {
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  return JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, session_id: sid, tool_name: "Write", tool_input: { file_path: filePath, content }, tool_response: {} });
};
const shell = (command) => JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, session_id: sid, tool_name: "Bash", tool_input: { command }, tool_response: {} });
const marked = () => fs.existsSync(markPath(sid));
const sessionStart = () => JSON.stringify({ hook_event_name: "SessionStart", cwd: tmp, source: "startup" });
const stop = (active = false) => JSON.stringify({ hook_event_name: "Stop", cwd: tmp, session_id: sid, stop_hook_active: active });
const silent = { code: 0, out: "", err: "" };
/** The one text every host gets: the count line, then the lines. */
const text = (errors, warnings, lines) => [`aidd-ui: ${errors} errors, ${warnings} warnings`, ...lines].join("\n");
/** The text of `lines` that are all errors. */
const errorsText = (lines) => text(lines.length, 0, lines);
// Claude Code reads additionalContext under hookSpecificOutput, and a block's reason at Stop.
const claudeFeedback = (report) => ({ code: 0, out: `${JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: report } })}\n`, err: "" });
const finish = (report) => ({ code: 0, out: `${JSON.stringify({ decision: "block", reason: report })}\n`, err: "" });
/** A render holding `errors` colour literals and `warnings` hairlines, one line each, from line 28. */
const littering = (errors, warnings) => edit(tmp, RENDER, "</body>", `${'<p style="color: #000000">x</p>\n'.repeat(errors)}${'<p style="border-width: 1px">x</p>\n'.repeat(warnings)}</body>`);
const literal = (line) => `${RENDER}:${line} V4 "#000000" => replace it with a token`;
const hairline = (line) => `${RENDER}:${line} V6 warning literal "1px", only tokens carry values => replace it with a token`;
const range = (from, count) => Array.from({ length: count }, (_, index) => from + index);

// The plugin's own declaration: every host builds its hooks from this file, so a missing event
// here means no install runs that check.
describe("aidd-ui hooks declaration", () => {
  const declared = JSON.parse(fs.readFileSync(path.join(HOOKS, "hooks.json"), "utf8")).hooks;

  // The host adapter reads only these tools; a hook fired for another would read nothing.
  it("fires after the tools the host adapter reads, a shell command among them since the engine writes through one", () => {
    assert.deepEqual(declared.PostToolUse.map((group) => group.matcher), ["Write|Edit|Bash"]);
  });

  it("bounds every hook to the contract's 5 seconds", () => {
    const timeouts = Object.values(declared).flatMap((groups) => groups.flatMap((group) => group.hooks.map((hook) => hook.timeout)));
    assert.deepEqual([...new Set(timeouts)], [5]);
  });

  it("runs the hook at every moment it handles: session start, after a write, turn end", () => {
    for (const event of ["SessionStart", "PostToolUse", "Stop"]) {
      const commands = declared[event].flatMap((group) => group.hooks.map((hook) => hook.command));
      assert.deepEqual(commands, [`node \${CLAUDE_PLUGIN_ROOT}/hooks/ui-hook.cjs`]);
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
          "aidd-ui: 1 errors, 1 warnings",
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
      assert.deepEqual({ code: run.status, out: run.stdout, err: run.stderr }, { code: 2, out: "", err: "usage: node aidd-ui.cjs <validate|tokens> [project-root]\n       node aidd-ui.cjs impact <id or token>… [--root <dir>]\n       node aidd-ui.cjs extract [--force] [--root <dir>]\n       node aidd-ui.cjs bump --task <aidd_docs/tasks/…> (--change \"<text>\" [--breaking] | --created | --removed) <token or id>… [--root <dir>]\n       node aidd-ui.cjs publish ([--breaking] | <id>…) [--root <dir>]\n" });
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

    it("regenerates a stylesheet the tokens left behind", () => {
      propose(tmp, DIALOG, SEARCH, HOME);
      edit(tmp, TOKENS, '"value": 1,', '"value": 2,');
      assert.equal(validate(tmp).code, 1);
      generate(tmp);
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
        assert.deepEqual(generate(tmp).out, ["aidd-ui: 1 errors, 0 warnings", `${RESOLVER} T6 "desktop" => give it a Query in system.md, then run node <engine> tokens`]);
      });
    });

    it("writes nothing, names the error and exits 1 while the tokens have one", () => {
      fs.rmSync(path.join(tmp, STYLESHEET));
      editTokens(tmp, (tree) => (tree.space.md.$value = { value: 1, unit: "em" }));
      assert.deepEqual(generate(tmp), { code: 1, out: ["aidd-ui: 1 errors, 0 warnings", TOKENS_FAILURE], err: "", css: null });
    });

    it("writes nothing, names the token and exits 1 for a composite without raw CSS", () => {
      fs.rmSync(path.join(tmp, STYLESHEET));
      editTokens(tmp, (tree) => (tree.elevation = { low: { $type: "shadow", $value: { color: "#000000" } } }));
      assert.deepEqual(generate(tmp), {
        code: 1,
        out: ["aidd-ui: 1 errors, 0 warnings", `${TOKENS} T10 "elevation.low" => give it a dev.ai-driven.css value`],
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
      assert.deepEqual(validate(tmp), { code: 1, out: ["aidd-ui: 1 errors, 0 warnings", `${UI}/system.md U3 "2" => rewrite the design system for format 1`], err: "" });
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

    it("names nothing of the record citing the written one after the write, and names it at Stop", () => {
      edit(tmp, RECORD, "kind: atom", "kind: composition");
      assert.deepEqual(hook(postToolUse(path.join(tmp, RECORD))), silent);
      assert.deepEqual(hook(stop()), finish(errorsText([`${UI}/components/search-field.md R6 "button" => use only elements of its own level or lower`])));
    });

    it("names the written record's errors after the write, and its render's at Stop", () => {
      edit(tmp, RECORD, "variants: [primary, secondary]", "variants: [primary, secondary, ghost]");
      edit(tmp, RECORD, "## Usage\n\nAny action a person starts; never for navigation.\n\n", "");
      assert.deepEqual(hook(postToolUse(path.join(tmp, RECORD))), claudeFeedback(errorsText([R17])));
      assert.deepEqual(hook(stop()), finish(errorsText([R17, V2_GHOST])));
    });

    it("names the code's colour errors at Stop after a write to code-debt.json, which every code file reads", () => {
      colourInCode();
      assert.deepEqual(hook(postToolUse(path.join(tmp, UI, "code-debt.json"))), silent);
      assert.deepEqual(hook(stop()), finish(errorsText([COLOUR])));
    });

    it("names the written tokens' errors after the write, and every other at Stop, every record reading them", () => {
      breakOnePerFamily();
      assert.deepEqual(hook(postToolUse(path.join(tmp, TOKENS))), claudeFeedback(errorsText([TOKENS_FAILURE])));
      assert.deepEqual(hook(stop()), finish(errorsText([TOKENS_FAILURE, BRAND_FAILURE, DIALOG_FAILURE])));
    });

    describe("the reached errors are grouped at Stop, the written ones are not", () => {
      const GROUP = `R17 ×3 in ${UI}/components/* => add a "## Usage" section saying when to use it and when not`;
      const usageless = () => {
        propose(tmp, SEARCH, DIALOG);
        edit(tmp, BUTTON, "## Usage\n\nAny action a person starts; never for navigation.\n\n", "");
        edit(tmp, SEARCH, "## Usage\n\nSearching a list; never for a form field.\n\n", "");
        edit(tmp, DIALOG, "## Usage\n\nA decision that blocks the page.\n\n", "");
      };
      const T4 = (name) => `${TOKENS} T4 "${name}" => set the unit to px or rem`;

      it("groups by rule, fix and folder the errors of the files a shared file reaches", () => {
        usageless();
        assert.deepEqual(hook(postToolUse(path.join(tmp, TOKENS))), silent);
        assert.deepEqual(hook(stop()), finish(text(3, 0, [GROUP])));
      });

      it("prints each error of the written files on its own line, beside the groups", () => {
        usageless();
        editTokens(tmp, (tree) => {
          tree.space.md.$value = { value: 1, unit: "em" };
          tree.border.thin.$value = { value: 1, unit: "em" };
        });
        assert.deepEqual(hook(postToolUse(path.join(tmp, TOKENS))), claudeFeedback(text(2, 0, [T4("space.md"), T4("border.thin")])));
        assert.deepEqual(hook(stop()), finish(text(5, 0, [T4("space.md"), T4("border.thin"), GROUP])));
      });
    });

    describe("an edit answers for the lines it added or changed", () => {
      const editTool = (file, from, to) => {
        edit(tmp, file, from, to);
        return JSON.stringify({ hook_event_name: "PostToolUse", cwd: tmp, session_id: sid, tool_name: "Edit", tool_input: { file_path: path.join(tmp, file), old_string: from, new_string: to }, tool_response: {} });
      };

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
    it("blocks once after a write under aidd_docs/ui/, with the errors of what it reached as the reason", () => {
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, BRAND)));
      assert.deepEqual(hook(stop()), finish(errorsText([BRAND_FAILURE])));
    });

    it("blocks on every error once a shell command also marked the turn, whatever the writes reached", () => {
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, BRAND)));
      hook(shell(`node ${ENGINE} tokens ${tmp}`));
      assert.deepEqual(hook(stop()), finish(errorsText([BRAND_FAILURE, TOKENS_FAILURE, DIALOG_FAILURE])));
    });

    it("blocks on every error when the mark names no file", () => {
      breakOnePerFamily();
      fs.mkdirSync(stateFolder(), { recursive: true, mode: 0o700 });
      fs.writeFileSync(markPath(sid), "", { mode: 0o600 });
      assert.deepEqual(hook(stop()), finish(errorsText(FAILURES)));
    });

    it("blocks with every error of the listed files, none cut, and no warning", () => {
      littering(12, 3);
      hook(postToolUse(path.join(tmp, RENDER)));
      assert.deepEqual(hook(stop()), finish(errorsText(range(28, 12).map(literal))));
    });

    it("groups the errors outside the listed files when a shell command left the turn unknown", () => {
      propose(tmp, SEARCH, DIALOG);
      for (const [file, when] of [[BUTTON, "Any action a person starts; never for navigation."], [SEARCH, "Searching a list; never for a form field."], [DIALOG, "A decision that blocks the page."]]) edit(tmp, file, `## Usage\n\n${when}\n\n`, "");
      hook(shell(`node ${ENGINE} tokens ${tmp}`));
      assert.deepEqual(hook(stop()), finish(text(3, 0, [`R17 ×3 in ${UI}/components/* => add a "## Usage" section saying when to use it and when not`])));
    });

    it("lets the turn end on the repeated Stop, the one it asked for", () => {
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, BRAND)));
      hook(stop());
      assert.deepEqual(hook(stop(true)), silent);
    });

    it("ends the forced turn even when that turn writes a UI file again", () => {
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, BRAND)));
      hook(stop());
      hook(postToolUse(path.join(tmp, BRAND)));
      assert.deepEqual(hook(stop(true)), silent);
    });

    it("hands the problems back on a second write in the same turn", () => {
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, BRAND)));
      assert.deepEqual(hook(postToolUse(path.join(tmp, BRAND))), claudeFeedback(errorsText([BRAND_FAILURE])));
    });

    it("still hands the problems back when the turn mark cannot be written", () => {
      breakOnePerFamily();
      const run = spawnSync(process.execPath, [HOOK], { input: postToolUse(path.join(tmp, BRAND)), encoding: "utf8", env: { ...process.env, TMPDIR: path.join(tmp, "no-such-dir"), TMP: path.join(tmp, "no-such-dir"), TEMP: path.join(tmp, "no-such-dir") } });
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

    it("keeps the mark in <tmpdir>/aidd-hooks-<uid>/aidd-ui/<session>, one watched path per line", () => {
      const temp = path.join(tmp, "temp");
      fs.mkdirSync(temp);
      hook(postToolUse(path.join(tmp, BRAND)), temp);
      assert.equal(fs.readFileSync(markPath(sid, temp), "utf8"), `${BRAND}\n`);
    });

    it("keeps its folders to their owner, the mark to its owner alone", { skip: process.platform === "win32" }, () => {
      const temp = path.join(tmp, "temp");
      fs.mkdirSync(temp);
      hook(postToolUse(path.join(tmp, BRAND)), temp);
      const mode = (file) => fs.statSync(file).mode & 0o777;
      assert.deepEqual([mode(path.dirname(stateFolder(temp))), mode(stateFolder(temp)), mode(markPath(sid, temp))], [0o700, 0o700, 0o600]);
    });

    it("marks a shell command that may have written any file with the line unknown", () => {
      const temp = path.join(tmp, "temp");
      fs.mkdirSync(temp);
      hook(shell(`node ${ENGINE} tokens ${tmp}`), temp);
      assert.equal(fs.readFileSync(markPath(sid, temp), "utf8"), "unknown\n");
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
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, BRAND)));
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
      breakOnePerFamily();
      hook(postToolUse(path.join(tmp, BRAND)));
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
      const run = spawnSync(process.execPath, [path.join(hooks, "ui-hook.cjs")], { input, encoding: "utf8" });
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
    it("names nothing of a file the write deleted, and at Stop what the records citing it lost", () => {
      fs.rmSync(path.join(tmp, BUTTON));
      const citer = new RegExp(`R6 ×2 in ${UI}/components/\\* \\\\"button\\\\" => remove it from uses`);
      assert.deepEqual(write([BUTTON]), silent);
      assert.match(neutral("Stop").out, citer);
    });

    it("continues the turn once at Stop after a write, through continueTurn", () => {
      breakOnePerFamily();
      write([BRAND]);
      assert.deepEqual(neutral("Stop"), continues(errorsText([BRAND_FAILURE])));
      assert.deepEqual(neutral("Stop"), silent);
    });

    it("marks the turn for a command that runs the engine, which names no file", () => {
      breakOnePerFamily();
      assert.deepEqual(neutral("PostToolUse", { command: `node ${ENGINE} tokens` }), silent);
      assert.deepEqual(neutral("Stop"), continues(errorsText(FAILURES)));
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
        const run = spawnSync(process.execPath, [path.join(hooks, "ui-hook.cjs")], { input, encoding: "utf8", cwd: tmp });
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
      const run = spawnSync(process.execPath, [path.join(hooks, "ui-hook.cjs")], { input: "", encoding: "utf8" });
      assert.deepEqual({ code: run.status, out: run.stdout, err: run.stderr }, silent);
    });
  });

  describe("E11 engine commands", () => {
    const ENGINE_COMMANDS = [
      ["runs the engine", `node ${ENGINE} tokens ${tmp}`],
      ["runs the engine installed flat", "node .claude/hooks/aidd-ui/aidd-ui.cjs bump --task aidd_docs/tasks/x --change y color.brand.primary"],
      ["names aidd_docs/ui/ and writes", "sed -i s/a/b/ aidd_docs/ui/brand.md"],
    ];
    for (const [name, command] of ENGINE_COMMANDS) {
      it(`marks the turn and prints nothing when a shell command ${name}, so Stop blocks once on what it left`, () => {
        breakOnePerFamily();
        assert.deepEqual(hook(shell(command)), silent);
        assert.equal(marked(), true);
        assert.deepEqual(hook(stop()), finish(errorsText([BRAND_FAILURE, TOKENS_FAILURE, DIALOG_FAILURE])));
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
      fs.writeFileSync(old, "unknown\n");
      fs.writeFileSync(fresh, "unknown\n");
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
