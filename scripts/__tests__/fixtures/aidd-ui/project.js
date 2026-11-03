const fs = require("node:fs");
const path = require("node:path");

// One complete, valid aidd-ui project: every record kind, tokens, renders, and the code they
// link to. Each validator test writes it, breaks one thing, and expects exactly one problem.

const UI = "aidd_docs/ui";

const history = (...rows) =>
  ["## History", "", "| Version | Change | Breaking | Task |", "| --- | --- | --- | --- |", ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");

const FIRST_ROW = ["1", "created", "no", "aidd_docs/tasks/ds-init"];

const record = (frontMatter, ...sections) => `---\n${frontMatter.join("\n")}\n---\n\n${sections.join("\n\n")}\n`;

const KEYBOARD = "## Keyboard\n\nTab focuses it, Enter or Space activates it.";

const usage = (when) => `## Usage\n\n${when}`;

const BUTTON_TOKENS = ["color.action.default", "color.text.default", "space.md", "border.thin", "motion.fast", "font.body", "font.weight.bold"];

const SYSTEM = record(
  [
    "id: system",
    "kind: system",
    "status: validated",
    "version: 2.0.0",
    "format: 1",
    "platforms: [web]",
    "breakpoints: [mobile, desktop]",
    "themes: [light, dark]",
    "locales: [fr, ar]",
    "directions: [ltr, rtl]",
    "primitives: [color.brand]",
    "code-roots: [src/ui]",
    "code-tokens: src/ui/tokens.css",
    "ignore: [src/ui/vendor]",
    "libraries: [@radix-ui/react-dialog]",
  ],
  "# Design system",
  "## Breakpoints\n\n| Name | From |\n| --- | --- |\n| mobile | 0 |\n| desktop | 64rem |",
  history(["1.0.0", "first system", "no", "aidd_docs/tasks/ds-init"], ["2.0.0", "old-button retired", "yes", "aidd_docs/tasks/retire-old-button"])
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

const RESOLVER = {
  version: "2025.10",
  sets: { base: { sources: [{ $ref: "tokens.json" }] } },
  modifiers: { theme: { contexts: { light: [], dark: [{ $ref: "themes/dark.json" }] }, default: "light" } },
  resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/theme" }],
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
    "status: validated",
    "version: 1",
    "implemented-version: 1",
    "uses: []",
    `tokens: [${BUTTON_TOKENS.join(", ")}]`,
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
    "status: validated",
    "version: 1",
    "implemented-version: 1",
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
  history(FIRST_ROW, ["2", "deprecated for button", "yes", "aidd_docs/tasks/retire-old-button"])
);

const HOME = record(
  [
    "id: home",
    "kind: screen",
    "status: validated",
    "version: 1",
    "implemented-version: 1",
    "uses: [search-field, dialog]",
    "tokens: [space.md, color.text.default]",
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
    "| Screen | State | Version | Verdict | Comment |",
    "| --- | --- | --- | --- | --- |",
    "| home | default | 1 | ok | |",
    "| home | empty | 1 | ok | |",
    "| home | loading | 1 | ko | spinner too small |",
    "| home | error | 1 | pending | |",
  ].join("\n"),
  history(FIRST_ROW)
);

/** A render's style: one custom property per token its record declares, so it uses them all
 * and nothing else. */
const style = (tokens) => [".ui {", ...tokens.map((token, index) => `  --use-${index}: var(--${token.replaceAll(".", "-")});`), "}"].join("\n");

const render = (title, tokens, body) =>
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>${title}</title>\n<style>\n${style(tokens)}\n</style>\n</head>\n<body>\n${body.join("\n")}\n</body>\n</html>\n`;

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
  [`${UI}/tokens.json`]: `${JSON.stringify(TOKENS, null, 2)}\n`,
  [`${UI}/tokens.resolver.json`]: `${JSON.stringify(RESOLVER, null, 2)}\n`,
  [`${UI}/themes/dark.json`]: `${JSON.stringify(DARK, null, 2)}\n`,
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
