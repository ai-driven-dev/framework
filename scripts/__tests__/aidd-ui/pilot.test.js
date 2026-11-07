const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, makeTmp, removeTmp, writeProject, edit, put } = require("../fixtures/aidd-ui/project.js");
const { copyProject, snapshot, changedOutsideUi, verdict, stepsWithoutWireframe, reportLine, requestOf, CHAIN, REQUESTS, chatsOf, pilotsOf } = require("../../aidd-ui-pilot.cjs");

// The pilot's checks hold without AI: they read files, run the engine, and compare trees.

const git = (cwd, ...args) => {
  const run = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "core.hooksPath=/dev/null", ...args], { cwd, encoding: "utf8", env: Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_"))) });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
};

let source;
let copy;

beforeEach(() => {
  source = makeTmp("aidd-ui-pilot-source-");
  copy = makeTmp("aidd-ui-pilot-copy-");
});

afterEach(() => {
  removeTmp(source);
  removeTmp(copy);
});

/** A git repository holding one tracked file, one ignored file and one untracked file. */
function repository(dir) {
  git(dir, "init", "-q");
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src/app.js"), "tracked\n");
  fs.writeFileSync(path.join(dir, ".gitignore"), "ignored.txt\n");
  git(dir, "add", "src/app.js", ".gitignore");
  git(dir, "commit", "-q", "-m", "init", "--no-verify");
  fs.writeFileSync(path.join(dir, "ignored.txt"), "ignored\n");
  fs.writeFileSync(path.join(dir, "untracked.txt"), "untracked\n");
}

describe("aidd-ui pilot copy", () => {
  it("holds the tracked files alone, as a committed repository, and leaves the source as it was", () => {
    repository(source);
    const before = snapshot(source);
    copyProject(source, copy);
    assert.deepEqual(Object.keys(snapshot(copy)).sort(), [".gitignore", "src/app.js"]);
    assert.equal(git(copy, "rev-list", "--count", "HEAD").trim(), "1");
    assert.equal(git(copy, "status", "--porcelain"), "");
    assert.deepEqual(snapshot(source), before);
  });

  it("reports no change for what is written under aidd_docs/ui/ or in .git/", () => {
    repository(source);
    copyProject(source, copy);
    const before = snapshot(copy);
    fs.mkdirSync(path.join(copy, UI), { recursive: true });
    fs.writeFileSync(path.join(copy, UI, "brand.md"), "brand\n");
    git(copy, "tag", "pilot");
    assert.deepEqual(changedOutsideUi(before, snapshot(copy)), []);
  });

  it("reports an added, a modified and a deleted file outside aidd_docs/ui/, each once", () => {
    repository(source);
    copyProject(source, copy);
    const before = snapshot(copy);
    fs.writeFileSync(path.join(copy, "added.js"), "new\n");
    fs.writeFileSync(path.join(copy, "src/app.js"), "changed\n");
    fs.rmSync(path.join(copy, ".gitignore"));
    assert.deepEqual(changedOutsideUi(before, snapshot(copy)), [".gitignore", "added.js", "src/app.js"]);
  });
});

