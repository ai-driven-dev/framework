const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, PATHS, LIB, makeTmp, removeTmp, writeProject, edit, put } = require("../fixtures/aidd-ui/project.js");

// Each rule has one mutation of the valid project, and the test asserts the whole problem
// list: dropping the rule turns its own test red and leaves every other one green. Link
// mutations land on search-field: it owns no file and is not coded, so none orphans a file.
const { load } = require(path.join(LIB, "project.cjs"));
const code = require(path.join(LIB, "code.cjs"));

const { SYSTEM, BUTTON, SEARCH, DIALOG } = PATHS;
const SEARCH_CSS = "src/ui/SearchField.css";
const DEBT = `${UI}/code-debt.json`;

let tmp;

beforeEach(() => {
  tmp = makeTmp("aidd-ui-code-");
  writeProject(tmp);
});

afterEach(() => removeTmp(tmp));

const problems = () => code.check(load(tmp)).map((problem) => `${problem.file}: ${problem.message}`);

/** Gives search-field a code link. */
const linkSearch = (link) => edit(tmp, SEARCH, "role: search", `role: search\ncode: ${link}`);

/** Writes a stylesheet search-field links to, so only its content can raise a problem. */
function linkedStylesheet(css) {
  put(tmp, SEARCH_CSS, css);
  linkSearch(`${SEARCH_CSS}#SearchField@1`);
}

// The fixture's code-debt.json records no literal, so any one found is above its debt.
const NEW = " (found 1, debt 0)";
/** Appends one line to a file of the project. */
const append = (file, line) => fs.appendFileSync(path.join(tmp, file), `${line}\n`);

