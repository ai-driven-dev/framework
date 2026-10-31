const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, writeProject, edit, put, record, history } = require("./fixtures/aidd-ui/project.js");

// Each rule has one mutation of the valid project, and the test asserts the whole problem
// list: dropping the rule turns its own test red and leaves every other one green.
const LIB = path.resolve(__dirname, "../../plugins/aidd-ui/hooks/lib");
const { load } = require(path.join(LIB, "project.cjs"));
const records = require(path.join(LIB, "records.cjs"));
const historyRules = require(path.join(LIB, "history.cjs"));

const SYSTEM = `${UI}/system.md`;
const BRAND = `${UI}/brand.md`;
const BUTTON = `${UI}/components/button.md`;
const SEARCH = `${UI}/components/search-field.md`;
const DIALOG = `${UI}/components/dialog.md`;
const OLD = `${UI}/components/old-button.md`;
const HOME = `${UI}/screens/home.md`;
const JOURNEY = `${UI}/journeys/onboarding.md`;
const ICON = `${UI}/assets/icon-search.md`;
const REVIEW = `${UI}/reviews/first-pass.md`;

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-ui-records-"));
  writeProject(tmp);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.equal(fs.existsSync(tmp), false);
});

/** Every problem both checks find, as `file: message`. */
function problems() {
  const project = load(tmp);
  return [...records.check(project), ...historyRules.check(project)].map((problem) => `${problem.file}: ${problem.message}`);
}

const change = (file, from, to) => edit(tmp, file, from, to);

