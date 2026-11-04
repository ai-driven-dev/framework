const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HOOKS = path.resolve(__dirname, "../../../../plugins/aidd-ui/hooks");
const LIB = path.join(HOOKS, "lib");
const ENGINE = path.join(HOOKS, "aidd-ui.cjs");
const HOOK = path.join(HOOKS, "ui-hook.cjs");
const { load } = require(path.join(LIB, "project.cjs"));
const tokensCheck = require(path.join(LIB, "tokens.cjs"));

// One complete, valid aidd-ui project: every record kind, tokens, renders, and the code they
// link to. Each validator test writes it, breaks one thing, and expects exactly one problem.

const UI = "aidd_docs/ui";

const HISTORY = `${UI}/history.md`;

/** The files of the valid project that more than one spec names. */
const PATHS = {
  SYSTEM: `${UI}/system.md`,
  BRAND: `${UI}/brand.md`,
  TOKENS: `${UI}/tokens.json`,
  RESOLVER: `${UI}/tokens.resolver.json`,
  STYLESHEET: `${UI}/tokens.css`,
  DARK: `${UI}/themes/dark.json`,
  DESKTOP: `${UI}/breakpoints/desktop.json`,
  BUTTON: `${UI}/components/button.md`,
  SEARCH: `${UI}/components/search-field.md`,
  DIALOG: `${UI}/components/dialog.md`,
  OLD: `${UI}/components/old-button.md`,
  HOME: `${UI}/screens/home.md`,
  JOURNEY: `${UI}/journeys/onboarding.md`,
  ICON: `${UI}/assets/icon-search.md`,
  REVIEW: `${UI}/reviews/first-pass.md`,
  BUTTON_RENDER: `${UI}/components/button.html`,
  DIALOG_RENDER: `${UI}/components/dialog.html`,
  HOME_RENDER: `${UI}/screens/home.html`,
};

const row = (...cells) => `| ${cells.join(" | ")} |`;

/** history.md for these rows, each `[id, version, change, breaking, task]`. */
const history = (...rows) => ["# History", "", "| Id | Version | Change | Breaking | Task |", "| --- | --- | --- | --- | --- |", ...rows.map((each) => row(...each))].join("\n") + "\n";

const TASK = "aidd_docs/tasks/ds-init";
const created = (id) => [id, "1", "created", "no", TASK];

const ROWS = [
  ["system", "1.0.0", "first system", "no", TASK],
  ["system", "2.0.0", "old-button retired", "yes", "aidd_docs/tasks/retire-old-button"],
  ...["icon-search", "button", "search-field", "dialog", "old-button", "home", "onboarding", "first-pass"].map(created),
  ["old-button", "2", "deprecated for button", "yes", "aidd_docs/tasks/retire-old-button"],
];

const record = (frontMatter, ...sections) => `---\n${frontMatter.join("\n")}\n---\n\n${sections.join("\n\n")}\n`;

const KEYBOARD = "## Keyboard\n\nTab focuses it, Enter or Space activates it.";

const usage = (when) => `## Usage\n\n${when}`;

const BUTTON_TOKENS = ["color.action.default", "color.text.default", "space.md", "border.thin", "motion.fast", "font.body", "font.weight.bold"];

const SYSTEM = record(
  [
    "id: system",
    "kind: system",
    "format: 1",
    "platforms: [web]",
    "themes: [light, dark]",
    "locales: [fr, ar]",
    "primitives: [color.brand]",
    "code-roots: [src/ui]",
    "code-tokens: src/ui/tokens.css",
    "ignore: [src/ui/vendor]",
  ],
  "# Design system",
  "## Breakpoints\n\n| Name | Query |\n| --- | --- |\n| mobile | |\n| desktop | (min-width: 64rem) |"
);

const BRAND = record(
  ["id: brand", "kind: brand"],
  "# Brand",
  "## Project\n\nA search tool.",
  "## Users\n\nAnalysts.",
  "## Domain\n\nPublic records.",
  "## Platforms\n\nWeb.",
  "## Personality and tone\n\nPlain and calm.",
  "## Imposed charter\n\nNone.",
  "## References\n\nA library catalogue.",
  "## Anti-references\n\nA casino."
);