describe("aidd-ui code link", () => {
  it("passes the valid project", () => {
    assert.deepEqual(problems(), []);
  });

  describe("C1 links", () => {
    it("names a code file that does not exist", () => {
      linkSearch("src/ui/Missing.tsx#SearchField@1");
      assert.deepEqual(problems(), [`${SEARCH}: code file "src/ui/Missing.tsx" does not exist`]);
    });

    it("reads code-roots and ignore written with a leading ./", () => {
      edit(tmp, SYSTEM, "code-roots: [src/ui]", "code-roots: [./src/ui]");
      edit(tmp, SYSTEM, "ignore: [src/ui/vendor]", "ignore: [./src/ui/vendor]");
      assert.deepEqual(problems(), []);
    });

    it("names an export absent from the file", () => {
      edit(tmp, BUTTON, "#Button@1", "#Buttn@1");
      assert.deepEqual(problems(), [`${BUTTON}: export "Buttn" is not in src/ui/Button.tsx`]);
    });

    it("names an export that is only part of a word in the file", () => {
      edit(tmp, BUTTON, "#Button@1", "#Butto@1");
      assert.deepEqual(problems(), [`${BUTTON}: export "Butto" is not in src/ui/Button.tsx`]);
    });

    it("reads code-roots and ignore written with a trailing /", () => {
      edit(tmp, SYSTEM, "code-roots: [src/ui]", "code-roots: [src/ui/]");
      edit(tmp, SYSTEM, "ignore: [src/ui/vendor]", "ignore: [src/ui/vendor/]");
      assert.deepEqual(problems(), []);
    });

    it("takes a link without an export, whatever the techno", () => {
      linkedStylesheet(".SearchField {}\n");
      edit(tmp, SEARCH, "#SearchField@1", "@1");
      assert.deepEqual(problems(), []);
    });

    it("names a link whose export is empty", () => {
      linkSearch("src/ui/Button.tsx#@1");
      assert.deepEqual(problems(), [`${SEARCH}: code "src/ui/Button.tsx#@1" must be path[#Export]@<version> or package:<name>[#Export]@<version>`]);
    });

    it("names a link without a version", () => {
      linkedStylesheet(".SearchField {}\n");
      edit(tmp, SEARCH, "#SearchField@1", "#SearchField");
      assert.deepEqual(problems(), [`${SEARCH}: code "${SEARCH_CSS}#SearchField" lacks its version, @<version>`]);
    });

    it("names a package link without a version, not a scope read as one", () => {
      edit(tmp, DIALOG, "#Root@1", "#Root");
      assert.deepEqual(problems(), [`${DIALOG}: code "package:@radix-ui/react-dialog#Root" lacks its version, @<version>`]);
    });

    it("names a package link without export or version, not its scope read as a version", () => {
      edit(tmp, DIALOG, "#Root@1", "");
      assert.deepEqual(problems(), [`${DIALOG}: code "package:@radix-ui/react-dialog" lacks its version, @<version>`]);
    });

    it("names a version that is no integer from 1", () => {
      linkedStylesheet(".SearchField {}\n");
      edit(tmp, SEARCH, "@1", "@one");
      assert.deepEqual(problems(), [`${SEARCH}: code "${SEARCH_CSS}#SearchField@one": version "one" must be an integer from 1`]);
    });

    it("names a version above the record's", () => {
      linkedStylesheet(".SearchField {}\n");
      edit(tmp, SEARCH, "@1", "@2");
      assert.deepEqual(problems(), [`${SEARCH}: code "${SEARCH_CSS}#SearchField@2": version 2 is ahead of version 1`]);
    });

    it("takes a version behind the record's: the code follows in the feature", () => {
      linkedStylesheet(".SearchField {}\n");
      edit(tmp, SEARCH, "\nversion: 1\n", "\nversion: 3\n");
      assert.deepEqual(problems(), []);
    });

    it("takes a list of links", () => {
      put(tmp, SEARCH_CSS, ".SearchField {}\n");
      linkSearch(`[${SEARCH_CSS}#SearchField@1]`);
      assert.deepEqual(problems(), []);
    });
  });

  describe("C3 coverage", () => {
    it("names a file under a code root no record links and no ignore covers", () => {
      put(tmp, "src/ui/Orphan.tsx", "export function Orphan() {}\n");
      assert.deepEqual(problems(), ["src/ui/Orphan.tsx: no record links it and no ignore covers it"]);
    });

    it("covers a folder named after the linked file: its styles, hooks and tests", () => {
      put(tmp, "src/ui/search-field/search-field.component.tsx", "export function SearchField() {}\n");
      put(tmp, "src/ui/search-field/search-field-filter.ts", "export const filter = () => null;\n");
      put(tmp, "src/ui/search-field/__tests__/search-field.test.tsx", "test();\n");
      linkSearch("src/ui/search-field/search-field.component.tsx#SearchField@1");
      assert.deepEqual(problems(), []);
    });

    it("covers only the files of its stem among siblings", () => {
      put(tmp, "src/ui/Button.module.css", ".ui {}\n");
      put(tmp, "src/ui/Orphan.tsx", "export function Orphan() {}\n");
      assert.deepEqual(problems(), ["src/ui/Orphan.tsx: no record links it and no ignore covers it"]);
    });

    it("leaves a test file and a mock folder out of the backlog, as C4 does", () => {
      put(tmp, "src/ui/__tests__/orphan.tsx", "test();\n");
      put(tmp, "src/ui/__mocks__/data.ts", "export const data = {};\n");
      put(tmp, "src/ui/Orphan.spec.ts", "test();\n");
      assert.deepEqual(problems(), []);
    });

    it("accepts a valid link on a proposed record", () => {
      edit(tmp, SEARCH, "status: validated", "status: proposed");
      put(tmp, "src/ui/SearchField.tsx", "export function SearchField() {}\n");
      linkSearch("src/ui/SearchField.tsx#SearchField@1");
      assert.deepEqual(problems(), []);
    });
  });

  describe("C4 colour literals", () => {
    it("names a colour literal in UI code, with its line", () => {
      append("src/ui/Button.tsx", 'const style = "color: #ff0000";');
      assert.deepEqual(problems(), [`src/ui/Button.tsx: line 4: colour literal "#ff0000", use a token${NEW}`]);
    });

    it("leaves a hex word in a script comment alone", () => {
      append("src/ui/Button.tsx", "// toggles #add");
      assert.deepEqual(problems(), []);
    });

    it("skips an ignored file", () => {
      append("src/ui/vendor/reset.css", ".x { color: #ff0000; }");
      assert.deepEqual(problems(), []);
    });

    it("skips the code's token file, generated from the tokens", () => {
      append("src/ui/tokens.css", ".x { color: #ff0000; }");
      assert.deepEqual(problems(), []);
    });

    it("skips a mock folder, which states colours to stand in for real data", () => {
      put(tmp, "src/ui/__mocks__/theme.ts", 'export const primary = "#336699";\n');
      assert.deepEqual(problems().filter((problem) => !problem.includes("no record links it")), []);
    });

    it("skips a test, which states colours to check them", () => {
      put(tmp, "src/ui/Button.test.tsx", 'expect(color).toBe("#336699");\n');
      assert.deepEqual(problems(), []);
    });
  });

  describe("C4 severity", () => {
    const LITERAL = 'const style = "color: #ff0000";';
    const BUTTON_FILE = "src/ui/Button.tsx";
    const HOME_FILE = "src/ui/HomePage.tsx";
    /** Each C4 problem as `<severity> <file>:<what follows the literal>`. */
    const verdicts = () =>
      code
        .check(load(tmp))
        .filter((found) => found.rule === "C4")
        .map((found) => `${found.severity} ${found.file}:${found.message.split("use a token")[1]}`);
    const owe = (debt) => put(tmp, DEBT, `${JSON.stringify(debt, null, 2)}\n`);

    it("warns on a literal its file holds no more times than the debt records", () => {
      append(BUTTON_FILE, LITERAL);
      append(BUTTON_FILE, LITERAL);
      owe({ [BUTTON_FILE]: { "#ff0000": 2 } });
      assert.deepEqual(verdicts(), [`warning ${BUTTON_FILE}: (existing debt)`, `warning ${BUTTON_FILE}: (existing debt)`]);
    });

    it("errs on every occurrence of a literal its file holds more times than the debt records, naming both counts", () => {
      append(BUTTON_FILE, LITERAL);
      append(BUTTON_FILE, LITERAL);
      owe({ [BUTTON_FILE]: { "#ff0000": 1 } });
      assert.deepEqual(verdicts(), [`error ${BUTTON_FILE}: (found 2, debt 1)`, `error ${BUTTON_FILE}: (found 2, debt 1)`]);
    });

    it("counts by file and by literal: another file's debt, or another literal's, covers nothing", () => {
      append(BUTTON_FILE, LITERAL);
      append(HOME_FILE, LITERAL);
      owe({ [BUTTON_FILE]: { "#ff0000": 1 }, [HOME_FILE]: { "#0000ff": 1 } });
      assert.deepEqual(verdicts(), [`warning ${BUTTON_FILE}: (existing debt)`, `error ${HOME_FILE}: (found 1, debt 0)`]);
    });

    it("counts a colour written as numbers in the debt as it counts a written one", () => {
      append(BUTTON_FILE, "const c = Color(0xFF336699);");
      owe(code.colourDebt(load(tmp)));
      assert.deepEqual(verdicts(), [`warning ${BUTTON_FILE}: (existing debt)`]);
    });

    it("errs on every literal, saying the debt file is missing, when there is none", () => {
      append(BUTTON_FILE, LITERAL);
      fs.rmSync(path.join(tmp, DEBT));
      assert.deepEqual(verdicts(), [`error ${BUTTON_FILE}: (counted as new: ${DEBT} is missing)`]);
    });
  });

  describe("C4 other literals", () => {
    it("leaves a unit literal in code alone, a stated limit", () => {
      linkedStylesheet(".SearchField { padding: 16px; }\n");
      assert.deepEqual(problems(), []);
    });
  });

  describe("Astro components", () => {
    const HERO = "src/ui/Hero.astro";
    const hero = (body) => {
      put(tmp, HERO, body);
      linkSearch(`${HERO}@1`);
    };

    it("links an Astro component without an export", () => {
      hero("---\n---\n<h1>Hero</h1>\n");
      assert.deepEqual(problems(), []);
    });

    it("still takes a path#Export link, the export being checked", () => {
      hero("---\n---\n<h1>Hero</h1>\n");
      edit(tmp, SEARCH, `code: ${HERO}@1`, `code: ${HERO}#Missing@1`);
      assert.deepEqual(problems(), [`${SEARCH}: export "Missing" is not in ${HERO}`]);
    });

    it("finds a colour literal in its style block, with its line", () => {
      hero("---\n---\n<style>\n  h1 { color: #ff0000; }\n</style>\n");
      assert.deepEqual(problems(), [`${HERO}: line 4: colour literal "#ff0000", use a token${NEW}`]);
    });

    it("finds a colour literal in a string, and leaves one in its markup text alone", () => {
      hero('---\nconst c = "#ff0000";\n---\n<p>Rapport #412 and #add</p>\n');
      assert.deepEqual(problems(), [`${HERO}: line 2: colour literal "#ff0000", use a token${NEW}`]);
    });
  });

  describe("code of any techno", () => {
    const CARD = "src/ui/Card.swift";
    const card = (body) => {
      put(tmp, CARD, body);
      linkSearch(`${CARD}#Card@1`);
    };
    const RED = (line) => `${CARD}: line ${line}: colour literal "#ff0000", use a token${NEW}`;

    it("finds a colour literal in a string of a file it has no reader for, with its line", () => {
      card('struct Card {}\nlet c = "#ff0000"\n');
      assert.deepEqual(problems(), [RED(2)]);
    });

    it("leaves a colour in a comment of such a file alone", () => {
      card("struct Card {}\n// was #ff0000\n/* and #ff0000 */\n");
      assert.deepEqual(problems(), []);
    });

    const COLOUR = (line, literal) => `${CARD}: line ${line}: colour literal "${literal}", use a token${NEW}`;

    // One per form the native colour APIs document, each found once, as the call's head.
    const NUMERIC = {
      "an ARGB number, as Dart and Compose write it": ["Color(0xFF336699)", "Color(0xFF336699"],
      "named channels": ["UIColor(red: 0.2, green: 0.4, blue: 0.6, alpha: 1)", "UIColor(red:0.2"],
      "a colour space before the channels": ["Color(.sRGB, red: 0.98, green: 0.9, blue: 0.2)", "Color(.sRGB,red:0.98"],
      "a grey level": ["UIColor(white: 0.5, alpha: 1)", "UIColor(white:0.5"],
      "Kotlin named arguments": ["Color(red = 0.1f, green = 0.2f, blue = 0.3f)", "Color(red=0.1"],
      "a factory with positional channels": ["Color.fromARGB(255, 66, 165, 245)", "Color.fromARGB(255"],
      "a platform helper": ["android.graphics.Color.rgb(255, 0, 0)", "Color.rgb(255"],
      "a prefixed class": ["NSColor(calibratedRed: 0.1, green: 0.2, blue: 0.3, alpha: 1)", "NSColor(calibratedRed:0.1"],
      "a Swift colour literal": ["#colorLiteral(red: 0.2, green: 0.4, blue: 0.6, alpha: 1)", "#colorLiteral(red:0.2"],
      "a colour property set to a number":["const material = { color: 0xff0000 }", "color:0xff0000"],
    };
    for (const [form, [written, literal]] of Object.entries(NUMERIC)) {
      it(`finds a colour written as numbers: ${form}`, () => {
        card(`struct Card {}\nlet c = ${written}\n`);
        assert.deepEqual(problems(), [COLOUR(2, literal)]);
      });
    }

    it("finds a call spread over lines once, on its first line, as its one-line form reads", () => {
      card("struct Card {}\nlet c = Color(\n  red: 0.4,\n  green: 0.2,\n  blue: 0.9\n)\n");
      assert.deepEqual(problems(), [COLOUR(2, "Color(red:0.4")]);
    });

    it("leaves a colour named by the asset catalog, a token or a variable alone", () => {
      card('struct Card {}\nlet a = UIColor(named: "Brand")\nlet b = Color(theme.primary)\nlet c = Color(AppColors.brand)\n');
      assert.deepEqual(problems(), []);
    });

    it("leaves a number no colour type takes alone: a hash constant, a method on a colour string", () => {
      card("struct Card {}\nlet h = imul(seed, 0x01000193)\nlet mask = 0xFFFFFFFF\nlet hex = color.slice(0, 7)\n");
      assert.deepEqual(problems(), []);
    });

    it("leaves a numeric colour in a comment alone", () => {
      card("struct Card {}\n// Color(0xFF336699)\n/* UIColor(white: 0.5) */\n");
      assert.deepEqual(problems(), []);
    });

    it("does not find a palette constant, which only resolving the name tells from a token, a stated limit", () => {
      card("struct Card {}\nlet c = Colors.blue\nlet d = UIColor.systemBlue\n");
      assert.deepEqual(problems(), []);
    });

    it("finds a colour in an Android resource, outside any string", () => {
      put(tmp, "src/ui/res/values/colors.xml", '<resources>\n  <color name="primary">#FF6B35</color>\n</resources>\n');
      assert.deepEqual(problems().filter((problem) => !problem.includes("no record links it")), [`src/ui/res/values/colors.xml: line 2: colour literal "#FF6B35", use a token${NEW}`]);
    });

    it("lists such a file when no record links it", () => {
      put(tmp, CARD, "struct Card {}\n");
      assert.deepEqual(problems(), [`${CARD}: no record links it and no ignore covers it`]);
    });

    const SKIPPED = {
      documents: [".md", ".mdx", ".txt", ".rst", ".adoc"],
      data: [".json", ".yaml", ".yml", ".csv", ".toml"],
      images: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp", ".svg"],
      fonts: [".woff", ".woff2", ".ttf", ".otf", ".eot"],
    };
    for (const [kind, extensions] of Object.entries(SKIPPED)) {
      it(`reads no ${kind} file: neither covered nor scanned`, () => {
        for (const extension of extensions) put(tmp, `src/ui/skipped${extension}`, '{"color": "#ff0000"}\n');
        assert.deepEqual(problems(), []);
      });
    }

    it("reads no file holding a NUL byte, whatever its extension", () => {
      fs.writeFileSync(path.join(tmp, "src/ui/blob.bin"), Buffer.from([0x89, 0x00, ...Buffer.from('"#ff0000"')]));
      fs.writeFileSync(path.join(tmp, "src/ui/Compiled.swift"), Buffer.from([0x00, ...Buffer.from('"#ff0000"')]));
      assert.deepEqual(problems(), []);
    });
  });

  describe("C5 one record per file", () => {
    it("compares a link without its version: two versions of one file are still one file", () => {
      edit(tmp, BUTTON, "\nversion: 1\n", "\nversion: 2\n");
      edit(tmp, BUTTON, "#Button@1", "#Button@2");
      linkSearch("src/ui/Button.tsx#Button@1");
      assert.deepEqual(problems(), [`${SEARCH}: code "src/ui/Button.tsx#Button@1" is also ${BUTTON}'s`]);
    });

    it("names two records sharing one code link", () => {
      linkSearch("src/ui/Button.tsx#Button@1");
      assert.deepEqual(problems(), [`${SEARCH}: code "src/ui/Button.tsx#Button@1" is also ${BUTTON}'s`]);
    });
  });

  describe("platforms", () => {
    const MOBILE = "src/mobile/Button.swift";
    const WEB_LINK = "src/ui/Button.tsx#Button@1";
    const MOBILE_LINK = `${MOBILE}#Button@1`;
    const PACKAGE = "package:@radix-ui/react-dialog#Root@1";

    /** Web and mobile, one root each; the button is linked on both, the dialog's package link names its platform. */
    function twoPlatforms() {
      edit(tmp, SYSTEM, "platforms: [web]", "platforms: [web, mobile]");
      edit(tmp, SYSTEM, "code-roots: [src/ui]", "code-roots: [web=src/ui, mobile=src/mobile]");
      edit(tmp, DIALOG, PACKAGE, `web=${PACKAGE}`);
      put(tmp, MOBILE, "struct Button {}\n");
      edit(tmp, BUTTON, `code: ${WEB_LINK}`, `code: [${WEB_LINK}, ${MOBILE_LINK}]`);
    }

    it("takes a component linked on both platforms at different versions", () => {
      twoPlatforms();
      edit(tmp, BUTTON, "\nversion: 1\n", "\nversion: 2\n");
      edit(tmp, BUTTON, WEB_LINK, "src/ui/Button.tsx#Button@2");
      assert.deepEqual(problems(), []);
    });

    it("takes a bare root and a platform=path root with one platform", () => {
      edit(tmp, SYSTEM, "code-roots: [src/ui]", "code-roots: [web=src/ui]");
      assert.deepEqual(problems(), []);
    });

    it("names a root with no platform among several", () => {
      twoPlatforms();
      edit(tmp, SYSTEM, "mobile=src/mobile", "src/mobile");
      assert.deepEqual(problems().filter((problem) => problem.startsWith(SYSTEM)), [`${SYSTEM}: code root "src/mobile" must be written platform=path: system.md declares several platforms`]);
    });

    it("names a root whose platform system.md does not list", () => {
      twoPlatforms();
      edit(tmp, SYSTEM, "mobile=src/mobile", "tablet=src/mobile");
      assert.deepEqual(problems().filter((problem) => problem.startsWith(SYSTEM)), [`${SYSTEM}: code root "tablet=src/mobile": platform "tablet" is not in system.md`]);
    });

    it("names a link under a root of a platform the record does not list", () => {
      twoPlatforms();
      edit(tmp, BUTTON, "role: button", "role: button\nplatforms: [web]");
      assert.deepEqual(problems(), [`${BUTTON}: code "${MOBILE_LINK}" is on platform "mobile", which button does not list`]);
    });

    it("names the second link on one platform", () => {
      twoPlatforms();
      put(tmp, "src/ui/ButtonAlt.tsx", "export const Button = 1;\n");
      fs.rmSync(path.join(tmp, MOBILE));
      edit(tmp, BUTTON, MOBILE_LINK, "src/ui/ButtonAlt.tsx#Button@1");
      assert.deepEqual(problems(), [`${BUTTON}: code "src/ui/ButtonAlt.tsx#Button@1" is a second link on platform "web"`]);
    });

    it("names a package link without a platform among several", () => {
      twoPlatforms();
      edit(tmp, DIALOG, `web=${PACKAGE}`, PACKAGE);
      assert.deepEqual(problems(), [`${DIALOG}: code "${PACKAGE}" needs a platform=: system.md declares several platforms`]);
    });

    it("names a package link whose platform system.md does not list", () => {
      twoPlatforms();
      edit(tmp, DIALOG, `web=${PACKAGE}`, `tablet=${PACKAGE}`);
      assert.deepEqual(problems(), [`${DIALOG}: code "tablet=${PACKAGE}": platform "tablet" is not in system.md`]);
    });

    it("names a link under no code root among several: its platform is unknown", () => {
      twoPlatforms();
      put(tmp, "lib/Field.ts", "export const Field = 1;\n");
      linkSearch("lib/Field.ts#Field@1");
      assert.deepEqual(problems(), [`${SEARCH}: code "lib/Field.ts#Field@1" is under no code root, so its platform is unknown`]);
    });

    it("gives a link the platform of the innermost root holding it", () => {
      twoPlatforms();
      edit(tmp, SYSTEM, "mobile=src/mobile", "mobile=src/ui/native");
      put(tmp, "src/ui/native/Button.swift", "struct Button {}\n");
      fs.rmSync(path.join(tmp, MOBILE));
      edit(tmp, BUTTON, MOBILE_LINK, "src/ui/native/Button.swift#Button@1");
      assert.deepEqual(problems(), []);
    });
  });

  describe("C6 logical properties in code", () => {
    it("names a physical property in a stylesheet when a locale is written right to left", () => {
      linkedStylesheet(".SearchField { margin-left: 0; }\n");
      assert.deepEqual(problems(), [`${SEARCH_CSS}: line 1: physical property "margin-left", use its logical form`]);
    });

    it("allows it when no locale is written right to left", () => {
      edit(tmp, SYSTEM, "locales: [fr, ar]", "locales: [fr, en]");
      linkedStylesheet(".SearchField { margin-left: 0; }\n");
      assert.deepEqual(problems(), []);
    });

    for (const locale of ["he", "fa-AF", "ur_PK", "AR-eg"]) {
      it(`takes ${locale} as right to left`, () => {
        edit(tmp, SYSTEM, "locales: [fr, ar]", `locales: [fr, ${locale}]`);
        linkedStylesheet(".SearchField { margin-left: 0; }\n");
        assert.equal(problems().length, 1);
      });
    }
  });

  describe("C8 code tokens", () => {
    it("names a code token file that does not exist", () => {
      fs.rmSync(path.join(tmp, "src/ui/tokens.css"));
      assert.deepEqual(problems(), [`${SYSTEM}: code-tokens "src/ui/tokens.css" does not exist`]);
    });
  });

  describe("code-tokens as a list", () => {
    const ADMIN_TOKENS = "src/ui/admin-tokens.css";
    const asList = () => edit(tmp, SYSTEM, "code-tokens: src/ui/tokens.css", `code-tokens: [src/ui/tokens.css, ./${ADMIN_TOKENS}]`);

    it("leaves every listed file out of literals and coverage", () => {
      asList();
      put(tmp, ADMIN_TOKENS, ":root { --x: #ff0000; }\n");
      assert.deepEqual(problems(), []);
    });

    it("names each listed file that does not exist", () => {
      asList();
      assert.deepEqual(problems(), [`${SYSTEM}: code-tokens "${ADMIN_TOKENS}" does not exist`]);
    });
  });

  describe("code-tokens naming a platform", () => {
    it("takes platform=path, the file leaving literals and coverage as a bare one does", () => {
      edit(tmp, SYSTEM, "code-tokens: src/ui/tokens.css", "code-tokens: web=src/ui/tokens.css");
      put(tmp, "src/ui/tokens.css", ":root { --x: #ff0000; }\n");
      assert.deepEqual(problems(), []);
    });

    it("names a platform system.md does not declare", () => {
      edit(tmp, SYSTEM, "code-tokens: src/ui/tokens.css", "code-tokens: tv=src/ui/tokens.css");
      assert.deepEqual(problems(), [`${SYSTEM}: code-tokens "tv=src/ui/tokens.css": platform "tv" is not in system.md`]);
    });
  });

  describe("C7 code roots inside the project", () => {
    it("names a root that is the project or outside it, and walks nothing from it", () => {
      edit(tmp, SYSTEM, "code-roots: [src/ui]", "code-roots: [src/ui, ., ../shared, /abs]");
      assert.deepEqual(problems(), [
        `${SYSTEM}: code root "." must name a folder inside the project`,
        `${SYSTEM}: code root "../shared" must name a folder inside the project`,
        `${SYSTEM}: code root "/abs" must name a folder inside the project`,
      ]);
    });
  });
});
