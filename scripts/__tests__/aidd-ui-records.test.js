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
  });

  describe("R2 kind and folder", () => {
    it("names an unknown kind", () => {
      change(JOURNEY, "kind: journey", "kind: widget");
      assert.deepEqual(problems(), [`${JOURNEY}: unknown kind "widget"`]);
    });

    it("names a kind outside its folder", () => {
      put(tmp, `${UI}/screens/extra.md`, record(["id: extra", "kind: atom", "status: proposed", "version: 1"], history(["1", "created", "no", "ds-init"])));
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
      assert.deepEqual(problems(), [`${JOURNEY}: status "done" must be proposed, validated, coded or deprecated`]);
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
      put(tmp, `${UI}/screens/brand.md`, record(screen, history(["1", "created", "no", "ds-init"])));
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
      [OLD, "uses: []", "uses: [button]", 'atom cannot use atom "button"'],
      [SEARCH, "uses: [button, icon-search]", "uses: [button, icon-search, dialog]", 'molecule cannot use composition "dialog"'],
      [HOME, "uses: [search-field, dialog]", "uses: [search-field, dialog, home]", 'screen cannot use screen "home"'],
    ];
    for (const [file, from, to, message] of levels) {
      it(`names a ${message.split(" ")[0]} using its own level or above`, () => {
        change(file, from, to);
        assert.deepEqual(problems(), [`${file}: ${message}`]);
      });
    }
  });

  describe("R7 states and keyboard", () => {
    it("names an interactive component without hover", () => {
      change(BUTTON, "states: [default, hover, focus, disabled]", "states: [default, focus, disabled]");
      assert.deepEqual(problems(), [`${BUTTON}: interactive component lacks state "hover"`]);
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

  describe("R8 coded", () => {
    it("names a coded record without code", () => {
      change(HOME, "code: src/ui/HomePage.tsx#HomePage\n", "");
      assert.deepEqual(problems(), [`${HOME}: status coded needs "code"`]);
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
      change(REVIEW, "| home | loading | ko | spinner too small |\n", "");
      assert.deepEqual(problems(), [`${REVIEW}: no verdict row for home / loading`]);
    });

    it("names a verdict that is not ok, ko or pending", () => {
      change(REVIEW, "| home | default | ok | |", "| home | default | maybe | |");
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
      [SYSTEM, "status: validated", "coded"],
      [BRAND, "status: validated", "deprecated"],
      [REVIEW, "status: proposed", "coded"],
    ];
    for (const [file, from, status] of cases) {
      it(`names ${path.basename(file)} with status ${status}`, () => {
        change(file, from, `status: ${status}`);
        assert.deepEqual(problems(), [`${file}: status "${status}" is for elements: system, brand and reviews are proposed or validated`]);
      });
    }
  });

  describe("H1 history present", () => {
    it("names a versioned record without a history table", () => {
      change(JOURNEY, "## History", "## Changes");
      assert.deepEqual(problems(), [`${JOURNEY}: no "## History" table`]);
    });
  });

  describe("H2 one change per version", () => {
    it("names two rows claiming one version, as a merge of two branches leaves", () => {
      change(OLD, "| 2 | deprecated for button |", "| 2 | larger label | no | ds-init |\n| 2 | deprecated for button |");
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
      change(BUTTON, "| 1 | created | no | ds-init |", "| 1 | created | no | ds-init |\n| 3 | larger | no | ds-init |");
      assert.deepEqual(problems(), [`${BUTTON}: history jumps from 1 to 3`]);
    });
  });

  describe("H4 breaking", () => {
    it("names a breaking value that is neither yes nor no", () => {
      change(JOURNEY, "| 1 | created | no |", "| 1 | created | maybe |");
      assert.deepEqual(problems(), [`${JOURNEY}: breaking "maybe" in version 1 must be yes or no`]);
    });
  });

  describe("H5 system version follows its tasks", () => {
    it("names a breaking task without a major bump", () => {
      change(SYSTEM, "version: 2.0.0", "version: 1.1.0");
      change(SYSTEM, "| 2.0.0 |", "| 1.1.0 |");
      assert.deepEqual(problems(), [`${SYSTEM}: task "retire-old-button" breaks an element, yet system.md 1.1.0 raises no major version`]);
    });

    it("names a non-breaking task whose system row raises nothing", () => {
      change(BUTTON, "version: 1", "version: 2");
      change(BUTTON, "| 1 | created | no | ds-init |", "| 1 | created | no | ds-init |\n| 2 | larger padding | no | tweak |");
      change(SYSTEM, "version: 2.0.0", "version: 2.0.1");
      change(SYSTEM, "| 2.0.0 | old-button retired | yes | retire-old-button |", "| 2.0.0 | old-button retired | yes | retire-old-button |\n| 2.0.1 | button padding | no | tweak |");
      assert.deepEqual(problems(), [`${SYSTEM}: task "tweak" changes an element, yet system.md 2.0.1 raises neither major nor minor`]);
    });

    it("names a task system.md has no row for", () => {
      change(JOURNEY, "| no | ds-init |", "| no | new-flow |");
      assert.deepEqual(problems(), [`${JOURNEY}: task "new-flow" has no row in system.md`]);
    });
  });

  describe("H6 deprecation breaks", () => {
    it("names a deprecated record whose last row is not breaking", () => {
      change(OLD, "| yes | retire-old-button |", "| no | retire-old-button |");
      assert.deepEqual(problems(), [`${OLD}: deprecated, yet its last history row is not breaking`]);
    });
  });
});
