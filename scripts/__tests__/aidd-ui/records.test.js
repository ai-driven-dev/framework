const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { fixLedger, UI, HISTORY, PATHS, LIB, makeTmp, removeTmp, addHistory, writeProject, edit, editTokens, put, record, engine } = require("../fixtures/aidd-ui/project.js");

// Each rule has one mutation of the valid project, and the test asserts the whole problem
// list: dropping the rule turns its own test red and leaves every other one green.
const { load } = require(path.join(LIB, "project.cjs"));
const records = require(path.join(LIB, "records.cjs"));
const historyRules = require(path.join(LIB, "history.cjs"));
const { problemsOf } = require(path.join(LIB, "../aidd-ui.cjs"));

const { SYSTEM, BRAND, BUTTON, SEARCH, DIALOG, OLD, HOME, JOURNEY, ICON, REVIEW, BUTTON_RENDER, HOME_RENDER } = PATHS;
const BUTTON_USAGE = "Any action a person starts; never for navigation.";
const WIDENED = "Any action a person starts on purpose; never for navigation.";

let tmp;
const ledger = fixLedger();

beforeEach(() => {
  tmp = makeTmp("aidd-ui-records-");
  writeProject(tmp);
});

afterEach(() => removeTmp(tmp));

/** Every problem both checks find, as `file: message`, H8 aside: a mutation of a validated element
 * breaks its fingerprint too, and H8's own cases read it alone. */
