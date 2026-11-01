const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const childProcess = require("node:child_process");
const { UI, writeProject, edit, put, git, commitAll } = require("./fixtures/aidd-ui/project.js");

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

    it("leaves a test file and a mock folder out of the backlog, as C4 does", () => {
      put(tmp, "src/ui/__tests__/orphan.tsx", "test();\n");
      put(tmp, "src/ui/__mocks__/data.ts", "export const data = {};\n");
      put(tmp, "src/ui/Orphan.spec.ts", "test();\n");
      assert.deepEqual(problems(), []);
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

  describe("C4 severity", () => {
    const LITERAL = 'const style = "color: #ff0000";';
    const WARNING = "warning";
    const ERROR = "error";
    /** Each C4 problem's severity and file. */
    const severities = (project = load(tmp)) => code.check(project).filter((found) => found.rule === "C4").map((found) => `${found.severity} ${found.file}`);
    const BUTTON_FILE = "src/ui/Button.tsx";
    const HOME_FILE = "src/ui/HomePage.tsx";

    it("warns on a literal in a file identical to HEAD: existing debt", () => {
      append(BUTTON_FILE, LITERAL);
      commitAll(tmp);
      assert.deepEqual(severities(), [`${WARNING} ${BUTTON_FILE}`]);
    });

    it("still warns on a committed file touched without a change, as a formatter leaves it", () => {
      append(BUTTON_FILE, LITERAL);
      commitAll(tmp);
      const later = new Date(Date.now() + 60_000);
      fs.utimesSync(path.join(tmp, BUTTON_FILE), later, later);
      assert.deepEqual(severities(), [`${WARNING} ${BUTTON_FILE}`]);
    });

    it("warns on a committed file whose path holds pattern characters", () => {
      put(tmp, "src/ui/[id]/Page.tsx", `${LITERAL}\n`);
      commitAll(tmp);
      assert.deepEqual(severities(), [`${WARNING} src/ui/[id]/Page.tsx`]);
    });

    it("errs on every literal of a file edited since HEAD, the old ones with the new", () => {
      append(BUTTON_FILE, LITERAL);
      commitAll(tmp);
      append(BUTTON_FILE, "// edited");
      assert.deepEqual(severities(), [`${ERROR} ${BUTTON_FILE}`]);
    });

    it("errs on a literal in an untracked file, and warns on the committed one beside it", () => {
      append(BUTTON_FILE, LITERAL);
      commitAll(tmp);
      put(tmp, "src/ui/New.tsx", `${LITERAL}\n`);
      assert.deepEqual(severities(), [`${WARNING} ${BUTTON_FILE}`, `${ERROR} src/ui/New.tsx`]);
    });

    it("errs in a folder that is no repository", () => {
      append(BUTTON_FILE, LITERAL);
      assert.deepEqual(severities(), [`${ERROR} ${BUTTON_FILE}`]);
    });

    it("errs in a repository with no commit, which is no failure of git", () => {
      append(BUTTON_FILE, LITERAL);
      git(tmp, "init", "-q");
      const project = load(tmp);
      assert.deepEqual(severities(project), [`${ERROR} ${BUTTON_FILE}`]);
      assert.equal(project.gitFailure, undefined);
    });

    it("errs when git is not installed", () => {
      append(BUTTON_FILE, LITERAL);
      commitAll(tmp);
      const path_ = process.env.PATH;
      process.env.PATH = os.tmpdir();
      try {
        assert.deepEqual(severities(), [`${ERROR} ${BUTTON_FILE}`]);
      } finally {
        process.env.PATH = path_;
      }
    });

    it("reads the files of a project below the repository's root", () => {
      const inner = path.join(tmp, "apps/web");
      writeProject(inner);
      append(`apps/web/${BUTTON_FILE}`, LITERAL);
      commitAll(tmp);
      assert.deepEqual(severities(load(inner)), [`${WARNING} ${BUTTON_FILE}`]);
    });

    describe("a git that fails", { skip: process.platform === "win32" }, () => {
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

      it("keeps the error when it refuses the repository", () => {
        append(BUTTON_FILE, LITERAL);
        commitAll(tmp);
        assert.deepEqual(withGit('echo "fatal: detected dubious ownership" >&2\nexit 128', severities), [`${ERROR} ${BUTTON_FILE}`]);
      });

      it("keeps the error when only the hash of the current files fails", () => {
        append(BUTTON_FILE, LITERAL);
        commitAll(tmp);
        const real = `PATH='${process.env.PATH}' exec git "$@"`;
        assert.deepEqual(withGit(`[ "$1" = hash-object ] && { echo "fatal: cannot hash" >&2; exit 128; }\n${real}`, severities), [`${ERROR} ${BUTTON_FILE}`]);
      });
    });

    describe("git calls", () => {
      afterEach(() => mock.restoreAll());
      const gitCalls = () => {
        const spy = mock.method(childProcess, "execFileSync");
        severities();
        return spy.mock.calls.map((call) => call.arguments[1][0]);
      };

      it("asks git nothing when C4 finds nothing", () => {
        commitAll(tmp);
        assert.deepEqual(gitCalls(), []);
      });

      it("asks git the same two questions however many files hold a literal", () => {
        append(BUTTON_FILE, LITERAL);
        append(HOME_FILE, LITERAL);
        commitAll(tmp);
        assert.deepEqual(gitCalls(), ["ls-tree", "hash-object"]);
      });
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
      linkSearch(HERO);
    };

    it("links by a bare path, an Astro component having no named export", () => {
      hero("---\n---\n<h1>Hero</h1>\n");
      assert.deepEqual(problems(), []);
    });

    it("still takes a path#Export link, the export being checked", () => {
      hero("---\n---\n<h1>Hero</h1>\n");
      edit(tmp, SEARCH, `code: ${HERO}`, `code: ${HERO}#Missing`);
      assert.deepEqual(problems(), [`${SEARCH}: export "Missing" is not in ${HERO}`]);
    });

    it("finds a colour literal in its style block, with its line", () => {
      hero("---\n---\n<style>\n  h1 { color: #ff0000; }\n</style>\n");
      assert.deepEqual(problems(), [`${HERO}: line 4: colour literal "#ff0000", use a token`]);
    });

    it("finds a colour literal in a string, and leaves one in its markup text alone", () => {
      hero('---\nconst c = "#ff0000";\n---\n<p>Rapport #412 and #add</p>\n');
      assert.deepEqual(problems(), [`${HERO}: line 2: colour literal "#ff0000", use a token`]);
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