const TOKENS = {
  color: {
    $type: "color",
    brand: {
      primary: {
        $value: { colorSpace: "srgb", components: [0.2, 0.4, 0.6], hex: "#336699" },
      },
    },
    text: { default: { $value: "{color.brand.primary}" } },
    action: { default: { $value: "{color.brand.primary}" } },
  },
  space: { md: { $type: "dimension", $value: { value: 1, unit: "rem" } } },
  border: { thin: { $type: "dimension", $value: { value: 0.0625, unit: "rem" } } },
  motion: { fast: { $type: "duration", $value: { value: 150, unit: "ms" } } },
  font: {
    body: { $type: "fontFamily", $value: ["Inter", "sans-serif"] },
    weight: { bold: { $type: "fontWeight", $value: 700 } },
  },
};

// The dark theme redefines one base token; the Resolver names its file.
const DARK = { color: { brand: { primary: { $value: { colorSpace: "srgb", components: [0.4, 0.6, 0.8], hex: "#6699cc" } } } } };

// Desktop redefines one base token; mobile, the modifier's default, is tokens.json itself.
const DESKTOP = { space: { md: { $value: { value: 1.5, unit: "rem" } } } };

const RESOLVER = {
  version: "2025.10",
  sets: { base: { sources: [{ $ref: "tokens.json" }] } },
  modifiers: {
    theme: { contexts: { light: [], dark: [{ $ref: "themes/dark.json" }] }, default: "light" },
    breakpoint: {
      contexts: { mobile: [], desktop: [{ $ref: "breakpoints/desktop.json" }] },
      default: "mobile",
      $extensions: { "dev.ai-driven.media": { desktop: "(min-width: 64rem)" } },
    },
  },
  resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/theme" }, { $ref: "#/modifiers/breakpoint" }],
};

const ICON = record(
  ["id: icon-search", "kind: asset", "status: validated", "version: 1", "type: icon", "file: icon-search.svg", "alt: Search"],
  "# Search icon"
);

const ICON_FILE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="10" cy="10" r="7"/></svg>\n';

const BUTTON = record(
  [
    "id: button",
    "kind: atom",
    "status: validated",
    "version: 1",
    "uses: []",
    `tokens: [${BUTTON_TOKENS.join(", ")}]`,
    "variants: [primary, secondary]",
    "states: [default, hover, focus, disabled]",
    "role: button",
    "code: src/ui/Button.tsx#Button@1",
  ],
  "# Button",
  usage("Any action a person starts; never for navigation."),
  KEYBOARD
);

const SEARCH_FIELD = record(
  [
    "id: search-field",
    "kind: molecule",
    "status: validated",
    "version: 1",
    "uses: [button, icon-search]",
    "tokens: [space.md, color.text.default]",
    "variants: [default]",
    "states: [default, hover, focus, disabled]",
    "role: search",
  ],
  "# Search field",
  usage("Searching a list; never for a form field."),
  KEYBOARD
);

const DIALOG = record(
  [
    "id: dialog",
    "kind: composition",
    "status: validated",
    "version: 1",
    "uses: [button]",
    "tokens: [space.md]",
    "variants: [default]",
    "states: [default, hover, focus, disabled]",
    "role: dialog",
    "code: package:@radix-ui/react-dialog#Root@1",
  ],
  "# Dialog",
  usage("A decision that blocks the page."),
  "## Keyboard\n\nEscape closes it; focus stays inside while it is open."
);

const OLD_BUTTON = record(
  [
    "id: old-button",
    "kind: atom",
    "status: deprecated",
    "version: 2",
    "uses: []",
    "tokens: [color.action.default]",
    "variants: [default]",
    "states: [default]",
    "role: button",
    "replaced-by: button",
  ],
  "# Old button",
  usage("Nowhere: replaced by button.")
);

