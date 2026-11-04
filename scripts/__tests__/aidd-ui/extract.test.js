const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, LIB, makeTmp, removeTmp, engine, validate, put, record } = require("../fixtures/aidd-ui/project.js");
const { WEB_CSS, MOBILE_TS } = require("../fixtures/aidd-ui/token-sources.js");

// The extract command is driven as a subprocess, as the skill calls it. Its output is judged by the
// engine itself: `tokens` then `validate` must find no token rule broken in what it wrote.
const { pathsOf } = require(path.join(LIB, "extract.cjs"));
const { fromCss, fromNumber } = require(path.join(LIB, "values.cjs"));
const { objectsOf } = require(path.join(LIB, "script.cjs"));
const { customProperty } = require(path.join(LIB, "css.cjs"));

let tmp;

beforeEach(() => {
  tmp = makeTmp("aidd-ui-extract-");
});

afterEach(() => removeTmp(tmp));

/** Writes `system.md` for these settings and each token file of `files`; `tokens` are the ones it names. */
function setup({ platforms = ["web"], themes = ["light", "dark"], breakpoints = ["mobile", "desktop"], widths = { desktop: "(min-width: 48rem)" }, roots = ["src"], tokens = ["src/tokens.css"], files = { "src/tokens.css": WEB_CSS } } = {}) {
  const rows = breakpoints.map((name, at) => `| ${name} | ${widths[name] ?? (at === 0 ? "below the next" : "")} |`);
  put(
    tmp,
    `${UI}/system.md`,
    record(
      ["id: system", "kind: system", "format: 1", `platforms: [${platforms.join(", ")}]`, `themes: [${themes.join(", ")}]`, "locales: [en]", "primitives: []", `code-roots: [${roots.join(", ")}]`, `code-tokens: [${tokens.join(", ")}]`, "ignore: []"],
      "# Design system",
      `## Breakpoints\n\n| Name | Query |\n| --- | --- |\n${rows.join("\n")}`
    )
  );
  for (const [name, content] of Object.entries(files)) put(tmp, name, content);
}

const extract = (...args) => {
  const done = engine("extract", "--root", tmp, ...args);
  return { code: done.status, report: done.stdout ? JSON.parse(done.stdout) : null, err: done.stderr };
};
const read = (name) => JSON.parse(fs.readFileSync(path.join(tmp, UI, name), "utf8"));
const bytesOf = (names) => names.map((name) => fs.readFileSync(path.join(tmp, name), "utf8")).join("\n====\n");
/** The token rules the engine finds broken after `tokens` has generated the stylesheet. */
function tokenProblems() {
  const generated = engine("tokens", tmp);
  const found = validate(tmp).out.filter((line) => /\(T\d+\)/.test(line));
  return { generated: generated.status, found };
}
const leftNames = (report, why) => report.left.filter((each) => each.why.includes(why)).map((each) => each.name);

