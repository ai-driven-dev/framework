const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const { UI, writeProject, edit, editTokens, put, record, history, git } = require("./fixtures/aidd-ui/project.js");

// Each rule has one mutation of the valid project, and the test asserts the whole problem
// list: dropping the rule turns its own test red and leaves every other one green.
const LIB = path.resolve(__dirname, "../../plugins/aidd-ui/hooks/lib");
const { load } = require(path.join(LIB, "project.cjs"));
const records = require(path.join(LIB, "records.cjs"));
const historyRules = require(path.join(LIB, "history.cjs"));
const { problemsOf, isError } = require(path.join(LIB, "../aidd-ui.cjs"));

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
const STYLESHEET = `${UI}/tokens.css`;
const BUTTON_RENDER = `${UI}/components/button.html`;
const HOME_RENDER = `${UI}/screens/home.html`;
const BUTTON_USAGE = "Any action a person starts; never for navigation.";
const WIDENED = "Any action a person starts on purpose; never for navigation.";
const EDITED = (version) => `${BUTTON}: edited since its committed version ${version}, raise its version with a History row`;

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

    it("takes code-tokens as a list: a monorepo's apps each hold their own", () => {
      change(SYSTEM, "code-tokens: src/ui/tokens.css", "code-tokens: [src/ui/tokens.css, src/ui/other.css]");
      assert.deepEqual(problems(), []);
    });

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
      const screen = ["id: brand", "kind: screen", "status: proposed", "version: 1", "uses: []", "tokens: []", "states: [default]", "breakpoints: [mobile]", "route: /brand"];
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

  describe("H8 edited without a new version", () => {
    const commit = (dir = tmp) => {
      git(dir, "add", "-A");
      git(dir, "commit", "-q", "--no-verify", "-m", "snapshot");
    };
    const repository = (dir = tmp) => {
      git(dir, "init", "-q");
      commit(dir);
    };
    /** Only H8's own problems, so a case about what H8 leaves alone does not depend on the others. */
    const edited = () => historyRules.check(load(tmp)).filter((found) => found.rule === "H8").map((found) => `${found.file}: ${found.message}`);
    const ownProblems = () => historyRules.check(load(tmp)).filter((found) => found.rule === "H8");
    /** Every problem of every check, as the engine reports them: a check that crashes is one more line. */
    const whole = () => problemsOf(load(tmp)).map((found) => `${found.file}: ${found.message}`);

    beforeEach(() => repository());

    it("names a validated element whose text changed and whose version did not", () => {
      change(BUTTON, BUTTON_USAGE, WIDENED);
      assert.deepEqual(problems(), [EDITED(1)]);
    });

    it("names a validated element whose render changed and whose version did not", () => {
      edit(tmp, BUTTON_RENDER, "</body>", "<!-- one more look -->\n</body>");
      assert.deepEqual(edited(), [EDITED(1)]);
    });

    it("names a deprecated element too", () => {
      change(OLD, "Nowhere: replaced by button.", "Nowhere: use button.");
      assert.deepEqual(edited(), [`${OLD}: edited since its committed version 2, raise its version with a History row`]);
    });

    it("reads a screen as an element", () => {
      edit(tmp, HOME_RENDER, "</body>", "<!-- one more look -->\n</body>");
      assert.deepEqual(edited(), [`${HOME}: edited since its committed version 1, raise its version with a History row`]);
    });

    it("stays silent once the version rose with a history row", () => {
      change(BUTTON, BUTTON_USAGE, WIDENED);
      change(BUTTON, "version: 1", "version: 2");
      change(BUTTON, "| 1 | created | no | aidd_docs/tasks/ds-init |", "| 1 | created | no | aidd_docs/tasks/ds-init |\n| 2 | wider usage | no | aidd_docs/tasks/widen-button |");
      assert.deepEqual(problems(), []);
    });

    it("stays silent when only the status changed", () => {
      change(BUTTON, "status: validated", "status: proposed");
      assert.deepEqual(edited(), []);
    });

    it("stays silent when only implemented-version changed", () => {
      change(BUTTON, "implemented-version: 1\n", "");
      assert.deepEqual(edited(), []);
    });

    it("stays silent when only the code link changed", () => {
      change(BUTTON, "code: src/ui/Button.tsx#Button", "code: src/ui/Button.tsx#Primary");
      assert.deepEqual(edited(), []);
    });

    it("stays silent when only the history changed", () => {
      change(BUTTON, "| 1 | created | no | aidd_docs/tasks/ds-init |", "| 1 | created | no | aidd_docs/tasks/ds-init |\n| 2 | wider usage | no | aidd_docs/tasks/widen-button |");
      assert.deepEqual(edited(), []);
    });

    it("stays silent for a record committed as proposed: it is still being designed", () => {
      change(BUTTON, "status: validated", "status: proposed");
      commit();
      change(BUTTON, BUTTON_USAGE, WIDENED);
      assert.deepEqual(edited(), []);
    });

    it("stays silent for a record the repository does not hold yet", () => {
      put(tmp, `${UI}/components/badge.md`, fs.readFileSync(path.join(tmp, BUTTON), "utf8").replace("id: button", "id: badge"));
      assert.deepEqual(edited(), []);
    });

    it("stays silent for brand.md, which is no element", () => {
      change(BRAND, "A search tool.", "A catalogue tool.");
      assert.deepEqual(edited(), []);
    });

    it("holds a record committed with CRLF line ends to its version", () => {
      const file = path.join(tmp, BUTTON);
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replaceAll("\n", "\r\n"));
      git(tmp, "-c", "core.autocrlf=false", "add", "-A");
      git(tmp, "commit", "-q", "--no-verify", "-m", "windows line ends");
      change(BUTTON, BUTTON_USAGE, WIDENED);
      assert.deepEqual(edited(), [EDITED(1)]);
    });

    it("asks the project's own repository, whatever GIT_DIR a commit hook exports", () => {
      change(BUTTON, BUTTON_USAGE, WIDENED);
      process.env.GIT_DIR = path.join(tmp, "no-such-repository");
      try {
        assert.deepEqual(edited(), [EDITED(1)]);
      } finally {
        delete process.env.GIT_DIR;
      }
    });

    it("stays silent in a folder that is no git repository", () => {
      fs.rmSync(path.join(tmp, ".git"), { recursive: true });
      change(BUTTON, BUTTON_USAGE, WIDENED);
      assert.deepEqual(edited(), []);
    });

    it("stays silent when git is not installed", () => {
      change(BUTTON, BUTTON_USAGE, WIDENED);
      const path_ = process.env.PATH;
      process.env.PATH = os.tmpdir();
      try {
        assert.deepEqual(edited(), []);
      } finally {
        process.env.PATH = path_;
      }
    });

    it("stays silent in a repository with no commit", () => {
      fs.rmSync(path.join(tmp, ".git"), { recursive: true });
      git(tmp, "init", "-q");
      change(BUTTON, BUTTON_USAGE, WIDENED);
      assert.deepEqual(edited(), []);
    });

    describe("a git that fails", { skip: process.platform === "win32" }, () => {
      const DUBIOUS = "fatal: detected dubious ownership in repository at '/elsewhere'";
      const FAILED = (failure) => `${UI}: git failed, so nothing was held to its committed version: ${failure}`;
      /** `read`'s result with a `git` on PATH that runs `script`. */
      const withGit = (script, read) => {
        const bin = `${tmp}-bin`;
        const path_ = process.env.PATH;
        fs.mkdirSync(bin);
        fs.writeFileSync(path.join(bin, "git"), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
        process.env.PATH = `${bin}${path.delimiter}${path_}`;
        try {
          return read();
        } finally {
          process.env.PATH = path_;
          fs.rmSync(bin, { recursive: true, force: true });
        }
      };
      const all = () => historyRules.check(load(tmp)).map((found) => `${found.file}: ${found.message} (${found.rule})`);

      it("is one H8 problem naming the failure's first line, and the other rules still run", () => {
        change(BUTTON, "| 1 | created | no |", "| 1 | created | maybe |");
        const found = withGit(`echo "${DUBIOUS}" >&2\necho "To add an exception, run this" >&2\nexit 128`, all);
        assert.deepEqual(found, [`${BUTTON}: breaking "maybe" in version 1 must be yes or no (H4)`, `${FAILED(DUBIOUS)} (H8)`]);
      });

      it("is named for a repository the real git refuses, whose owner is another", () => {
        const refusing = `PATH='${process.env.PATH}' GIT_TEST_ASSUME_DIFFERENT_OWNER=1 GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 exec git "$@"`;
        assert.deepEqual(withGit(refusing, edited), [FAILED(`fatal: detected dubious ownership in repository at '${fs.realpathSync(tmp)}'`)]);
      });

      it("is named when only the read of a committed file fails", () => {
        const found = withGit(`[ "$1" = diff-index ] && { printf '${BUTTON}\\0'; exit 0; }\necho "fatal: bad object HEAD" >&2\nexit 128`, edited);
        assert.deepEqual(found, [FAILED("fatal: bad object HEAD")]);
      });

      it("is named when git times out, as a warning: a slow machine blocks no turn", () => {
        const found = withGit("exec sleep 30", ownProblems);
        assert.deepEqual(found.map((each) => `${each.file}: ${each.message}`), [FAILED("spawnSync git ETIMEDOUT")]);
        assert.equal(found.some(isError), false);
      });

      it("warns on any failure, while an edit git could read stays an error", () => {
        assert.equal(withGit(`echo "${DUBIOUS}" >&2\nexit 128`, ownProblems).some(isError), false);
        change(BUTTON, BUTTON_USAGE, WIDENED);
        assert.deepEqual(ownProblems().map(isError), [true]);
      });

      it("reads git's messages in one language, whatever the machine's", () => {
        const found = withGit('[ "$LC_ALL" = C ] && echo "fatal: not a git repository" >&2 || echo "fatal: ni ceci ni cela" >&2\nexit 128', edited);
        assert.deepEqual(found, []);
      });
    });

    describe("git calls", () => {
      afterEach(() => mock.restoreAll());
      const gitCalls = () => {
        const spy = mock.method(childProcess, "execFileSync");
        const found = edited();
        return { found, args: spy.mock.calls.map((call) => call.arguments[1][0]) };
      };

      it("asks git for nothing but the changed files while every validated element is unchanged", () => {
        assert.deepEqual(gitCalls(), { found: [], args: ["diff-index"] });
      });

      it("reads from git only the elements that changed", () => {
        change(BUTTON, BUTTON_USAGE, WIDENED);
        assert.deepEqual(gitCalls(), { found: [EDITED(1)], args: ["diff-index", "show"] });
      });
    });

    describe("a token value that changed", () => {
      const TOKEN_CHANGED = (file, tokens, version = 1) => `${file}: value of ${tokens} changed since its committed version ${version}, raise its version with a History row`;
      const setBold = (weight) => editTokens(tmp, (tree) => (tree.font.weight.bold.$value = weight));
      const raise = (file) => {
        change(file, "\nversion: 1\n", "\nversion: 2\n");
        change(file, "| 1 | created | no | aidd_docs/tasks/ds-init |", "| 1 | created | no | aidd_docs/tasks/ds-init |\n| 2 | lighter bold | no | aidd_docs/tasks/lighten |");
      };
      const THROUGH_BOLD = [BUTTON, DIALOG, SEARCH, HOME].map((file) => TOKEN_CHANGED(file, "font.weight.bold"));

      it("names the validated element declaring it, and each one using that element, with the token", () => {
        setBold(600);
        assert.deepEqual(edited(), THROUGH_BOLD);
      });

      it("names a validated element whose token only an element it uses declares", () => {
        setBold(600);
        [BUTTON, SEARCH, HOME].forEach(raise);
        assert.deepEqual(edited(), [TOKEN_CHANGED(DIALOG, "font.weight.bold")]);
      });

      const THROUGH_PRIMARY = [
        TOKEN_CHANGED(BUTTON, "color.action.default, color.text.default"),
        TOKEN_CHANGED(DIALOG, "color.action.default, color.text.default"),
        TOKEN_CHANGED(SEARCH, "color.text.default, color.action.default"),
        TOKEN_CHANGED(HOME, "color.text.default, color.action.default"),
      ];

      it("reaches it through an alias, and leaves a deprecated element as it is", () => {
        editTokens(tmp, (tree) => (tree.color.brand.primary.$value = { colorSpace: "srgb", components: [0.1, 0.1, 0.1], hex: "#1a1a1a" }));
        assert.deepEqual(edited(), THROUGH_PRIMARY);
      });

      it("reaches it in a theme", () => {
        edit(tmp, `${UI}/themes/dark.json`, "#6699cc", "#112233");
        editTokens(tmp, () => {});
        assert.deepEqual(edited(), THROUGH_PRIMARY);
      });

      describe("in a breakpoint", () => {
        const THROUGH_SPACE = [BUTTON, DIALOG, SEARCH, HOME].map((file) => TOKEN_CHANGED(file, "space.md"));
        const DESKTOP = `${UI}/breakpoints/desktop.json`;

        it("reaches a value only a breakpoint file holds", () => {
          edit(tmp, DESKTOP, '"value": 1.5', '"value": 2');
          editTokens(tmp, () => {});
          assert.deepEqual(edited(), THROUGH_SPACE);
        });

        it("still reads the base value of a token a breakpoint redefines", () => {
          editTokens(tmp, (tree) => (tree.space.md.$value.value = 2));
          assert.deepEqual(edited(), THROUGH_SPACE);
        });

        it("reaches a token that depends on it", () => {
          editTokens(tmp, (tree) => {
            tree.space.gap = { $value: "{space.md}" };
          });
          change(DIALOG, "tokens: [space.md]", "tokens: [space.md, space.gap]");
          commit();
          edit(tmp, DESKTOP, '"value": 1.5', '"value": 2');
          editTokens(tmp, () => {});
          assert.ok(edited().includes(TOKEN_CHANGED(DIALOG, "space.md, space.gap")));
        });

        it("reaches a media query that changed, whose value moved at some widths", () => {
          edit(tmp, `${UI}/tokens.resolver.json`, "(min-width: 64rem)", "(min-width: 80rem)");
          editTokens(tmp, () => {});
          assert.deepEqual(edited(), THROUGH_SPACE);
        });

        it("stays silent when nothing moved", () => {
          editTokens(tmp, () => {});
          assert.deepEqual(edited(), []);
        });
      });

      it("stays silent for a token no element declares", () => {
        editTokens(tmp, (tree) => (tree.misc = { unused: { $type: "number", $value: 1 } }));
        commit();
        editTokens(tmp, (tree) => (tree.misc.unused.$value = 2));
        assert.deepEqual(edited(), []);
      });

      it("stays silent once every reached element's version rose", () => {
        setBold(600);
        [BUTTON, DIALOG, SEARCH, HOME].forEach(raise);
        assert.deepEqual(edited(), []);
      });

      it("names only the elements the repository holds", () => {
        put(tmp, `${UI}/components/badge.md`, fs.readFileSync(path.join(tmp, BUTTON), "utf8").replace("id: button", "id: badge"));
        setBold(600);
        assert.deepEqual(edited(), THROUGH_BOLD);
      });

      it("stays silent without a committed tokens.css", () => {
        git(tmp, "rm", "-q", "--cached", `${UI}/tokens.css`);
        git(tmp, "commit", "-q", "--no-verify", "-m", "unstage the stylesheet");
        setBold(600);
        assert.deepEqual(whole(), []);
      });

      it("leaves a deleted tokens.css to T10, one problem", () => {
        fs.rmSync(path.join(tmp, STYLESHEET));
        assert.deepEqual(whole(), [`${STYLESHEET}: missing, generate it with the engine's tokens command`]);
      });

      it("leaves a tokens.css it cannot read as that one problem", () => {
        fs.rmSync(path.join(tmp, STYLESHEET));
        fs.mkdirSync(path.join(tmp, STYLESHEET));
        assert.deepEqual(whole(), [`${STYLESHEET}: unreadable`]);
      });

      it("resolves values through raw CSS that loops", () => {
        const looping = (target) => ({ $type: "number", $value: 0, $extensions: { "dev.ai-driven.css": `var(--loop-${target})` } });
        editTokens(tmp, (tree) => (tree.loop = { one: looping("two"), two: looping("one") }));
        commit();
        setBold(600);
        assert.deepEqual(whole(), THROUGH_BOLD);
      });

      it("does not name an element already named for its text", () => {
        setBold(600);
        change(BUTTON, BUTTON_USAGE, WIDENED);
        assert.deepEqual(edited(), [EDITED(1), ...THROUGH_BOLD.slice(1)]);
      });
    });

    it("finds the committed record when the project lies below the repository's root", () => {
      for (const name of ["aidd_docs", "src", ".git"]) fs.rmSync(path.join(tmp, name), { recursive: true });
      const app = path.join(tmp, "app");
      fs.mkdirSync(app);
      writeProject(app);
      repository();
      edit(app, BUTTON, BUTTON_USAGE, WIDENED);
      assert.deepEqual(historyRules.check(load(app)).filter((found) => found.rule === "H8").map((found) => found.message), [EDITED(1).slice(BUTTON.length + 2)]);
    });
  });

  describe("R3 variant items", () => {
    const VARIANTS = "variants: [primary, secondary]";
    const cases = [
      ["Size=sm", 'variant "Size=sm": axis "Size" must match [a-z][a-z-]*'],
      ["=sm", 'variant "=sm": axis "" must match [a-z][a-z-]*'],
      ["size=", 'variant "size=": no value'],
      ["state=hover", 'variant "state=hover": axis "state" is taken, data-state shows the states'],
      ["variant=big", 'variant "variant=big": axis "variant" is taken, data-variant shows the bare variants'],
      ["theme=dark", 'variant "theme=dark": axis "theme" is taken, data-theme switches the token theme'],
    ];
    for (const [item, message] of cases) {
      it(`names ${item}`, () => {
        change(BUTTON, VARIANTS, `variants: [primary, ${item}]`);
        assert.deepEqual(problems(), [`${BUTTON}: ${message}`]);
      });
    }

    it("accepts bare items and axes together, on a hyphenated axis too", () => {
      change(BUTTON, VARIANTS, "variants: [primary, size=sm, size=md, icon-side=start]");
      assert.deepEqual(problems(), []);
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