describe("aidd-ui pilot under a caller's git variables", () => {
  it("acts on its own repositories, never on the one GIT_DIR names", () => {
    const decoy = path.join(copy, "decoy");
    const caller = { dir: process.env.GIT_DIR, index: process.env.GIT_INDEX_FILE };
    process.env.GIT_DIR = decoy;
    process.env.GIT_INDEX_FILE = path.join(decoy, "index");
    try {
      repository(source);
      copyProject(source, copy);
      assert.equal(fs.existsSync(decoy), false);
      assert.equal(fs.existsSync(path.join(source, ".git")), true);
      assert.equal(fs.existsSync(path.join(copy, ".git")), true);
    } finally {
      for (const [name, value] of [["GIT_DIR", caller.dir], ["GIT_INDEX_FILE", caller.index]]) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
});

describe("aidd-ui pilot snapshot", () => {
  it("holds a link to a folder as the link itself, and reports its target changing", () => {
    fs.mkdirSync(path.join(copy, "real"));
    fs.writeFileSync(path.join(copy, "real/a.js"), "a\n");
    fs.symlinkSync("real", path.join(copy, "link"));
    const before = snapshot(copy);
    assert.deepEqual(Object.keys(before).sort(), ["link", "real/a.js"]);
    fs.rmSync(path.join(copy, "link"));
    fs.symlinkSync("elsewhere", path.join(copy, "link"));
    assert.deepEqual(changedOutsideUi(before, snapshot(copy)), ["link"]);
  });
});

describe("aidd-ui pilot verdict", () => {
  beforeEach(() => writeProject(copy));

  it("holds no error and no warning on a valid project", () => {
    assert.deepEqual(verdict(copy), { errors: [], warnings: [] });
  });

  it("names the rule of a missing token file as an error", () => {
    fs.rmSync(path.join(copy, UI, "tokens.json"));
    assert.deepEqual(verdict(copy), { errors: ["T1"], warnings: [] });
  });

  it("lists each failing rule once, sorted", () => {
    for (const render of ["dialog", "button"]) fs.rmSync(path.join(copy, UI, `components/${render}.html`));
    edit(copy, `${UI}/journeys/onboarding.md`, "| search-flow |", "| nowhere |");
    assert.deepEqual(verdict(copy), { errors: ["H8", "R12", "V1"], warnings: [] });
  });

  it("keeps a warning apart from the errors, as the engine marks it", () => {
    edit(copy, `${UI}/wireframes/search-flow.md`, "uses: [search-field]", "uses: [search-field, ghost]");
    assert.deepEqual(verdict(copy), { errors: [], warnings: ["R18"] });
    fs.rmSync(path.join(copy, UI, "tokens.json"));
    assert.deepEqual(verdict(copy), { errors: ["T1"], warnings: ["R18"] });
  });
});

describe("aidd-ui pilot journey steps", () => {
  beforeEach(() => writeProject(copy));

  it("lists no step when each names a wireframe", () => {
    edit(copy, `${UI}/journeys/onboarding.md`, "| home |", "| search-flow |");
    assert.deepEqual(stepsWithoutWireframe(copy), []);
  });

  it("lists a step naming a screen, and one naming nothing known", () => {
    put(copy, `${UI}/journeys/onboarding.md`, fs.readFileSync(path.join(copy, UI, "journeys/onboarding.md"), "utf8").replace("| search-flow | narrows", "| nowhere | narrows"));
    assert.deepEqual(
      stepsWithoutWireframe(copy).map((step) => `${step.journey} ${step.screen}`),
      ["onboarding home", "onboarding home", "onboarding nowhere"]
    );
  });
});

describe("aidd-ui pilot report line", () => {
  it("says the errors, the warnings, the wireframes and the code in one line", () => {
    assert.equal(reportLine("blank", { errors: [], warnings: [], missing: [], changed: [] }), "blank errors none warnings none wireframes all code untouched");
    assert.equal(reportLine("kairos", { errors: ["C6"], warnings: ["C3", "R18"], missing: [1, 2], changed: ["a"] }), "kairos errors C6 warnings C3,R18 wireframes missing 2 code changed 1");
  });
});

describe("aidd-ui pilot chain", () => {
  it("sends one request per skill, in the order of the path", () => {
    assert.deepEqual(CHAIN.map(([skill]) => skill), ["01-journeys", "02-brand", "03-foundations", "04-components"]);
    assert.deepEqual(CHAIN.map(([, parts]) => parts), [["journeys"], ["brand"], ["foundations"], ["components"]]);
  });

  it("sends each part of a pilot's request once, whole", () => {
    for (const pilot of ["blank", "real"]) {
      const requests = CHAIN.map(([skill, parts]) => requestOf(pilot, skill, parts));
      for (const [part, words] of Object.entries(REQUESTS[pilot])) assert.equal(requests.filter((request) => request.includes(words)).length, 1, `${pilot} ${part}`);
      requests.forEach((request, at) => assert.ok(request.startsWith(`/aidd-ui:${CHAIN[at][0]} `), request));
    }
  });
});

describe("aidd-ui pilot chats", () => {
  it("finds the chat folders of one copy, no other", () => {
    const names = [
      "-tmp-x-aidd-ui-pilot-ab12CD-kairos",
      "-tmp-y-aidd-ui-pilot-ab12CD-kairos",
      "-tmp-x-aidd-ui-pilot-ab12CD-blank",
      "-tmp-x-aidd-ui-pilot-zz99YY-kairos",
      "-tmp-x-aidd-ui-pilot-ab12CD-kairos-2",
      "-Users-someone-project",
    ];
    assert.deepEqual(chatsOf(names, "/tmp/x/aidd-ui-pilot-ab12CD/kairos"), ["-tmp-x-aidd-ui-pilot-ab12CD-kairos", "-tmp-y-aidd-ui-pilot-ab12CD-kairos"]);
  });
});

describe("aidd-ui pilot arguments", () => {
  it("runs blank, then each checkout named, from where it is named", () => {
    assert.deepEqual(pilotsOf(["--gouvernail", "/g", "--kairos", "/k"]), [["blank", null], ["gouvernail", "/g"], ["kairos", "/k"]]);
  });

  it("runs the one pilot --only names", () => {
    assert.deepEqual(pilotsOf(["--gouvernail", "/g", "--kairos", "/k", "--only", "kairos"]), [["kairos", "/k"]]);
    assert.deepEqual(pilotsOf(["--gouvernail", "/g", "--kairos", "/k", "--only", "blank"]), [["blank", null]]);
  });

  it("refuses a missing checkout", () => {
    assert.equal(pilotsOf(["--gouvernail", "/g"]), null);
    assert.equal(pilotsOf([]), null);
  });
});
