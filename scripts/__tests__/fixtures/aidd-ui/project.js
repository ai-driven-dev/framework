const fs = require("node:fs");
const path = require("node:path");

// One complete, valid aidd-ui project: every record kind, tokens, renders, and the code they
// link to. Each validator test writes it, breaks one thing, and expects exactly one problem.

const UI = "aidd_docs/ui";

const history = (...rows) =>
  ["## History", "", "| Version | Change | Breaking | Task |", "| --- | --- | --- | --- |", ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");

const FIRST_ROW = ["1", "created", "no", "ds-init"];

const record = (frontMatter, ...sections) => `---\n${frontMatter.join("\n")}\n---\n\n${sections.join("\n\n")}\n`;

const KEYBOARD = "## Keyboard\n\nTab focuses it, Enter or Space activates it.";

const usage = (when) => `## Usage\n\n${when}`;

const SYSTEM = record(
  [
    "id: system",
    "kind: system",
    "status: validated",
    "version: 2.0.0",
    "platforms: [web]",
    "breakpoints: [mobile, desktop]",
    "themes: [light, dark]",
    "locales: [fr, ar]",
    "directions: [ltr, rtl]",
    "primitives: [color.brand]",
    "code-roots: [src/ui]",
    "ignore: [src/ui/tokens.css]",
    "libraries: [@radix-ui/react-dialog]",
  ],
  "# Design system",
  "## Breakpoints\n\n| Name | From |\n| --- | --- |\n| mobile | 0 |\n| desktop | 64rem |",
  history(["1.0.0", "first system", "no", "ds-init"], ["2.0.0", "old-button retired", "yes", "retire-old-button"])
);

const BRAND = record(
  ["id: brand", "kind: brand", "status: validated", "version: 1"],
  "# Brand",
  "## Project\n\nA search tool.",
  "## Users\n\nAnalysts.",
  "## Domain\n\nPublic records.",
  "## Platforms\n\nWeb.",
  "## Personality and tone\n\nPlain and calm.",
  "## Imposed charter\n\nNone.",
  "## References\n\nA library catalogue.",
  "## Anti-references\n\nA casino.",
  history(FIRST_ROW)
);

const TOKENS = {
  color: {
    $type: "color",
    brand: {
      primary: {
        $value: { colorSpace: "srgb", components: [0.2, 0.4, 0.6], hex: "#336699" },
        $extensions: {
          "dev.ai-driven.themes": { dark: { colorSpace: "srgb", components: [0.4, 0.6, 0.8], hex: "#6699cc" } },
        },
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

const ICON = record(
  ["id: icon-search", "kind: asset", "status: validated", "version: 1", "type: icon", "file: icon-search.svg", "alt: Search"],
  "# Search icon",
  history(FIRST_ROW)
);

const ICON_FILE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="10" cy="10" r="7"/></svg>\n';

const BUTTON = record(
  [
    "id: button",
    "kind: atom",
    "status: coded",
    "version: 1",
    "uses: []",
    "tokens: [color.action.default, color.text.default, space.md, border.thin, motion.fast, font.body, font.weight.bold]",
    "variants: [primary, secondary]",
    "states: [default, hover, focus, disabled]",
    "interactive: yes",
    "role: button",
    "code: src/ui/Button.tsx#Button",
  ],
  "# Button",
  usage("Any action a person starts; never for navigation."),
  KEYBOARD,
  history(FIRST_ROW)
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
    "interactive: yes",
    "role: search",
  ],
  "# Search field",
  usage("Searching a list; never for a form field."),
  KEYBOARD,
  history(FIRST_ROW)
);

const DIALOG = record(
  [
    "id: dialog",
    "kind: composition",
    "status: coded",
    "version: 1",
    "uses: [button]",
    "tokens: [space.md]",
    "variants: [default]",
    "states: [default, hover, focus, disabled]",
    "interactive: yes",
    "role: dialog",
    "code: package:@radix-ui/react-dialog#Root",
  ],
  "# Dialog",
  usage("A decision that blocks the page."),
  "## Keyboard\n\nEscape closes it; focus stays inside while it is open.",
  history(FIRST_ROW)
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
    "interactive: no",
    "role: button",
    "replaced-by: button",
  ],
  "# Old button",
  usage("Nowhere: replaced by button."),
  history(FIRST_ROW, ["2", "deprecated for button", "yes", "retire-old-button"])
);

const HOME = record(
  [
    "id: home",
    "kind: screen",
    "status: coded",
    "version: 1",
    "uses: [search-field, dialog]",
    "states: [default, empty, loading, error]",
    "breakpoints: [mobile, desktop]",
    "route: /",
    "code: src/ui/HomePage.tsx#HomePage",
  ],
  "# Home",
  history(FIRST_ROW)
);

const ONBOARDING = record(
  ["id: onboarding", "kind: journey", "status: validated", "version: 1", "persona: a first-time analyst"],
  "# Onboarding",
  "## Steps\n\n| Screen | Action |\n| --- | --- |\n| home | types a query |\n| home | opens a result |",
  history(FIRST_ROW)
);

const REVIEW = record(
  ["id: first-pass", "kind: review", "status: proposed", "version: 1", "scope: system", "screens: [home]"],
  "# First pass",
  [
    "## Verdicts",
    "",
    "| Screen | State | Verdict | Comment |",
    "| --- | --- | --- | --- |",
    "| home | default | ok | |",
    "| home | empty | ok | |",
    "| home | loading | ko | spinner too small |",
    "| home | error | pending | |",
  ].join("\n"),
  history(FIRST_ROW)
);

const STYLE = [
  ".ui {",
  "  padding-block: var(--space-md);",
  "  padding-inline: var(--space-md);",
  "  margin-inline-start: 0;",
  "  color: var(--color-text-default);",
  "  background: var(--color-brand-primary);",
  "  border: var(--border-thin) solid var(--color-brand-primary);",
  "  font-family: var(--font-body);",
  "  font-weight: var(--font-weight-bold);",
  "  transition: background var(--motion-fast);",
  "  text-align: start;",
  "}",
].join("\n");

const render = (title, body) =>
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>${title}</title>\n<style>\n${STYLE}\n</style>\n</head>\n<body>\n${body.join("\n")}\n</body>\n</html>\n`;

const statesOf = (variant, states) =>
  states.map((state) => `<button class="ui" data-variant="${variant}" data-state="${state}">Search</button>`);

const RENDERS = {
  "components/button.html": render("button", [
    ...statesOf("primary", ["default", "hover", "focus", "disabled"]),
    ...statesOf("secondary", ["default", "hover", "focus", "disabled"]),
  ]),
  "components/search-field.html": render("search-field", statesOf("default", ["default", "hover", "focus", "disabled"])),
  "components/dialog.html": render("dialog", statesOf("default", ["default", "hover", "focus", "disabled"])),
  "components/old-button.html": render("old-button", statesOf("default", ["default"])),
  "screens/home.html": render(
    "home",
    ["default", "empty", "loading", "error"].map((state) => `<section class="ui" data-state="${state}">Home, ${state}</section>`)
  ),
};

const CODE = {
  "src/ui/Button.tsx": 'export function Button() {\n  return <button className="ui">Search</button>;\n}\n',
  "src/ui/HomePage.tsx": 'import { Button } from "./Button";\n\nexport function HomePage() {\n  return <main className="ui"><Button /></main>;\n}\n',
  "src/ui/tokens.css": ":root {\n  --color-brand-primary: #336699;\n  --space-md: 1rem;\n}\n",
};

const FILES = {
  [`${UI}/system.md`]: SYSTEM,
  [`${UI}/brand.md`]: BRAND,
  [`${UI}/tokens.json`]: `${JSON.stringify(TOKENS, null, 2)}\n`,
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

/** Writes the valid project under `dir`. */
function writeProject(dir) {
  for (const [name, content] of Object.entries(FILES)) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
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
}

/** Writes one file of the project. */
function put(dir, name, content) {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

module.exports = { UI, writeProject, edit, editTokens, put, record, history };