function problems() {
  const project = load(tmp);
  return ledger.note([...records.check(project), ...historyRules.check(project)]).filter((problem) => problem.rule !== "H8").map((problem) => `${problem.file}: ${problem.message}`);
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
      put(tmp, `${UI}/constructor/extra.md`, record(["id: extra", "kind: atom", "status: proposed", "version: 1"]));
      assert.deepEqual(problems(), [`${UI}/constructor/extra.md: kind "atom" does not belong in constructor/`]);
    });

    it("names a kind outside its folder", () => {
      put(tmp, `${UI}/screens/extra.md`, record(["id: extra", "kind: atom", "status: proposed", "version: 1"]));
      assert.deepEqual(problems(), [`${UI}/screens/extra.md: kind "atom" does not belong in screens/`]);
    });
  });

  describe("R3 required keys and values", () => {
    const missing = [
      [SYSTEM, "locales: [fr, ar]\n", "locales"],
      [BUTTON, "version: 1\n", "version"],
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
      put(tmp, `${UI}/screens/brand.md`, record(screen));
      addHistory(tmp, ["brand", "1", "created", "no", "aidd_docs/tasks/ds-init"]);
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
      change(HISTORY, "| system | 2.0.0 |", "| system | 1.0 |");
      assert.deepEqual(problems(), [`${HISTORY}: version "1.0" of system must be semver, such as 2.0.0`]);
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
    it("accepts a component with focus and no hover or disabled, which exist only when it has them", () => {
      change(BUTTON, "states: [default, hover, focus, disabled]", "states: [default, focus]");
      assert.deepEqual(problems(), []);
    });

    it("accepts a component without focus and without a keyboard section", () => {
      change(BUTTON, "states: [default, hover, focus, disabled]", "states: [default, hover, disabled]");
      change(BUTTON, "\n\n## Keyboard\n\nTab focuses it, Enter or Space activates it.", "");
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

    it("names a component with focus and without a keyboard section", () => {
      change(DIALOG, "\n\n## Keyboard\n\nEscape closes it; focus stays inside while it is open.", "");
      assert.deepEqual(problems(), [`${DIALOG}: state "focus" needs a "## Keyboard" section`]);
    });
  });

  describe("R8 implementation", () => {
    it("accepts a link behind the design, as a feature leaves it until it follows", () => {
      change(BUTTON, "version: 1", "version: 2");
      addHistory(tmp, ["button", "2", "larger", "no", "aidd_docs/tasks/tweak"]);
      assert.deepEqual(problems(), []);
    });

    it("names code on an asset, with its article", () => {
      change(ICON, "alt: Search", "alt: Search\ncode: src/ui/Button.tsx#Button@1");
      assert.deepEqual(problems(), [`${ICON}: code is for components and screens, never an asset`]);
    });

    it("names platforms on a record that is never code", () => {
      change(JOURNEY, "version: 1", "version: 1\nplatforms: [web]");
      assert.deepEqual(problems(), [`${JOURNEY}: platforms is for components and screens, never a journey`]);
    });

    it("accepts platforms that are a subset of the system's", () => {
      change(BUTTON, "role: button", "role: button\nplatforms: [web]");
      assert.deepEqual(problems(), []);
    });

    it("names a platform system.md does not declare, on a component and on a screen", () => {
      change(BUTTON, "role: button", "role: button\nplatforms: [web, ios]");
      change(HOME, "route: /", "route: /\nplatforms: [android]");
      assert.deepEqual(problems(), [`${BUTTON}: platform "ios" is not in system.md`, `${HOME}: platform "android" is not in system.md`]);
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
        record(["id: icon-old", "kind: asset", "status: deprecated", "version: 2", "type: icon", "file: icon-search.svg", "alt: Search", "replaced-by: icon-search"])
      );
      addHistory(tmp, ["icon-old", "1", "created", "no", "aidd_docs/tasks/ds-init"], ["icon-old", "2", "deprecated for icon-search", "yes", "aidd_docs/tasks/retire-old-button"]);
      change(BUTTON, "uses: []", "uses: [icon-old]");
      assert.deepEqual(problems(), [`${BUTTON}: uses "icon-old", which is deprecated`]);
    });
  });

  describe("R11 breakpoints", () => {
    it("reads the declared breakpoints from the system's table", () => {
      change(SYSTEM, "| desktop | (min-width: 64rem) |", "| wide | (min-width: 64rem) |");
      assert.deepEqual(problems(), [`${HOME}: breakpoint "desktop" is not in system.md`]);
    });

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

  describe("R16 review statuses", () => {
    it("names a review with status deprecated", () => {
      change(REVIEW, "status: proposed", "status: deprecated");
      assert.deepEqual(problems(), [`${REVIEW}: status "deprecated" is for elements: reviews are proposed or validated`]);
    });
  });

  describe("R17 usage", () => {
    it("names a component without a usage section", () => {
      change(DIALOG, "## Usage\n\nA decision that blocks the page.\n\n", "");
      assert.deepEqual(problems(), [`${DIALOG}: lacks "## Usage", saying when to use it and when not`]);
    });
  });

  describe("H1 history present", () => {
    it("names a versioned record without a row in history.md", () => {
      change(HISTORY, "| onboarding | 1 | created | no | aidd_docs/tasks/ds-init | |\n", "");
      assert.deepEqual(problems(), [`${JOURNEY}: no row in history.md`]);
    });

    it("names the system without a publication row", () => {
      change(HISTORY, "| system | 1.0.0 | first system | no | aidd_docs/tasks/ds-init | |\n| system | 2.0.0 | old-button retired | yes | aidd_docs/tasks/retire-old-button | |\n", "");
      assert.deepEqual(problems(), [`${SYSTEM}: no row in history.md`]);
    });
  });

  describe("H2 one change per version", () => {
    it("names two rows claiming one version of an element, as a merge of two branches leaves", () => {
      change(HISTORY, "| old-button | 2 | deprecated for button |", "| old-button | 2 | larger label | no | aidd_docs/tasks/ds-init |\n| old-button | 2 | deprecated for button |");
      assert.deepEqual(problems(), [`${HISTORY}: two changes claim version 2 of old-button, renumber one`]);
    });

    it("accepts two elements at one version", () => {
      assert.deepEqual(problems(), []);
    });
  });

  describe("H3 version matches history", () => {
    it("names a version that is not the highest row", () => {
      change(JOURNEY, "version: 1", "version: 2");
      assert.deepEqual(problems(), [`${JOURNEY}: version 2 is not the highest history row, 1`]);
    });

    it("names a gap in the history", () => {
      change(BUTTON, "version: 1", "version: 3");
      addHistory(tmp, ["button", "3", "larger", "no", "aidd_docs/tasks/ds-init"]);
      assert.deepEqual(problems(), [`${BUTTON}: history jumps from 1 to 3`]);
    });
  });

  describe("H4 breaking", () => {
    it("names a breaking value that is neither yes nor no", () => {
      change(HISTORY, "| onboarding | 1 | created | no |", "| onboarding | 1 | created | maybe |");
      assert.deepEqual(problems(), [`${HISTORY}: breaking "maybe" in version 1 of onboarding must be yes or no`]);
    });
  });

  describe("H5 system version follows its publications", () => {
    const FIRST = "| system | 1.0.0 | first system | no | aidd_docs/tasks/ds-init | |";
    const SECOND = "| system | 2.0.0 | old-button retired | yes | aidd_docs/tasks/retire-old-button | |";

    it("names a publication of a breaking task that is not breaking itself", () => {
      change(HISTORY, SECOND, "| system | 2.0.0 | old-button retired | no | aidd_docs/tasks/retire-old-button | |");
      assert.deepEqual(problems(), [`${HISTORY}: 2.0.0 publishes "aidd_docs/tasks/retire-old-button", which breaks an element, so it is breaking`]);
    });

    it("names a breaking publication without a major bump", () => {
      change(HISTORY, "| system | 2.0.0 |", "| system | 1.1.0 |");
      assert.deepEqual(problems(), [`${HISTORY}: 1.1.0 is breaking, yet raises no major version`]);
    });

    it("names a publication that raises neither major nor minor", () => {
      addHistory(tmp, ["system", "2.0.1", "button padding", "no", "aidd_docs/tasks/tweak"]);
      assert.deepEqual(problems(), [`${HISTORY}: 2.0.1 raises neither major nor minor`]);
    });

    it("accepts a breaking publication of tokens alone, which no element history shows", () => {
      addHistory(tmp, ["system", "3.0.0", "color.brand renamed", "yes", "aidd_docs/tasks/rename-brand"]);
      assert.deepEqual(problems(), []);
    });

    it("accepts a publication listing several tasks", () => {
      change(HISTORY, SECOND, "| system | 2.0.0 | old-button retired | yes | aidd_docs/tasks/ds-init, aidd_docs/tasks/retire-old-button | |");
      assert.deepEqual(problems(), []);
    });

    it("reads a newest-first system history by version", () => {
      change(HISTORY, `${FIRST}\n${SECOND}`, `${SECOND}\n${FIRST}`);
      assert.deepEqual(problems(), []);
    });

    it("accepts an element task no publication lists yet, as two parallel features leave", () => {
      change(HISTORY, "| onboarding | 1 | created | no | aidd_docs/tasks/ds-init |", "| onboarding | 1 | created | no | aidd_docs/tasks/new-flow |");
      assert.deepEqual(problems(), []);
    });
  });

  describe("H6 deprecation breaks", () => {
    it("names a deprecated record whose last row is not breaking", () => {
      change(HISTORY, "| old-button | 2 | deprecated for button | yes |", "| old-button | 2 | deprecated for button | no |");
      assert.deepEqual(problems(), [`${OLD}: deprecated, yet its last history row is not breaking`]);
    });
  });

  describe("H7 tasks are folders", () => {
    it("names an element task that is not a task folder", () => {
      change(HISTORY, "| onboarding | 1 | created | no | aidd_docs/tasks/ds-init |", "| onboarding | 1 | created | no | ds-init |");
      assert.deepEqual(problems(), [`${HISTORY}: task "ds-init" in version 1 of onboarding must be a task folder, aidd_docs/tasks/…`]);
    });

    it("names a published task that is not a task folder", () => {
      change(HISTORY, "| system | 2.0.0 | old-button retired | yes | aidd_docs/tasks/retire-old-button |", "| system | 2.0.0 | old-button retired | yes | aidd_docs/tasks/retire-old-button, PROJ-12 |");
      assert.deepEqual(problems(), [`${HISTORY}: task "PROJ-12" in version 2.0.0 of system must be a task folder, aidd_docs/tasks/…`]);
    });
  });

  describe("H8 validated as fingerprinted", () => {
    /** Only H8's own problems, as `file: message`. */
    const held = () => ledger.note(historyRules.check(load(tmp))).filter((found) => found.rule === "H8").map((found) => `${found.file}: ${found.message}`);
    /** Every problem of every check, as the engine reports them. */
    const whole = () => ledger.note(problemsOf(load(tmp))).map((found) => `${found.file}: ${found.message}`);
    const EDITED = (file, version = 1) => `${file}: edited since version ${version} was validated, raise its version with bump`;
    const THROUGH = (...files) => files.map((file) => EDITED(file));
    /** Sets the Fingerprint cell of the history row of `id` at `version`. */
    const setFingerprint = (id, version, cell) => {
      const file = path.join(tmp, HISTORY);
      const rows = fs.readFileSync(file, "utf8").split("\n").map((line) => {
        const cells = line.split("|").slice(1, -1).map((each) => each.trim());
        return cells[0] === id && cells[1] === version ? `| ${[...cells.slice(0, 5), cell].join(" | ")} |` : line;
      });
      fs.writeFileSync(file, rows.join("\n"));
    };

    it("passes the valid project, every validated element fingerprinted", () => {
      assert.deepEqual(held(), []);
    });

    it("hashes the record without its status, then the asset's bytes, each part labelled and NUL-ended, to 12 hex characters", () => {
      const recordText = fs.readFileSync(path.join(tmp, ICON), "utf8").replace("status: validated\n", "");
      const hash = crypto.createHash("sha256");
      for (const [label, content] of [["record", recordText], ["asset", fs.readFileSync(path.join(tmp, UI, "assets/icon-search.svg"))], ["tokens", ""]]) hash.update(`${label}\0`).update(content).update("\0");
      assert.equal(historyRules.fingerprint(load(tmp), load(tmp).records.find((each) => each.file === ICON)), hash.digest("hex").slice(0, 12));
    });

    it("names a validated element without a fingerprint", () => {
      setFingerprint("button", "1", "");
      assert.deepEqual(held(), [`${BUTTON}: validated without a fingerprint, run publish button`]);
    });

    it("names a validated element whose text changed and whose version did not", () => {
      change(BUTTON, BUTTON_USAGE, WIDENED);
      assert.deepEqual(held(), [EDITED(BUTTON)]);
    });

    it("names a validated element whose render changed", () => {
      edit(tmp, BUTTON_RENDER, "</body>", "<!-- one more look -->\n</body>");
      assert.deepEqual(held(), [EDITED(BUTTON)]);
    });

    it("names a validated asset whose file changed", () => {
      edit(tmp, `${UI}/assets/icon-search.svg`, 'r="7"', 'r="8"');
      assert.deepEqual(held(), [EDITED(ICON)]);
    });

    it("reads a screen as an element", () => {
      edit(tmp, HOME_RENDER, "</body>", "<!-- one more look -->\n</body>");
      assert.deepEqual(held(), [EDITED(HOME)]);
    });

    it("names a deleted render too, beside V1", () => {
      fs.rmSync(path.join(tmp, BUTTON_RENDER));
      assert.deepEqual(whole(), [EDITED(BUTTON), `${BUTTON}: no render beside it, expected button.html`]);
    });

    it("stays silent when only the code link changed", () => {
      change(BUTTON, "code: src/ui/Button.tsx#Button@1", "code: src/ui/Button.tsx#Primary@1");
      assert.deepEqual(held(), []);
    });

    it("stays silent for a proposed element: it is still being designed", () => {
      change(BUTTON, "status: validated", "status: proposed");
      change(BUTTON, BUTTON_USAGE, WIDENED);
      assert.deepEqual(held(), []);
    });

    it("holds a deprecated element only once its row carries a fingerprint, and never to its status", () => {
      change(OLD, "Nowhere: replaced by button.", "Nowhere: use button.");
      assert.deepEqual(held(), []);
      change(BUTTON, "status: validated", "status: deprecated");
      assert.deepEqual(held(), []);
      setFingerprint("old-button", "2", "000000000000");
      assert.deepEqual(held(), [EDITED(OLD, 2)]);
    });

    it("reads a record written with CRLF line ends as the one fingerprinted", () => {
      const file = path.join(tmp, BUTTON);
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replaceAll("\n", "\r\n"));
      assert.deepEqual(held(), []);
    });

    it("reads a history table written before the Fingerprint column, a validated element then unfingerprinted", () => {
      const file = path.join(tmp, HISTORY);
      const fiveColumns = fs.readFileSync(file, "utf8").split("\n").map((line) => line.replace(/ \| [^|]*\|$/, " |")).join("\n");
      fs.writeFileSync(file, fiveColumns);
      const unfingerprinted = [[ICON, "icon-search"], [BUTTON, "button"], [DIALOG, "dialog"], [SEARCH, "search-field"], [HOME, "home"]];
      assert.deepEqual(held(), unfingerprinted.map(([file, id]) => `${file}: validated without a fingerprint, run publish ${id}`));
    });

    describe("a token value that changed", () => {
      it("names the validated element declaring it, and each one using that element", () => {
        editTokens(tmp, (tree) => (tree.font.weight.bold.$value = 600));
        assert.deepEqual(held(), THROUGH(BUTTON, DIALOG, SEARCH, HOME));
      });

      it("reaches it through an alias, and leaves a deprecated element without a fingerprint as it is", () => {
        editTokens(tmp, (tree) => (tree.color.brand.primary.$value = { colorSpace: "srgb", components: [0.1, 0.1, 0.1], hex: "#1a1a1a" }));
        assert.deepEqual(held(), THROUGH(BUTTON, DIALOG, SEARCH, HOME));
      });

      it("reaches it in a theme", () => {
        edit(tmp, `${UI}/themes/dark.json`, "#6699cc", "#112233");
        editTokens(tmp, () => {});
        assert.deepEqual(held(), THROUGH(BUTTON, DIALOG, SEARCH, HOME));
      });

      it("reaches a value only a breakpoint file holds", () => {
        edit(tmp, `${UI}/breakpoints/desktop.json`, '"value": 1.5', '"value": 2');
        editTokens(tmp, () => {});
        assert.deepEqual(held(), THROUGH(BUTTON, DIALOG, SEARCH, HOME));
      });

      it("reaches a media query that changed", () => {
        edit(tmp, `${UI}/tokens.resolver.json`, "(min-width: 64rem)", "(min-width: 80rem)");
        editTokens(tmp, () => {});
        assert.deepEqual(held(), THROUGH(BUTTON, DIALOG, SEARCH, HOME));
      });

      it("reaches a theme added, whose values every token-using element now shows", () => {
        put(tmp, `${UI}/themes/sepia.json`, JSON.stringify({ color: { brand: { primary: { $value: { colorSpace: "srgb", components: [0.5, 0.4, 0.3], hex: "#80664d" } } } } }));
        edit(tmp, `${UI}/tokens.resolver.json`, '"dark": [', '"sepia": [{ "$ref": "themes/sepia.json" }],\n        "dark": [');
        edit(tmp, SYSTEM, "themes: [light, dark]", "themes: [light, sepia, dark]");
        editTokens(tmp, () => {});
        assert.deepEqual(held(), THROUGH(BUTTON, DIALOG, SEARCH, HOME));
      });

      it("stays silent when nothing moved", () => {
        editTokens(tmp, () => {});
        assert.deepEqual(held(), []);
      });

      it("stays silent for a token no element uses", () => {
        editTokens(tmp, (tree) => (tree.misc = { unused: { $type: "number", $value: 1 } }));
        assert.deepEqual(held(), []);
      });

      it("stays silent once bump raised every reached element", () => {
        editTokens(tmp, (tree) => (tree.font.weight.bold.$value = 600));
        assert.equal(engine("bump", "--task", "aidd_docs/tasks/lighten", "--change", "lighter bold", "font.weight.bold", "--root", tmp).status, 0);
        assert.deepEqual(held(), []);
      });
    });
  });

  describe("H9 removal", () => {
    const REMOVE_OLD = ["old-button", "3", "removed", "yes", "aidd_docs/tasks/drop-old-button"];
    const deleteOld = () => ["components/old-button.md", "components/old-button.html"].forEach((name) => fs.rmSync(path.join(tmp, UI, name)));

    it("names a removed id whose record is still there, and no version gap for it", () => {
      addHistory(tmp, REMOVE_OLD);
      assert.deepEqual(problems(), [`${OLD}: removed in history.md, delete its record and render`]);
    });

    it("accepts a removed id once its record and render are gone, H1 included", () => {
      addHistory(tmp, REMOVE_OLD);
      deleteOld();
      assert.deepEqual(problems(), []);
    });

    it("names an id with history and no record, removed by no row", () => {
      deleteOld();
      assert.deepEqual(problems(), [`${HISTORY}: old-button has history but no record: restore it or run bump --removed`]);
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
  });
});

// Every rule case above notes the problems it saw; each carries a fix, and this table pins the rule, message, excerpt
// and fix of all of them (`-` for no excerpt). It reads what the cases before it saw, so it runs with the whole file.
const FIXES = [
  "H1 | no row in history.md | - | run bump --task <folder> --created onboarding",
  "H1 | no row in history.md | - | run bump --task <folder> --created system",
  "H2 | two changes claim version 2 of old-button, renumber one | \"old-button 2\" | renumber one of the rows",
  "H3 | history jumps from 1 to 3 | \"1 to 3\" | renumber the rows so each version follows the last",
  "H3 | version 2 is not the highest history row, 1 | \"2\" | set version to 1, the highest history row",
  "H4 | breaking \"maybe\" in version 1 of onboarding must be yes or no | \"maybe\" | set Breaking to yes or no",
  "H5 | 1.1.0 is breaking, yet raises no major version | \"1.1.0\" | raise the major version, or set Breaking to no",
  "H5 | 2.0.0 publishes \"aidd_docs/tasks/retire-old-button\", which breaks an element, so it is breaking | \"aidd_docs/tasks/retire-old-button\" | set Breaking to yes and raise the major version",
  "H5 | 2.0.1 raises neither major nor minor | \"2.0.1\" | raise the minor or the major version",
  "H6 | deprecated, yet its last history row is not breaking | - | raise its version as a breaking change with bump --task <folder> --change <text> --breaking button",
  "H6 | deprecated, yet its last history row is not breaking | - | raise its version as a breaking change with bump --task <folder> --change <text> --breaking old-button",
  "H7 | task \"PROJ-12\" in version 2.0.0 of system must be a task folder, aidd_docs/tasks/… | \"PROJ-12\" | name a task folder, aidd_docs/tasks/…",
  "H7 | task \"ds-init\" in version 1 of onboarding must be a task folder, aidd_docs/tasks/… | \"ds-init\" | name a task folder, aidd_docs/tasks/…",
  "H8 | edited since version 1 was validated, raise its version with bump | - | raise its version with bump --task <folder> --change <text> button",
  "H8 | edited since version 1 was validated, raise its version with bump | - | raise its version with bump --task <folder> --change <text> dialog",
  "H8 | edited since version 1 was validated, raise its version with bump | - | raise its version with bump --task <folder> --change <text> home",
  "H8 | edited since version 1 was validated, raise its version with bump | - | raise its version with bump --task <folder> --change <text> icon-search",
  "H8 | edited since version 1 was validated, raise its version with bump | - | raise its version with bump --task <folder> --change <text> search-field",
  "H8 | edited since version 2 was validated, raise its version with bump | - | raise its version with bump --task <folder> --change <text> old-button",
  "H8 | validated without a fingerprint, run publish button | - | run publish button",
  "H8 | validated without a fingerprint, run publish dialog | - | run publish dialog",
  "H8 | validated without a fingerprint, run publish home | - | run publish home",
  "H8 | validated without a fingerprint, run publish icon-search | - | run publish icon-search",
  "H8 | validated without a fingerprint, run publish search-field | - | run publish search-field",
  "H9 | old-button has history but no record: restore it or run bump --removed | \"old-button\" | restore its record, or run bump --task <folder> --removed old-button",
  "H9 | removed in history.md, delete its record and render | - | delete its record and render",
  "R1 | line 1: no front matter, open and close it with a --- line | - | open and close the front matter with a --- line",
  "R1 | line 7: expected \"key: value\" or \"key: [a, b]\", got \"- nested\" | \"- nested\" | write the line as key: value or key: [a, b]",
  "R10 | uses \"icon-old\", which is deprecated | \"icon-old\" | use what replaces it instead",
  "R10 | uses \"old-button\", which is deprecated | \"old-button\" | use what replaces it instead",
  "R11 | breakpoint \"desktop\" is not in system.md | \"desktop\" | use a breakpoint of system.md, or add it there",
  "R11 | breakpoint \"tablet\" is not in system.md | \"tablet\" | use a breakpoint of system.md, or add it there",
  "R12 | step 2 names screen \"ghost\", which no screen has | \"ghost\" | name a screen that exists, or add it",
  "R13 | no verdict row for home / loading at version 1 | - | add a row for home / loading at version 1 to \"## Verdicts\"",
  "R13 | verdict \"maybe\" for home / default must be ok, ko or pending | \"maybe\" | set the verdict to ok, ko or pending",
  "R14 | lacks \"## Users\" | - | add a \"## Users\" section",
  "R15 | file \"missing.svg\" does not exist beside it | \"missing.svg\" | add the file beside the record, or correct file",
  "R16 | status \"deprecated\" is for elements: reviews are proposed or validated | \"deprecated\" | set status to proposed or validated",
  "R17 | lacks \"## Usage\", saying when to use it and when not | - | add a \"## Usage\" section saying when to use it and when not",
  "R2 | kind \"atom\" does not belong in constructor/ | \"atom\" | move it to the folder of its kind, or change its kind",
  "R2 | kind \"atom\" does not belong in screens/ | \"atom\" | move it to the folder of its kind, or change its kind",
  "R2 | unknown kind \"toString\" | \"toString\" | set kind to system, brand, atom, molecule, composition, screen, journey, asset or review",
  "R2 | unknown kind \"widget\" | \"widget\" | set kind to system, brand, atom, molecule, composition, screen, journey, asset or review",
  "R3 | missing key \"alt\" | - | add the key \"alt\" to the front matter",
  "R3 | missing key \"format\" | - | add the key \"format\" to the front matter",
  "R3 | missing key \"locales\" | - | add the key \"locales\" to the front matter",
  "R3 | missing key \"persona\" | - | add the key \"persona\" to the front matter",
  "R3 | missing key \"role\" | - | add the key \"role\" to the front matter",
  "R3 | missing key \"route\" | - | add the key \"route\" to the front matter",
  "R3 | missing key \"scope\" | - | add the key \"scope\" to the front matter",
  "R3 | missing key \"version\" | - | add the key \"version\" to the front matter",
  "R3 | status \"done\" must be proposed, validated or deprecated | \"done\" | set status to proposed, validated or deprecated",
  "R3 | type \"photo\" must be icon, image or illustration | \"photo\" | set type to icon, image or illustration",
  "R3 | variant \"=sm\": axis \"\" must match [a-z][a-z-]* | \"=sm\" | name the axis in lowercase letters and hyphens",
  "R3 | variant \"Size=sm\": axis \"Size\" must match [a-z][a-z-]* | \"Size=sm\" | name the axis in lowercase letters and hyphens",
  "R3 | variant \"size=\": no value | \"size=\" | give the variant a value after =",
  "R3 | variant \"state=hover\": axis \"state\" is taken, data-state shows the states | \"state=hover\" | rename the axis",
  "R3 | variant \"theme=dark\": axis \"theme\" is taken, data-theme switches the token theme | \"theme=dark\" | rename the axis",
  "R3 | variant \"variant=big\": axis \"variant\" is taken, data-variant shows the bare variants | \"variant=big\" | rename the axis",
  "R4 | id \"brand\" already belongs to aidd_docs/ui/brand.md | \"brand\" | give it an id no other record has",
  "R4 | id \"onboard\" differs from the file name \"onboarding\" | \"onboard\" | make the id the file name",
  "R5 | version \"0\" must be an integer from 1 | \"0\" | set version to an integer from 1",
  "R5 | version \"1.0\" of system must be semver, such as 2.0.0 | \"1.0\" | write the version as semver, such as 2.0.0",
  "R5 | version \"v2\" must be an integer from 1 | \"v2\" | set version to an integer from 1",
  "R6 | atom cannot use molecule \"search-field\" | \"search-field\" | use only elements of its own level or lower",
  "R6 | molecule cannot use composition \"dialog\" | \"dialog\" | use only elements of its own level or lower",
  "R6 | uses \"ghost\", which no record has | \"ghost\" | remove it from uses, or add the record",
  "R6 | uses itself | - | remove its own id from uses",
  "R7 | component lacks state \"default\" | - | add \"default\" to states",
  "R7 | screen lacks state \"default\" | - | add \"default\" to states",
  "R7 | state \"focus\" needs a \"## Keyboard\" section | - | add a \"## Keyboard\" section",
  "R8 | code is for components and screens, never an asset | \"code\" | remove it from the front matter",
  "R8 | platform \"android\" is not in system.md | \"android\" | list a platform system.md declares, or declare it there",
  "R8 | platform \"ios\" is not in system.md | \"ios\" | list a platform system.md declares, or declare it there",
  "R8 | platforms is for components and screens, never a journey | \"platforms\" | remove it from the front matter",
  "R9 | replaced-by \"ghost\", which no record has | \"ghost\" | point replaced-by at an existing record, or none",
  "R9 | replaced-by \"old-button\" is deprecated too | \"old-button\" | point replaced-by at a record that is not deprecated",
  "R9 | replaced-by none needs a \"## Deprecation\" section saying why | - | add a \"## Deprecation\" section saying why",
  "R9 | status deprecated needs \"replaced-by\" | - | add \"replaced-by\" naming its replacement, or none",
  "V1 | no render beside it, expected button.html | \"button.html\" | write the render beside it",
];

describe("aidd-ui fixes of the history and record rules", () => {
  it("pins the fix, and the excerpt where one applies, of every problem the cases above named", () => {
    assert.deepEqual(ledger.seen(), [...FIXES].sort());
  });
});