describe("aidd-ui records and history", () => {
  it("passes the valid project", () => {
    assert.deepEqual(problems(), []);
  });

  it("loads nothing without aidd_docs/ui/", () => {
    fs.rmSync(path.join(tmp, UI), { recursive: true });
    assert.equal(load(tmp), null);
  });

  it("loads every record", () => {
    assert.equal(load(tmp).records.length, 10);
  });

  describe("R1 front matter", () => {
    it("names a record without front matter", () => {
      put(tmp, JOURNEY, "# Onboarding\n");
      assert.deepEqual(problems(), [`${JOURNEY}: line 1: no front matter, open and close it with a --- line`]);
    });

    it("names a line that is neither key: value nor key: [a, b]", () => {
      change(JOURNEY, "persona: a first-time analyst", "persona: a first-time analyst\n  - nested");
      assert.deepEqual(problems(), [`${JOURNEY}: line 7: expected "key: value" or "key: [a, b]", got "- nested"`]);
    });

    it("reads front matter behind a byte order mark", () => {
      const file = path.join(tmp, JOURNEY);
      fs.writeFileSync(file, `\uFEFF${fs.readFileSync(file, "utf8")}`);
      assert.deepEqual(problems(), []);
    });

    it("reads a fence line with trailing spaces", () => {
      change(JOURNEY, "---\nid: onboarding", "--- \nid: onboarding");
      assert.deepEqual(problems(), []);
    });

    it("reads CRLF line endings", () => {
      const file = path.join(tmp, JOURNEY);
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/\n/g, "\r\n"));
      assert.deepEqual(problems(), []);
    });

    it("unquotes scalar values and list items", () => {
      change(SEARCH, "id: search-field", "id: 'search-field'");
      change(SEARCH, "status: validated", 'status: "validated"');
      change(SEARCH, "uses: [button, icon-search]", `uses: ["button", 'icon-search']`);
      assert.deepEqual(problems(), []);
    });

    it("reads an empty value as an empty list", () => {
      change(OLD, "uses: []", "uses:");
      assert.deepEqual(problems(), []);
    });
  });

  describe("R2 kind and folder", () => {
    it("names an unknown kind", () => {
      change(JOURNEY, "kind: journey", "kind: widget");
      assert.deepEqual(problems(), [`${JOURNEY}: unknown kind "widget"`]);
    });

    it("names a kind that only an object's prototype holds as unknown", () => {
      change(JOURNEY, "kind: journey", "kind: toString");
      assert.deepEqual(problems(), [`${JOURNEY}: unknown kind "toString"`]);
    });

    it("names a record in a folder that only an object's prototype holds", () => {
      put(tmp, `${UI}/constructor/extra.md`, record(["id: extra", "kind: atom", "status: proposed", "version: 1"], history(["1", "created", "no", "aidd_docs/tasks/ds-init"])));
      assert.deepEqual(problems(), [`${UI}/constructor/extra.md: kind "atom" does not belong in constructor/`]);
    });

    it("names a kind outside its folder", () => {
      put(tmp, `${UI}/screens/extra.md`, record(["id: extra", "kind: atom", "status: proposed", "version: 1"], history(["1", "created", "no", "aidd_docs/tasks/ds-init"])));
      assert.deepEqual(problems(), [`${UI}/screens/extra.md: kind "atom" does not belong in screens/`]);
    });
  });

  describe("R3 required keys and values", () => {
    const missing = [
      [SYSTEM, "locales: [fr, ar]\n", "locales"],
      [BRAND, "version: 1\n", "version"],
      [BUTTON, "role: button\n", "role"],
      [HOME, "route: /\n", "route"],
      [JOURNEY, "persona: a first-time analyst\n", "persona"],
      [ICON, "alt: Search\n", "alt"],
      [REVIEW, "scope: system\n", "scope"],
    ];
    for (const [file, line, key] of missing) {
      it(`names ${key} missing from ${path.basename(file)}`, () => {
        change(file, line, "");
        assert.deepEqual(problems(), [`${file}: missing key "${key}"`]);
      });
    }

    it("names an unknown status", () => {
      change(JOURNEY, "status: validated", "status: done");
      assert.deepEqual(problems(), [`${JOURNEY}: status "done" must be proposed, validated or deprecated`]);
    });

    it("names an interactive value that is neither yes nor no", () => {
      change(SEARCH, "interactive: yes", "interactive: maybe");
      assert.deepEqual(problems(), [`${SEARCH}: interactive "maybe" must be yes or no`]);
    });

    it("names an unknown asset type", () => {
      change(ICON, "type: icon", "type: photo");
      assert.deepEqual(problems(), [`${ICON}: type "photo" must be icon, image or illustration`]);
    });
  });

  describe("R4 identity", () => {
    it("names an id that differs from the file name", () => {
      change(JOURNEY, "id: onboarding", "id: onboard");
      assert.deepEqual(problems(), [`${JOURNEY}: id "onboard" differs from the file name "onboarding"`]);
    });

    it("names an id two records hold", () => {
      const screen = ["id: brand", "kind: screen", "status: proposed", "version: 1", "uses: []", "states: [default]", "breakpoints: [mobile]", "route: /brand"];
      put(tmp, `${UI}/screens/brand.md`, record(screen, history(["1", "created", "no", "aidd_docs/tasks/ds-init"])));
      assert.deepEqual(problems(), [`${UI}/screens/brand.md: id "brand" already belongs to ${BRAND}`]);
    });
  });

  describe("R5 version", () => {
    for (const bad of ["0", "v2"]) {
      it(`names element version ${bad}`, () => {
        change(JOURNEY, "version: 1", `version: ${bad}`);
        assert.deepEqual(problems(), [`${JOURNEY}: version "${bad}" must be an integer from 1`]);
      });
    }

    it("names a system version that is not semver", () => {
      change(SYSTEM, "version: 2.0.0", "version: 1.0");
      assert.deepEqual(problems(), [`${SYSTEM}: version "1.0" must be semver, such as 2.0.0`]);
    });
  });

  describe("R6 uses", () => {
    it("names a used id no record has", () => {
      change(SEARCH, "uses: [button, icon-search]", "uses: [button, icon-search, ghost]");
      assert.deepEqual(problems(), [`${SEARCH}: uses "ghost", which no record has`]);
    });

    const levels = [
      [OLD, "uses: []", "uses: [search-field]", 'atom cannot use molecule "search-field"'],
      [SEARCH, "uses: [button, icon-search]", "uses: [button, icon-search, dialog]", 'molecule cannot use composition "dialog"'],
      [HOME, "uses: [search-field, dialog]", "uses: [search-field, dialog, home]", "uses itself"],
    ];
    for (const [file, from, to, message] of levels) {
      it(`names ${message}`, () => {
        change(file, from, to);
        assert.deepEqual(problems(), [`${file}: ${message}`]);
      });
    }
  });

  it("accepts an element using another of its own level", () => {
    change(OLD, "uses: []", "uses: [button]");
    assert.deepEqual(problems(), []);
  });

  describe("R7 states and keyboard", () => {
    it("names an interactive component without focus", () => {
      change(BUTTON, "states: [default, hover, focus, disabled]", "states: [default, hover, disabled]");
      assert.deepEqual(problems(), [`${BUTTON}: interactive component lacks state "focus"`]);
    });

    it("accepts an interactive component without hover or disabled, which exist only when it has them", () => {
      change(BUTTON, "states: [default, hover, focus, disabled]", "states: [default, focus]");
      assert.deepEqual(problems(), []);
    });

    it("names a component without default", () => {
      change(OLD, "states: [default]", "states: [idle]");
      assert.deepEqual(problems(), [`${OLD}: component lacks state "default"`]);
    });

    it("names a screen without default", () => {
      change(HOME, "states: [default, empty, loading, error]", "states: [empty, loading, error]");
      assert.deepEqual(problems(), [`${HOME}: screen lacks state "default"`]);
    });

    it("names an interactive component without a keyboard section", () => {
      change(DIALOG, "## Keyboard\n\nEscape closes it; focus stays inside while it is open.\n\n", "");
      assert.deepEqual(problems(), [`${DIALOG}: interactive component lacks a "## Keyboard" section`]);
    });
  });

  describe("R8 implemented version", () => {
    it("names an implemented record without code", () => {
      change(HOME, "code: src/ui/HomePage.tsx#HomePage\n", "");
      assert.deepEqual(problems(), [`${HOME}: implemented-version needs "code"`]);
    });

    it("accepts an implemented molecule without code when everything it uses is implemented", () => {
      change(SEARCH, "version: 1", "version: 1\nimplemented-version: 1");
      assert.deepEqual(problems(), []);
    });

    it("names an implemented molecule without code that uses a component not implemented", () => {
      change(SEARCH, "version: 1", "version: 1\nimplemented-version: 1");
      change(BUTTON, "implemented-version: 1\n", "");
      assert.deepEqual(problems(), [`${SEARCH}: implemented-version needs "code", or every element it uses implemented`]);
    });

    it("accepts code that lags behind the design, as a feature leaves it until it follows", () => {
      change(BUTTON, "version: 1", "version: 2");
      change(BUTTON, "| 1 | created | no | aidd_docs/tasks/ds-init |", "| 1 | created | no | aidd_docs/tasks/ds-init |\n| 2 | larger | no | aidd_docs/tasks/tweak |");
      assert.deepEqual(problems(), []);
    });

    it("names an implemented version ahead of the design", () => {
      change(BUTTON, "implemented-version: 1", "implemented-version: 2");
      assert.deepEqual(problems(), [`${BUTTON}: implemented-version 2 is ahead of version 1`]);
    });

    it("names an implemented version that is no integer", () => {
      change(BUTTON, "implemented-version: 1", "implemented-version: yes");
      assert.deepEqual(problems(), [`${BUTTON}: implemented-version "yes" must be an integer from 1`]);
    });

    it("names an implemented version on a record that is never code", () => {
      change(JOURNEY, "version: 1", "version: 1\nimplemented-version: 1");
      assert.deepEqual(problems(), [`${JOURNEY}: implemented-version is for components and screens, never a journey`]);
    });
  });

  describe("R9 deprecated", () => {
    it("names a deprecated record without replaced-by", () => {
      change(OLD, "replaced-by: button\n", "");
      assert.deepEqual(problems(), [`${OLD}: status deprecated needs "replaced-by"`]);
    });

    it("names a replacement no record has", () => {
      change(OLD, "replaced-by: button", "replaced-by: ghost");
      assert.deepEqual(problems(), [`${OLD}: replaced-by "ghost", which no record has`]);
    });

    it("names a replacement that is deprecated too", () => {
      change(OLD, "replaced-by: button", "replaced-by: old-button");
      assert.deepEqual(problems(), [`${OLD}: replaced-by "old-button" is deprecated too`]);
    });

    it("names replaced-by none without a deprecation section", () => {
      change(OLD, "replaced-by: button", "replaced-by: none");
      assert.deepEqual(problems(), [`${OLD}: replaced-by none needs a "## Deprecation" section saying why`]);
    });
  });

  describe("R10 deprecated in use", () => {
    it("names a live record using a deprecated one", () => {
      change(SEARCH, "uses: [button, icon-search]", "uses: [button, icon-search, old-button]");
      assert.deepEqual(problems(), [`${SEARCH}: uses "old-button", which is deprecated`]);
    });

    it("names an atom using a deprecated asset", () => {
      put(
        tmp,
        `${UI}/assets/icon-old.md`,
        record(
          ["id: icon-old", "kind: asset", "status: deprecated", "version: 2", "type: icon", "file: icon-search.svg", "alt: Search", "replaced-by: icon-search"],
          history(["1", "created", "no", "aidd_docs/tasks/ds-init"], ["2", "deprecated for icon-search", "yes", "aidd_docs/tasks/retire-old-button"])
        )
      );
      change(BUTTON, "uses: []", "uses: [icon-old]");
      assert.deepEqual(problems(), [`${BUTTON}: uses "icon-old", which is deprecated`]);
    });
  });

  describe("R11 breakpoints", () => {
    it("names a screen breakpoint system.md lacks", () => {
      change(HOME, "breakpoints: [mobile, desktop]", "breakpoints: [mobile, tablet, desktop]");
      assert.deepEqual(problems(), [`${HOME}: breakpoint "tablet" is not in system.md`]);
    });
  });

  describe("R12 journeys", () => {
    it("names a step whose screen is absent", () => {
      change(JOURNEY, "| home | opens a result |", "| ghost | opens a result |");
      assert.deepEqual(problems(), [`${JOURNEY}: step 2 names screen "ghost", which no screen has`]);
    });
  });

  describe("R13 reviews", () => {
    it("names a screen state with no verdict row", () => {
      change(REVIEW, "| home | loading | 1 | ko | spinner too small |\n", "");
      assert.deepEqual(problems(), [`${REVIEW}: no verdict row for home / loading at version 1`]);
    });

    it("names a verdict for an older version as no verdict for the current one", () => {
      change(REVIEW, "| home | loading | 1 |", "| home | loading | 0 |");
      assert.deepEqual(problems(), [`${REVIEW}: no verdict row for home / loading at version 1`]);
    });

    it("names a verdict that is not ok, ko or pending", () => {
      change(REVIEW, "| home | default | 1 | ok | |", "| home | default | 1 | maybe | |");
      assert.deepEqual(problems(), [`${REVIEW}: verdict "maybe" for home / default must be ok, ko or pending`]);
    });
  });

  describe("R14 brand", () => {
    it("names a missing brand heading", () => {
      change(BRAND, "## Users\n\nAnalysts.\n\n", "");
      assert.deepEqual(problems(), [`${BRAND}: lacks "## Users"`]);
    });
  });

  describe("R15 assets", () => {
    it("names an asset whose file is absent", () => {
      change(ICON, "file: icon-search.svg", "file: missing.svg");
      assert.deepEqual(problems(), [`${ICON}: file "missing.svg" does not exist beside it`]);
    });
  });

  describe("R16 system, brand and review statuses", () => {
    const cases = [
      [SYSTEM, "status: validated", "deprecated"],
      [BRAND, "status: validated", "deprecated"],
      [REVIEW, "status: proposed", "deprecated"],
    ];
    for (const [file, from, status] of cases) {
      it(`names ${path.basename(file)} with status ${status}`, () => {
        change(file, from, `status: ${status}`);
        assert.deepEqual(problems(), [`${file}: status "${status}" is for elements: system, brand and reviews are proposed or validated`]);
      });
    }
  });

  describe("R17 usage", () => {
    it("names a component without a usage section", () => {
      change(DIALOG, "## Usage\n\nA decision that blocks the page.\n\n", "");
      assert.deepEqual(problems(), [`${DIALOG}: lacks "## Usage", saying when to use it and when not`]);
    });
  });

  describe("H1 history present", () => {
    it("names a versioned record without a history table", () => {
      change(JOURNEY, "## History", "## Changes");
      assert.deepEqual(problems(), [`${JOURNEY}: no "## History" table`]);
    });
  });

  describe("H2 one change per version", () => {
    it("names two rows claiming one version, as a merge of two branches leaves", () => {
      change(OLD, "| 2 | deprecated for button |", "| 2 | larger label | no | aidd_docs/tasks/ds-init |\n| 2 | deprecated for button |");
      assert.deepEqual(problems(), [`${OLD}: two changes claim version 2, renumber one`]);
    });
  });

  describe("H3 version matches history", () => {
    it("names a version that is not the highest row", () => {
      change(JOURNEY, "version: 1", "version: 2");
      assert.deepEqual(problems(), [`${JOURNEY}: version 2 is not the highest history row, 1`]);
    });

    it("names a gap in the history", () => {
      change(BUTTON, "version: 1", "version: 3");
      change(BUTTON, "| 1 | created | no | aidd_docs/tasks/ds-init |", "| 1 | created | no | aidd_docs/tasks/ds-init |\n| 3 | larger | no | aidd_docs/tasks/ds-init |");
      assert.deepEqual(problems(), [`${BUTTON}: history jumps from 1 to 3`]);
    });
  });

  describe("H4 breaking", () => {
    it("names a breaking value that is neither yes nor no", () => {
      change(JOURNEY, "| 1 | created | no |", "| 1 | created | maybe |");
      assert.deepEqual(problems(), [`${JOURNEY}: breaking "maybe" in version 1 must be yes or no`]);
    });
  });

  describe("H5 system version follows its publications", () => {
    const SECOND = "| 2.0.0 | old-button retired | yes | aidd_docs/tasks/retire-old-button |";

    it("names a publication of a breaking task that is not breaking itself", () => {
      change(SYSTEM, SECOND, "| 2.0.0 | old-button retired | no | aidd_docs/tasks/retire-old-button |");
      assert.deepEqual(problems(), [`${SYSTEM}: 2.0.0 publishes "aidd_docs/tasks/retire-old-button", which breaks an element, so it is breaking`]);
    });

    it("names a breaking publication without a major bump", () => {
      change(SYSTEM, "version: 2.0.0", "version: 1.1.0");
      change(SYSTEM, "| 2.0.0 |", "| 1.1.0 |");
      assert.deepEqual(problems(), [`${SYSTEM}: 1.1.0 is breaking, yet raises no major version`]);
    });

    it("names a publication that raises neither major nor minor", () => {
      change(SYSTEM, "version: 2.0.0", "version: 2.0.1");
      change(SYSTEM, SECOND, `${SECOND}\n| 2.0.1 | button padding | no | aidd_docs/tasks/tweak |`);
      assert.deepEqual(problems(), [`${SYSTEM}: 2.0.1 raises neither major nor minor`]);
    });

    it("accepts a breaking publication of tokens alone, which no element history shows", () => {
      change(SYSTEM, "version: 2.0.0", "version: 3.0.0");
      change(SYSTEM, SECOND, `${SECOND}\n| 3.0.0 | color.brand renamed | yes | aidd_docs/tasks/rename-brand |`);
      assert.deepEqual(problems(), []);
    });

    it("accepts a publication listing several tasks", () => {
      change(SYSTEM, SECOND, "| 2.0.0 | old-button retired | yes | aidd_docs/tasks/ds-init, aidd_docs/tasks/retire-old-button |");
      assert.deepEqual(problems(), []);
    });

    it("reads a newest-first system history by version", () => {
      change(SYSTEM, `| 1.0.0 | first system | no | aidd_docs/tasks/ds-init |\n${SECOND}`, `${SECOND}\n| 1.0.0 | first system | no | aidd_docs/tasks/ds-init |`);
      assert.deepEqual(problems(), []);
    });

    it("accepts an element task no publication lists yet, as two parallel features leave", () => {
      change(JOURNEY, "| no | aidd_docs/tasks/ds-init |", "| no | aidd_docs/tasks/new-flow |");
      assert.deepEqual(problems(), []);
    });
  });

  describe("H6 deprecation breaks", () => {
    it("names a deprecated record whose last row is not breaking", () => {
      change(OLD, "| yes | aidd_docs/tasks/retire-old-button |", "| no | aidd_docs/tasks/retire-old-button |");
      assert.deepEqual(problems(), [`${OLD}: deprecated, yet its last history row is not breaking`]);
    });
  });
  describe("H7 tasks are folders", () => {
    it("names an element task that is not a task folder", () => {
      change(JOURNEY, "| no | aidd_docs/tasks/ds-init |", "| no | ds-init |");
      assert.deepEqual(problems(), [`${JOURNEY}: task "ds-init" in version 1 must be a task folder, aidd_docs/tasks/…`]);
    });

    it("names a published task that is not a task folder", () => {
      change(SYSTEM, "| 2.0.0 | old-button retired | yes | aidd_docs/tasks/retire-old-button |", "| 2.0.0 | old-button retired | yes | aidd_docs/tasks/retire-old-button, PROJ-12 |");
      assert.deepEqual(problems(), [`${SYSTEM}: task "PROJ-12" in version 2.0.0 must be a task folder, aidd_docs/tasks/…`]);
    });
  });

  describe("format", () => {
    it("names a system.md without a format", () => {
      change(SYSTEM, "format: 1\n", "");
      assert.deepEqual(problems(), [`${SYSTEM}: missing key "format"`]);
    });

    it("reads a format it knows as none of its problems", () => {
      assert.equal(records.formatProblem(load(tmp)), null);
    });

    it("names another format as the one problem", () => {
      change(SYSTEM, "format: 1", "format: 2");
      assert.deepEqual(records.formatProblem(load(tmp)), { file: SYSTEM, message: 'format "2" is not 1, the one this validator reads' });
    });
  });
});