const HOME = record(
  [
    "id: home",
    "kind: screen",
    "status: validated",
    "version: 1",
    "uses: [search-field, dialog]",
    "tokens: [space.md, color.text.default]",
    "states: [default, empty, loading, error]",
    "breakpoints: [mobile, desktop]",
    "route: /",
    "code: src/ui/HomePage.tsx#HomePage@1",
  ],
  "# Home"
);

const ONBOARDING = record(
  ["id: onboarding", "kind: journey", "status: validated", "version: 1", "persona: a first-time analyst"],
  "# Onboarding",
  "## Steps\n\n| Screen | Action |\n| --- | --- |\n| home | types a query |\n| home | opens a result |"
);

const REVIEW = record(
  ["id: first-pass", "kind: review", "status: proposed", "version: 1", "scope: system", "screens: [home]"],
  "# First pass",
  [
    "## Verdicts",
    "",
    "| Screen | State | Version | Verdict | Comment |",
    "| --- | --- | --- | --- | --- |",
    "| home | default | 1 | ok | |",
    "| home | empty | 1 | ok | |",
    "| home | loading | 1 | ko | spinner too small |",
    "| home | error | 1 | pending | |",
  ].join("\n")
);

/** A render's style: one custom property per token its record declares, so it uses them all
 * and nothing else. */
const style = (tokens) => [".ui {", ...tokens.map((token, index) => `  --use-${index}: var(--${token.replaceAll(".", "-")});`), "}"].join("\n");

