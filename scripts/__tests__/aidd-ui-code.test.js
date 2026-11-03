const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, writeProject, edit, put } = require("./fixtures/aidd-ui/project.js");

// Each rule has one mutation of the valid project, and the test asserts the whole problem
// list: dropping the rule turns its own test red and leaves every other one green. Link
// mutations land on search-field: it owns no file and is not coded, so none orphans a file.
const LIB = path.resolve(__dirname, "../../plugins/aidd-ui/hooks/lib");
const { load } = require(path.join(LIB, "project.cjs"));
const code = require(path.join(LIB, "code.cjs"));

const SYSTEM = `${UI}/system.md`;
const BUTTON = `${UI}/components/button.md`;
const SEARCH = `${UI}/components/search-field.md`;
const DIALOG = `${UI}/components/dialog.md`;
const SEARCH_CSS = "src/ui/SearchField.css";

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-ui-code-"));
  writeProject(tmp);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.equal(fs.existsSync(tmp), false);
});

const problems = () => code.check(load(tmp)).map((problem) => `${problem.file}: ${problem.message}`);

/** Gives search-field a code link. */
const linkSearch = (link) => edit(tmp, SEARCH, "role: search", `role: search\ncode: ${link}`);

/** Writes a stylesheet search-field links to, so only its content can raise a problem. */
function linkedStylesheet(css) {
  put(tmp, SEARCH_CSS, css);
  linkSearch(`${SEARCH_CSS}#SearchField`);
}

/** Appends one line to a file of the project. */
const append = (file, line) => fs.appendFileSync(path.join(tmp, file), `${line}\n`);

describe("aidd-ui code link", () => {
  it("passes the valid project", () => {
    assert.deepEqual(problems(), []);
  });

  describe("C1 links", () => {
    it("names a code file that does not exist", () => {
      linkSearch("src/ui/Missing.tsx#SearchField");
      assert.deepEqual(problems(), [`${SEARCH}: code file "src/ui/Missing.tsx" does not exist`]);
    });

    it("reads code-roots and ignore written with a leading ./", () => {
      edit(tmp, SYSTEM, "code-roots: [src/ui]", "code-roots: [./src/ui]");
      edit(tmp, SYSTEM, "ignore: [src/ui/vendor]", "ignore: [./src/ui/vendor]");
      assert.deepEqual(problems(), []);
    });

    it("names an export absent from the file", () => {
      edit(tmp, BUTTON, "#Button", "#Buttn");
      assert.deepEqual(problems(), [`${BUTTON}: export "Buttn" is not in src/ui/Button.tsx`]);
    });

    it("names an export that is only part of a word in the file", () => {
      edit(tmp, BUTTON, "#Button", "#Butto");
      assert.deepEqual(problems(), [`${BUTTON}: export "Butto" is not in src/ui/Button.tsx`]);
    });

    it("reads code-roots and ignore written with a trailing /", () => {
      edit(tmp, SYSTEM, "code-roots: [src/ui]", "code-roots: [src/ui/]");
      edit(tmp, SYSTEM, "ignore: [src/ui/vendor]", "ignore: [src/ui/vendor/]");
      assert.deepEqual(problems(), []);
    });

    it("names a link without #", () => {
      linkSearch("src/ui/Button.tsx");
      assert.deepEqual(problems(), [`${SEARCH}: code "src/ui/Button.tsx" must be path#Export or package:<name>#Export`]);
    });
  });

  describe("C2 libraries", () => {
    it("names a package system.md does not list", () => {
      edit(tmp, DIALOG, "package:@radix-ui/react-dialog#Root", "package:left-pad#Pad");
      assert.deepEqual(problems(), [`${DIALOG}: package "left-pad" is not in system.md libraries`]);
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
      linkSearch("src/ui/search-field/search-field.component.tsx#SearchField");
      assert.deepEqual(problems(), []);
    });

    it("covers only the files of its stem among siblings", () => {
      put(tmp, "src/ui/Button.module.css", ".ui {}\n");
      put(tmp, "src/ui/Orphan.tsx", "export function Orphan() {}\n");
      assert.deepEqual(problems(), ["src/ui/Orphan.tsx: no record links it and no ignore covers it"]);
    });

    it("accepts a valid link on a proposed record", () => {
      edit(tmp, SEARCH, "status: validated", "status: proposed");
      put(tmp, "src/ui/SearchField.tsx", "export function SearchField() {}\n");
      linkSearch("src/ui/SearchField.tsx#SearchField");
      assert.deepEqual(problems(), []);
    });
  });

  describe("C4 colour literals", () => {
    it("names a colour literal in UI code, with its line", () => {
      append("src/ui/Button.tsx", 'const style = "color: #ff0000";');
      assert.deepEqual(problems(), ['src/ui/Button.tsx: line 4: colour literal "#ff0000", use a token']);
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

  describe("C4 other literals", () => {
    it("leaves a unit literal in code alone, a stated limit", () => {
      linkedStylesheet(".SearchField { padding: 16px; }\n");
      assert.deepEqual(problems(), []);
    });
  });

  describe("C5 one record per file", () => {
    it("names two records sharing one code link", () => {
      linkSearch("src/ui/Button.tsx#Button");
      assert.deepEqual(problems(), [`${SEARCH}: code "src/ui/Button.tsx#Button" is also ${BUTTON}'s`]);
    });
  });

  describe("C6 logical properties in code", () => {
    it("names a physical property in a stylesheet when rtl is declared", () => {
      linkedStylesheet(".SearchField { margin-left: 0; }\n");
      assert.deepEqual(problems(), [`${SEARCH_CSS}: line 1: physical property "margin-left", use its logical form`]);
    });

    it("allows it when only ltr is declared", () => {
      edit(tmp, SYSTEM, "directions: [ltr, rtl]", "directions: [ltr]");
      linkedStylesheet(".SearchField { margin-left: 0; }\n");
      assert.deepEqual(problems(), []);
    });
  });

  describe("C8 code tokens", () => {
    it("names a code token file that does not exist", () => {
      fs.rmSync(path.join(tmp, "src/ui/tokens.css"));
      assert.deepEqual(problems(), [`${SYSTEM}: code-tokens "src/ui/tokens.css" does not exist`]);
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