describe("aidd-ui extract", () => {
  describe("a stylesheet", () => {
    beforeEach(() => setup());

    it("writes the base, then each context file and the resolver, and lists what it leaves", () => {
      const { code, report, err } = extract();
      assert.equal(code, 0);
      assert.equal(err, "");
      assert.deepEqual(report.written, [`${UI}/tokens.json`, `${UI}/themes/dark.json`, `${UI}/breakpoints/desktop.json`, `${UI}/tokens.resolver.json`]);
      assert.deepEqual(report.left, [
        { file: "src/tokens.css", line: 36, name: "--motion-fast", why: "@media (prefers-reduced-motion: reduce) is no min-width or max-width query" },
        { file: "src/tokens.css", line: 41, name: "--card-pad", why: 'selector ".card" is no :root, html or [data-theme] block' },
      ]);
    });

    it("keeps the value of each shape: colour, length, duration, alias, and the raw CSS DTCG cannot hold", () => {
      extract();
      const tree = read("tokens.json");
      assert.deepEqual(tree.color.ink, { $type: "color", $value: { colorSpace: "srgb", components: [0.1059, 0.1216, 0.1373], hex: "#1b1f23" } });
      assert.deepEqual(tree.color.veil.$value, { colorSpace: "srgb", components: [0.1059, 0.1216, 0.1373], alpha: 0.6 });
      assert.deepEqual(tree.space.sm, { $type: "dimension", $value: { value: 0.5, unit: "rem" } });
      assert.deepEqual(tree.motion.fast, { $type: "duration", $value: { value: 150, unit: "ms" } });
      assert.deepEqual(tree.color.link, { $value: "{color.accent}" });
      assert.deepEqual(tree.color.glow, { $type: "color", $extensions: { "dev.ai-driven.css": "color-mix(in srgb, var(--color-accent) 30%, transparent)" } });
      assert.deepEqual(tree.font.body, { $type: "fontFamily", $extensions: { "dev.ai-driven.css": '"Source Serif 4", Georgia, serif' } });
      assert.deepEqual(tree.space.gutter, { $extensions: { "dev.ai-driven.css": "clamp(1rem, 4vw, 3rem)" } });
      assert.deepEqual(tree.shadow.card, { $extensions: { "dev.ai-driven.css": "0 1px 2px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.08)" } });
    });

    it("joins the rest of a name to the leaf of a shorter token, so each token gives its CSS name back", () => {
      extract();
      assert.deepEqual(Object.keys(read("tokens.json").color), ["ink", "paper", "accent", "accent-hover", "veil", "link", "glow"]);
    });

    it("puts a theme block and a media block in a context file of the resolver, the query verbatim", () => {
      extract();
      assert.deepEqual(Object.keys(read("themes/dark.json").color), ["paper", "ink"]);
      assert.deepEqual(read("breakpoints/desktop.json").space.md.$value, { value: 1.5, unit: "rem" });
      assert.deepEqual(read("tokens.resolver.json"), {
        version: "2025.10",
        sets: { base: { sources: [{ $ref: "tokens.json" }] } },
        modifiers: {
          theme: { default: "light", contexts: { light: [], dark: [{ $ref: "themes/dark.json" }] } },
          breakpoint: { default: "mobile", contexts: { mobile: [], desktop: [{ $ref: "breakpoints/desktop.json" }] }, $extensions: { "dev.ai-driven.media": { desktop: "(min-width: 48rem)" } } },
        },
        resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/theme" }, { $ref: "#/modifiers/breakpoint" }],
      });
    });

    it("writes the resolver the tokens command would write, from the same writer", () => {
      extract();
      const first = bytesOf([`${UI}/tokens.resolver.json`]);
      engine("tokens", tmp);
      assert.equal(bytesOf([`${UI}/tokens.resolver.json`]), first);
    });

    it("leaves a design system whose tokens generate and break no token rule, every source name in the stylesheet", () => {
      extract();
      assert.deepEqual(tokenProblems(), { generated: 0, found: [] });
      const css = fs.readFileSync(path.join(tmp, UI, "tokens.css"), "utf8");
      for (const [, name] of WEB_CSS.slice(0, WEB_CSS.indexOf("[data-theme")).matchAll(/^\s+(--[\w-]+):/gm)) assert.ok(css.includes(`${name}:`), name);
    });

    it("writes the same bytes on a second run", () => {
      const { report } = extract();
      const first = bytesOf(report.written);
      const again = extract("--force");
      assert.deepEqual(again.report, report);
      assert.equal(bytesOf(again.report.written), first);
    });

    it("refuses to replace tokens.json, writing nothing, unless --force is given", () => {
      put(tmp, `${UI}/tokens.json`, "{}\n");
      const refused = extract();
      assert.deepEqual(refused, { code: 2, report: null, err: "aidd-ui: aidd_docs/ui/tokens.json already exists, --force replaces it\n" });
      assert.equal(fs.readFileSync(path.join(tmp, UI, "tokens.json"), "utf8"), "{}\n");
      assert.equal(extract("--force").code, 0);
      assert.ok(read("tokens.json").color);
    });
  });

  describe("a refusal", () => {
    it("names a design system that is missing, a system.md that is missing and code-tokens that list nothing", () => {
      assert.equal(extract().err, "aidd-ui: no design system under aidd_docs/ui\n");
      fs.mkdirSync(path.join(tmp, UI), { recursive: true });
      assert.equal(extract().err, "aidd-ui: aidd_docs/ui/system.md is missing, write it first\n");
      setup({ tokens: [] });
      assert.deepEqual(extract(), { code: 2, report: null, err: "aidd-ui: system.md lists no code-tokens\n" });
    });

    it("names a code-tokens file that does not exist", () => {
      setup({ tokens: ["src/missing.css"], files: {} });
      assert.deepEqual(extract(), { code: 2, report: null, err: 'aidd-ui: code-tokens "src/missing.css" is no readable file\n' });
    });

    it("prints the usage and exits 2 for an argument it does not know", () => {
      setup();
      const done = engine("extract", "stray", "--root", tmp);
      assert.deepEqual([done.status, done.stderr], [2, "usage: node aidd-ui.cjs extract [--force] [--root <dir>]\n"]);
    });
  });

  describe("a script and a second platform", () => {
    beforeEach(() => setup({ platforms: ["web", "mobile"], roots: ["web=src/web", "mobile=src/mobile"], tokens: ["src/web/tokens.css", "src/mobile/tokens.ts"], files: { "src/web/tokens.css": WEB_CSS, "src/mobile/tokens.ts": MOBILE_TS } }));

    it("reads camelCase keys as the same names, flat or one level nested, and keeps only what differs from the base in the platform file", () => {
      const { report } = extract();
      assert.deepEqual(report.written, [`${UI}/tokens.json`, `${UI}/platforms/mobile.json`, `${UI}/themes/dark.json`, `${UI}/breakpoints/desktop.json`, `${UI}/tokens.resolver.json`]);
      assert.deepEqual(read("platforms/mobile.json"), {
        space: { sm: { $value: { value: 8, unit: "px" } } },
        font: { size: { body: { $value: { value: 17, unit: "px" } } } },
        radius: { control: { $value: { value: 12, unit: "px" } } },
      });
      assert.deepEqual(read("tokens.json").radius.control.$value, { value: 6, unit: "px" });
    });

    it("lists a token only some platforms hold, and what a script holds that is no literal", () => {
      const { report } = extract();
      assert.deepEqual(leftNames(report, "held by web only"), ["--color-veil", "--color-link", "--color-glow", "--space-md", "--space-gutter", "--motion-fast", "--font-body", "--shadow-card", "--font-size-title"]);
      assert.deepEqual(report.left.filter((each) => each.file === "src/mobile/tokens.ts"), [{ file: "src/mobile/tokens.ts", line: 10, name: "--label-caps", why: 'not a string or number literal: caps("label")' }]);
    });

    it("keeps in the base a token only the second platform holds, and says so", () => {
      put(tmp, "src/mobile/tokens.ts", MOBILE_TS.replace("labelCaps", "radiusPill: 999,\n  labelCaps"));
      const { report } = extract();
      assert.deepEqual(read("tokens.json").radius.pill, { $type: "dimension", $value: { value: 999, unit: "px" } });
      assert.deepEqual(report.left.filter((each) => each.name === "--radius-pill").map((each) => each.why), ["held by mobile only, kept in the base"]);
    });

    it("leaves a design system whose tokens generate and break no token rule, the platform in the stylesheet", () => {
      extract();
      assert.deepEqual(tokenProblems(), { generated: 0, found: [] });
      assert.ok(fs.readFileSync(path.join(tmp, UI, "tokens.css"), "utf8").includes('[data-platform="mobile"] {'));
    });

    it("leaves a design system that generates when the platform sets what a theme and a breakpoint of the web set too", () => {
      put(tmp, "src/mobile/tokens.ts", MOBILE_TS.replace('colorInk: "#1b1f23"', 'colorInk: "#000000"').replace("spaceSm: 8,", "spaceSm: 8,\n  fontSizeTitle: 24,"));
      extract();
      assert.deepEqual(read("platforms/mobile.json").font.size.title.$value, { value: 24, unit: "px" });
      assert.deepEqual(read("platforms/mobile.json").color.ink.$value.hex, "#000000");
      assert.deepEqual(tokenProblems(), { generated: 0, found: [] });
      const css = fs.readFileSync(path.join(tmp, UI, "tokens.css"), "utf8");
      assert.equal(css.includes(':root[data-platform="mobile"][data-theme="dark"]'), false);
      assert.ok(css.includes(':root[data-platform="mobile"] {\n  --color-ink: #000000;\n'));
      assert.ok(css.includes('@media (min-width: 48rem) {\n  :root {\n    --space-md: 1.5rem;\n    --font-size-title: 2rem;\n  }\n  :root[data-platform="mobile"] {\n    --font-size-title: 2rem;\n  }\n}'));
    });

    it("lists an object nested deeper than one level, and a theme or media block of a platform that is not the first", () => {
      const files = {
        "src/web/tokens.css": WEB_CSS,
        "src/mobile/tokens.ts": 'export const tokens = {\n  color: { brand: { ink: "#000000" } },\n};\n',
        "src/mobile/dark.css": '[data-theme="dark"] { --color-ink: #ffffff; }\n@media (min-width: 48rem) { :root { --space-md: 2rem; } }\n',
      };
      setup({ platforms: ["web", "mobile"], roots: ["web=src/web", "mobile=src/mobile"], tokens: Object.keys(files), files });
      const { report } = extract();
      assert.deepEqual(report.left.filter((each) => each.file.startsWith("src/mobile")).map((each) => [each.file, each.line, each.name, each.why]), [
        ["src/mobile/dark.css", 1, "--color-ink", 'theme "dark" of platform mobile is not extracted'],
        ["src/mobile/dark.css", 2, "--space-md", "@media (min-width: 48rem) of platform mobile is not extracted"],
        ["src/mobile/tokens.ts", 2, "--color-brand", "an object nested deeper than one level"],
      ]);
    });

    it("reads the platform a code-tokens item names, a token file outside every code root included", () => {
      const files = { "apps/web/src/styles/tokens.css": WEB_CSS, "apps/mobile/src/theme/tokens.ts": MOBILE_TS };
      setup({ platforms: ["web", "mobile"], roots: ["web=apps/web/src/components", "mobile=apps/mobile/src"], tokens: ["web=apps/web/src/styles/tokens.css", "apps/mobile/src/theme/tokens.ts"], files });
      const { report } = extract();
      assert.equal(read("tokens.json").color.ink.$value.hex, "#1b1f23");
      assert.deepEqual(read("platforms/mobile.json").space, { sm: { $value: { value: 8, unit: "px" } } });
      assert.deepEqual(report.left.filter((each) => each.why.includes("platform")), []);
    });

    it("lists a code-tokens file whose platform system.md does not declare", () => {
      const files = { "src/web/tokens.css": WEB_CSS, "src/tv.css": ":root { --color-extra: #fff; }\n" };
      setup({ platforms: ["web", "mobile"], roots: ["web=src/web", "mobile=src/mobile"], tokens: ["src/web/tokens.css", "tv=src/tv.css"], files });
      const { report } = extract();
      assert.deepEqual(report.left.filter((each) => each.file === "src/tv.css"), [{ file: "src/tv.css", line: null, name: null, why: 'platform "tv" is not in system.md' }]);
      assert.equal(read("tokens.json").color.extra, undefined);
    });

    it("leaves a token file under no code root whole, when several platforms are declared", () => {
      setup({ platforms: ["web", "mobile"], roots: ["web=src/web", "mobile=src/mobile"], tokens: ["src/web/tokens.css", "styles/tokens.css"], files: { "src/web/tokens.css": WEB_CSS, "styles/tokens.css": ":root { --color-extra: #fff; }\n" } });
      const { report } = extract();
      assert.deepEqual(report.left.filter((each) => each.file === "styles/tokens.css"), [{ file: "styles/tokens.css", line: null, name: null, why: "is under no code root, so its platform is unknown" }]);
      assert.equal(read("tokens.json").color.extra, undefined);
    });
  });

  describe("a file it cannot read as tokens", () => {
    it("lists a file that is neither a stylesheet nor a script, and still writes what the others hold", () => {
      setup({ tokens: ["src/tokens.css", "src/tokens.scss"], files: { "src/tokens.css": WEB_CSS, "src/tokens.scss": "$ink: #000;\n" } });
      const { report } = extract();
      assert.deepEqual(report.left.filter((each) => each.file === "src/tokens.scss"), [{ file: "src/tokens.scss", line: null, name: null, why: "neither a stylesheet nor a script" }]);
      assert.ok(read("tokens.json").color.ink);
    });
  });

  describe("an @media block", () => {
    const sheet = (...queries) => `:root { --space-a: 1rem; --space-b: 1rem; --space-c: 1rem; }\n${queries.map(([query, name]) => `@media ${query} { :root { ${name}: 2rem; } }`).join("\n")}\n`;
    const named = (breakpoints, widths, ...queries) => setup({ themes: ["light"], breakpoints, widths, files: { "src/tokens.css": sheet(...queries) } });

    it("goes to the breakpoint whose row names its lengths, whatever the order of the blocks", () => {
      named(["mobile", "tablet", "desktop"], { tablet: "from 40rem", desktop: "from 64rem" }, ["(min-width: 64rem)", "--space-a"], ["(min-width: 40rem)", "--space-b"]);
      extract();
      assert.deepEqual(Object.keys(read("breakpoints/desktop.json").space), ["a"]);
      assert.deepEqual(Object.keys(read("breakpoints/tablet.json").space), ["b"]);
      assert.deepEqual(read("tokens.resolver.json").modifiers.breakpoint.$extensions["dev.ai-driven.media"], { tablet: "(min-width: 40rem)", desktop: "(min-width: 64rem)" });
    });

    it("goes to the next breakpoint in order when no row names it and as many are left as queries", () => {
      named(["mobile", "tablet", "desktop"], {}, ["(min-width: 40rem)", "--space-a"], ["(min-width: 64rem)", "--space-b"]);
      extract();
      assert.deepEqual(Object.keys(read("breakpoints/tablet.json").space), ["a"]);
      assert.deepEqual(Object.keys(read("breakpoints/desktop.json").space), ["b"]);
    });

    it("is listed, never guessed, when more queries are left than breakpoints", () => {
      named(["mobile", "desktop"], {}, ["(min-width: 40rem)", "--space-a"], ["(min-width: 64rem)", "--space-b"]);
      const { report } = extract();
      assert.deepEqual(report.left.map((each) => [each.name, each.why]), [
        ["--space-a", "@media (min-width: 40rem) matches no breakpoint of system.md"],
        ["--space-b", "@media (min-width: 64rem) matches no breakpoint of system.md"],
      ]);
      assert.equal(fs.existsSync(path.join(tmp, UI, "breakpoints")), false);
    });

    it("writes no breakpoint context when none holds a value", () => {
      named(["mobile", "desktop"], {});
      extract();
      assert.equal(fs.existsSync(path.join(tmp, UI, "tokens.resolver.json")), false);
    });
  });

  describe("a theme block", () => {
    const withSheet = (css, themes = ["light", "dark"]) => setup({ themes, files: { "src/tokens.css": css } });

    it("holds the base theme in :root when the stylesheet writes both selectors", () => {
      withSheet(':root, [data-theme="light"] { --color-a: #111111; }\n[data-theme="dark"] { --color-a: #eeeeee; }\n');
      const { report } = extract();
      assert.deepEqual(report.left, []);
      assert.equal(read("tokens.json").color.a.$value.hex, "#111111");
      assert.equal(read("themes/dark.json").color.a.$value.hex, "#eeeeee");
    });

    it("lists a block of the base theme alone rather than merge it with :root", () => {
      withSheet(':root { --color-a: #111111; }\n[data-theme="light"] { --color-a: #222222; }\nhtml[data-theme="dark"] { --color-a: #eeeeee; }\n');
      const { report } = extract();
      assert.deepEqual(report.left.map((each) => [each.line, each.name, each.why]), [[2, "--color-a", 'theme "light" is the base, held by :root: its own block is not merged']]);
      assert.equal(read("tokens.json").color.a.$value.hex, "#111111");
      assert.equal(read("themes/dark.json").color.a.$value.hex, "#eeeeee");
    });

    it("lists a theme system.md does not declare, and a token only the theme sets", () => {
      withSheet(':root { --color-a: #111111; }\n[data-theme="dark"] { --color-b: #eeeeee; }\n[data-theme="sepia"] { --color-a: #dddddd; }\n');
      const { report } = extract();
      assert.deepEqual(report.left.map((each) => [each.name, each.why]), [
        ["--color-b", 'theme "dark" sets it, the base has no such token'],
        ["--color-a", 'theme "sepia" is not in system.md themes'],
      ]);
      assert.equal(fs.existsSync(path.join(tmp, UI, "themes")), false);
    });

    it("keeps a theme with no value of its own as an empty context", () => {
      withSheet(":root { --color-a: #111111; }\n");
      extract();
      assert.deepEqual(read("tokens.resolver.json").modifiers.theme.contexts, { light: [], dark: [] });
    });
  });

  describe("the types of a token across its contexts", () => {
    it("writes an alias to a token of no type as raw CSS, since nothing could type it", () => {
      setup({ themes: ["light"], files: { "src/tokens.css": ":root { --space-fluid: clamp(1rem, 4vw, 3rem); --space-page: var(--space-fluid); }\n" } });
      extract();
      assert.deepEqual(read("tokens.json").space.page, { $extensions: { "dev.ai-driven.css": "var(--space-fluid)" } });
      assert.deepEqual(tokenProblems(), { generated: 0, found: [] });
    });

    it("keeps a value of the base's type in a context, and writes it as CSS where the base has none", () => {
      setup({ themes: ["light"], files: { "src/tokens.css": ":root { --space-fluid: clamp(1rem, 4vw, 3rem); --space-gap: 1rem; }\n@media (min-width: 48rem) { :root { --space-fluid: 2rem; --space-gap: 2rem; } }\n" } });
      extract();
      assert.deepEqual(read("breakpoints/desktop.json"), { space: { fluid: { $extensions: { "dev.ai-driven.css": "2rem" } }, gap: { $value: { value: 2, unit: "rem" } } } });
      assert.deepEqual(tokenProblems(), { generated: 0, found: [] });
    });

    it("lists a token citing a custom property that is no token, and the ones citing that token", () => {
      setup({ themes: ["light"], files: { "src/tokens.css": ":root { --color-a: var(--color-missing); --color-b: var(--color-a); --color-c: #111111; }\n" } });
      const { report } = extract();
      assert.deepEqual(report.left.map((each) => [each.name, each.why]), [
        ["--color-a", "cites --color-missing, which is no token"],
        ["--color-b", "cites --color-a, which is no token"],
      ]);
      assert.deepEqual(Object.keys(read("tokens.json").color), ["c"]);
    });
  });

  describe("what a stylesheet holds that the token files cannot", () => {
    const withSheet = (css, options = {}) => setup({ themes: ["light", "dark"], files: { "src/tokens.css": css }, ...options });

    it("reads an html block as the base, as a :root one", () => {
      withSheet("html { --color-a: #111111; }\n");
      const { report } = extract();
      assert.deepEqual(report.left, []);
      assert.equal(read("tokens.json").color.a.$value.hex, "#111111");
    });

    it("keeps a theme's raw CSS that differs from the base's raw CSS, and drops one that equals it", () => {
      withSheet(':root { --shadow-a: 0 1px red; --shadow-b: 0 1px red; }\n[data-theme="dark"] { --shadow-a: 0 2px blue; --shadow-b: 0 1px red; }\n');
      extract();
      assert.deepEqual(read("themes/dark.json"), { shadow: { a: { $extensions: { "dev.ai-driven.css": "0 2px blue" } } } });
    });

    it("writes an alias to a token of another type as raw CSS in a context, an alias to one of its own type as an alias", () => {
      withSheet(':root { --color-a: #111111; --color-b: #222222; --space-md: 1rem; }\n[data-theme="dark"] { --color-a: var(--space-md); --color-b: var(--color-a); }\n');
      extract();
      assert.deepEqual(read("themes/dark.json"), { color: { a: { $extensions: { "dev.ai-driven.css": "var(--space-md)" } }, b: { $value: "{color.a}" } } });
    });

    it("lists a custom property of a theme block inside a width @media, and writes no breakpoint for it", () => {
      withSheet(':root { --space-a: 1rem; }\n@media (min-width: 48rem) { [data-theme="dark"] { --space-a: 2rem; } }\n');
      const { report } = extract();
      assert.deepEqual(report.left.map((each) => [each.line, each.name, each.why]), [[2, "--space-a", 'selector "[data-theme="dark"]" inside @media is no :root or html block']]);
      assert.equal(fs.existsSync(path.join(tmp, UI, "breakpoints")), false);
    });

    it("lists the custom properties inside an @supports or an @layer, where their line is", () => {
      withSheet(":root { --space-a: 1rem; }\n@supports (display: grid) {\n  :root { --space-b: 2rem; }\n}\n@layer base {\n  :root {\n    --space-c: 3rem;\n  }\n}\n");
      const { report } = extract();
      assert.deepEqual(report.left.map((each) => [each.line, each.name, each.why]), [
        [3, "--space-b", "inside @supports (display: grid)"],
        [7, "--space-c", "inside @layer base"],
      ]);
      assert.deepEqual(Object.keys(read("tokens.json").space), ["a"]);
    });

    it("lists a custom property declared with no value", () => {
      withSheet(":root { --space-a: ; --space-b: 1rem; }\n");
      const { report } = extract();
      assert.deepEqual(report.left.map((each) => [each.line, each.name, each.why]), [[1, "--space-a", "no value"]]);
      assert.deepEqual(Object.keys(read("tokens.json").space), ["b"]);
    });

    it("places a query naming no length on no breakpoint, even the only one left", () => {
      withSheet(":root { --space-a: 1rem; --space-b: 1rem; }\n@media (min-width: 0) { :root { --space-a: 2rem; } }\n@media (min-width: 99rem) { :root { --space-b: 2rem; } }\n", { themes: ["light"] });
      const { report } = extract();
      assert.deepEqual(report.left.map((each) => [each.name, each.why]), [
        ["--space-a", "@media (min-width: 0) matches no breakpoint of system.md"],
        ["--space-b", "@media (min-width: 99rem) matches no breakpoint of system.md"],
      ]);
    });

    it("lists a theme value citing a custom property that is no token, and writes none of it", () => {
      withSheet(':root { --color-a: #111111; --color-b: #222222; }\n[data-theme="dark"] { --color-a: var(--color-missing); --color-b: #333333; }\n');
      const { report } = extract();
      assert.deepEqual(report.left.map((each) => [each.line, each.name, each.why]), [[2, "--color-a", 'theme "dark" cites --color-missing, which is no token']]);
      assert.deepEqual(Object.keys(read("themes/dark.json").color), ["b"]);
    });
  });

  describe("a CSS name", () => {
    const NAMES = ["--a-b-c-d", "--a-b", "--color-accent-hover", "--a", "--color-accent", "--a-b-c", "--font-size-2xl", "--color-accent-hover-strong"];

    it("gives back the same name from its path, whatever the order the names are read in", () => {
      const forward = pathsOf(NAMES);
      const backward = pathsOf([...NAMES].reverse());
      assert.deepEqual([...backward], [...forward]);
      for (const [name, keys] of forward) assert.equal(customProperty(keys.join(".")), name);
    });

    it("joins the rest to the leaf of the shortest token that is a prefix", () => {
      const paths = pathsOf(NAMES);
      assert.deepEqual(paths.get("--color-accent-hover"), ["color", "accent-hover"]);
      assert.deepEqual(paths.get("--color-accent-hover-strong"), ["color", "accent-hover-strong"]);
      assert.deepEqual(paths.get("--a-b-c-d"), ["a-b-c-d"]);
      assert.deepEqual(paths.get("--font-size-2xl"), ["font", "size", "2xl"]);
    });
  });

  describe("a value", () => {
    const colour = (css) => fromCss(css).value;

    it("is a colour from a hex of 3, 6 or 8 digits, or an rgb() of numbers, with its hex only when opaque", () => {
      assert.deepEqual(colour("#fa0"), { colorSpace: "srgb", components: [1, 0.6667, 0], hex: "#ffaa00" });
      assert.deepEqual(colour("#1B1F23"), { colorSpace: "srgb", components: [0.1059, 0.1216, 0.1373], hex: "#1b1f23" });
      assert.deepEqual(colour("#00000080"), { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.502 });
      assert.deepEqual(colour("rgb(255, 0, 0)"), { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" });
      assert.deepEqual(colour("rgba(0 0 0 / 0.5)"), { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.5 });
      assert.deepEqual(colour("rgb(0,0,0,1)"), { colorSpace: "srgb", components: [0, 0, 0], hex: "#000000" });
    });

    it("is a dimension in px or rem and a duration in ms or s", () => {
      assert.deepEqual(fromCss("-0.25rem"), { kind: "value", type: "dimension", value: { value: -0.25, unit: "rem" }, css: "-0.25rem" });
      assert.deepEqual(fromCss("16px").value, { value: 16, unit: "px" });
      assert.deepEqual(fromCss("150ms"), { kind: "value", type: "duration", value: { value: 150, unit: "ms" }, css: "150ms" });
      assert.deepEqual(fromCss("0.4s").value, { value: 0.4, unit: "s" });
    });

    it("is an alias when it is a lone var(), raw CSS when it has a fallback", () => {
      assert.deepEqual(fromCss(" var( --color-accent ) "), { kind: "alias", alias: "--color-accent", css: "var( --color-accent )" });
      assert.equal(fromCss("var(--a, 1px)").kind, "raw");
    });

    it("is raw CSS with a type only for a colour function or a font stack", () => {
      for (const css of ["color-mix(in srgb, red 20%, blue)", "oklch(60% 0.2 30)", "rgb(10% 20% 30%)", "hsl(10 20% 30%)"]) assert.deepEqual(fromCss(css), { kind: "raw", type: "color", raw: css, css });
      for (const css of ['"Inter", system-ui, sans-serif', "-apple-system, Georgia, serif", "monospace"]) assert.equal(fromCss(css).type, "fontFamily");
      for (const css of ["clamp(1rem, 4vw, 3rem)", "0 1px 2px rgba(0, 0, 0, 0.1)", "0 1px 2px red, 0 2px 4px blue", "1.5em", "50%", "Inter", "0", "red"]) assert.equal(fromCss(css).type, undefined, css);
    });

    it("is a px dimension for a bare number of a script whose key names a size, a radius or a space, else a number", () => {
      for (const name of ["font-size-body", "radius-control", "space-md", "spacing-lg", "size"]) assert.deepEqual(fromNumber(name, 12).value, { value: 12, unit: "px" }, name);
      for (const name of ["opacity-disabled", "font-weight-bold", "border-width", "z-index-modal", "sizeless-thing"]) assert.deepEqual([fromNumber(name, 12).type, fromNumber(name, 12).value], ["number", 12], name);
    });
  });

  describe("an object literal of a script", () => {
    it("is read past comments, quoted keys and a trailing as const, each export on its own", () => {
      const source = ['// tokens', 'export const a = {', '  /* ink */ ink: "#000", // trailing', '  "quoted-key": \'q\',', '  size: 12,', '  group: { x: 1 },', '} as const;', 'export const b: Record<string, number> = { y: -2.5 };'].join("\n");
      assert.deepEqual(objectsOf(source), [
        { entries: [{ key: "ink", line: 3, kind: "string", value: "#000" }, { key: "quoted-key", line: 4, kind: "string", value: "q" }, { key: "size", line: 5, kind: "number", value: 12 }, { key: "group", line: 6, kind: "object", entries: [{ key: "x", line: 6, kind: "number", value: 1 }] }] },
        { entries: [{ key: "y", line: 8, kind: "number", value: -2.5 }] },
      ]);
    });

    it("hands back as text what is no literal: a call, an expression, a spread, a template with a hole", () => {
      const [{ entries }] = objectsOf("export const a = { f: g(\"a,b\"), e: 4 * 2, ...rest, t: `x${y}` };");
      assert.deepEqual(entries.map(({ key, kind, text }) => [key, kind, text]), [["f", "other", 'g("a,b")'], ["e", "other", "4 * 2"], ["", "other", "...rest"], ["t", "other", "`x${y}`"]]);
    });
  });
});