const render = (title, tokens, body) =>
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>${title}</title>\n<link rel="stylesheet" href="../tokens.css">\n<style>\n${style(tokens)}\n</style>\n</head>\n<body>\n${body.join("\n")}\n</body>\n</html>\n`;

const statesOf = (variant, states) =>
  states.map((state) => `<button class="ui" data-variant="${variant}" data-state="${state}">Search</button>`);

const RENDERS = {
  "components/button.html": render("button", BUTTON_TOKENS, [
    ...statesOf("primary", ["default", "hover", "focus", "disabled"]),
    ...statesOf("secondary", ["default", "hover", "focus", "disabled"]),
  ]),
  "components/search-field.html": render("search-field", ["space.md", "color.text.default"], statesOf("default", ["default", "hover", "focus", "disabled"])),
  "components/dialog.html": render("dialog", ["space.md"], statesOf("default", ["default", "hover", "focus", "disabled"])),
  "components/old-button.html": render("old-button", ["color.action.default"], statesOf("default", ["default"])),
  "screens/home.html": render(
    "home",
    ["space.md", "color.text.default"],
    ["default", "empty", "loading", "error"].map((state) => `<section class="ui" data-state="${state}">Home, ${state}</section>`)
  ),
};

const CODE = {
  "src/ui/Button.tsx": 'export function Button() {\n  return <button className="ui">Search</button>;\n}\n',
  "src/ui/HomePage.tsx": 'import { Button } from "./Button";\n\nexport function HomePage() {\n  return <main className="ui"><Button /></main>;\n}\n',
  "src/ui/tokens.css": ":root {\n  --color-brand-primary: #336699;\n  --space-md: 1rem;\n}\n",
  "src/ui/vendor/reset.css": "body { margin: 0; color: #000000; }\n",
};

const FILES = {
  [`${UI}/system.md`]: SYSTEM,
  [`${UI}/brand.md`]: BRAND,
  [HISTORY]: history(...ROWS),
  [`${UI}/tokens.json`]: `${JSON.stringify(TOKENS, null, 2)}\n`,
  [`${UI}/tokens.resolver.json`]: `${JSON.stringify(RESOLVER, null, 2)}\n`,
  [`${UI}/themes/dark.json`]: `${JSON.stringify(DARK, null, 2)}\n`,
  [`${UI}/breakpoints/desktop.json`]: `${JSON.stringify(DESKTOP, null, 2)}\n`,
  [`${UI}/assets/icon-search.md`]: ICON,
  [`${UI}/assets/icon-search.svg`]: ICON_FILE,
  [`${UI}/components/button.md`]: BUTTON,
  [`${UI}/components/search-field.md`]: SEARCH_FIELD,
  [`${UI}/components/dialog.md`]: DIALOG,
  [`${UI}/components/old-button.md`]: OLD_BUTTON,
  [`${UI}/screens/home.md`]: HOME,
  [`${UI}/journeys/onboarding.md`]: ONBOARDING,
  [`${UI}/reviews/first-pass.md`]: REVIEW,
  ...Object.fromEntries(Object.entries(RENDERS).map(([name, html]) => [`${UI}/${name}`, html])),
  ...CODE,
};

/** Writes `tokens.css` as the engine generates it from the tokens under `dir`; leaves it alone
 * while the tokens cannot be generated, which is a case a test sets up on purpose. */
function generateStylesheet(dir) {
  const project = load(dir);
  if (tokensCheck.blockers(project).length) return;
  const { css } = tokensCheck.generate(project);
  if (css !== null) fs.writeFileSync(path.join(dir, tokensCheck.cssFileOf(project)), css);
}

/** Writes the valid project under `dir`. */
function writeProject(dir) {
  for (const [name, content] of Object.entries(FILES)) put(dir, name, content);
  generateStylesheet(dir);
}

/** Replaces every `from` with `to` in one file of the project, failing when `from` is not
 * there: an edit whose anchor drifted must never pass as a mutation. */
function edit(dir, name, from, to) {
  const file = path.join(dir, name);
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(from)) throw new Error(`${name}: "${from}" not found, the mutation applies to nothing`);
  fs.writeFileSync(file, text.split(from).join(to));
}

/** Rewrites `tokens.json` through `change`, which edits the parsed tree in place. */
function editTokens(dir, change) {
  const file = path.join(dir, UI, "tokens.json");
  const tree = JSON.parse(fs.readFileSync(file, "utf8"));
  change(tree);
  fs.writeFileSync(file, `${JSON.stringify(tree, null, 2)}\n`);
  generateStylesheet(dir);
}

/** Appends rows, each `[id, version, change, breaking, task]`, to history.md. */
function addHistory(dir, ...rows) {
  const file = path.join(dir, HISTORY);
  fs.writeFileSync(file, fs.readFileSync(file, "utf8") + rows.map((each) => `${row(...each)}\n`).join(""));
}

/** Writes one file of the project. */
function put(dir, name, content) {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** A new empty directory in the OS temp dir, its name starting with `prefix`. */
const makeTmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

/** Removes a directory made by `makeTmp`, and proves it is gone. */
function removeTmp(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(fs.existsSync(dir), false);
}

/** Every file under `dir`, whole path. */
const filesUnder = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? filesUnder(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));

/** The engine run as a subprocess from `cwd`, or from here. */
const engineIn = (cwd, ...args) => spawnSync(process.execPath, [ENGINE, ...args], { encoding: "utf8", cwd });
const engine = (...args) => engineIn(undefined, ...args);

const lines = (text) => text.split("\n").filter(Boolean);

/** The `validate` command on `root`: its exit status, its lines and its stderr. */
function validate(root) {
  const run = engine("validate", root);
  return { code: run.status, out: lines(run.stdout), err: run.stderr };
}

/** git in `dir` without the variables a commit hook exports, which would point it at the real repository. */
const git = (dir, ...args) =>
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", ...args], {
    cwd: dir,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
    stdio: "ignore",
  });

/** Makes `dir` a repository whose one commit holds everything in it. */
function commitAll(dir) {
  git(dir, "init", "-q");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "--no-verify", "-m", "snapshot");
}

module.exports = { UI, HISTORY, PATHS, HOOKS, LIB, ENGINE, HOOK, makeTmp, removeTmp, filesUnder, engine, engineIn, lines, validate, addHistory, writeProject, generateStylesheet, edit, editTokens, put, record, history, git, commitAll };
