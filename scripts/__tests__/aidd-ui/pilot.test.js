const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, makeTmp, removeTmp, filesUnder, writeProject, edit, put } = require("../fixtures/aidd-ui/project.js");
const { copyProject, snapshot, changedOutsideUi, verdict, stepsWithoutWireframe, reportLine, requestOf, CHAIN, REQUESTS, OWNED, ENGINE_FILES, stepBreaks, chatsOf, pilotsOf, main } = require("../../aidd-ui-pilot.cjs");

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

describe("aidd-ui pilot journey steps, none to judge", () => {
  it("returns null when nothing loads", () => {
    assert.equal(stepsWithoutWireframe(copy), null);
  });

  it("returns null when the design system holds no journey step", () => {
    writeProject(copy);
    fs.rmSync(path.join(copy, UI, "journeys/onboarding.md"));
    assert.equal(stepsWithoutWireframe(copy), null);
  });
});

describe("aidd-ui pilot report line", () => {
  it("says the errors, the warnings, the wireframes, the code and the steps in one line", () => {
    assert.equal(reportLine("blank", { errors: [], warnings: [], missing: [], changed: [], broken: [] }), "blank errors none warnings none wireframes all code untouched steps ok");
    assert.equal(reportLine("kairos", { errors: ["C6"], warnings: ["C3", "R18"], missing: [1, 2], changed: ["a"], broken: ["x", "y", "z"] }), "kairos errors C6 warnings C3,R18 wireframes missing 2 code changed 1 steps broken 3");
  });

  it("says no journey when there is no step to judge", () => {
    assert.equal(reportLine("blank", { errors: [], warnings: [], missing: null, changed: [], broken: [] }), "blank errors none warnings none wireframes no journey code untouched steps ok");
  });
});

describe("aidd-ui pilot step files", () => {
  const ui = (rel) => `${UI}/${rel}`;
  const hashes = (files) => Object.fromEntries(files.map((file) => [file, file]));
  const after = (...written) => hashes(written.map(ui));

  it("owns the files each skill's Write only line names", () => {
    const SKILLS = path.resolve(__dirname, "../../../plugins/aidd-ui/skills");
    for (const [skill, entries] of Object.entries(OWNED)) {
      const line = fs.readFileSync(path.join(SKILLS, skill, "SKILL.md"), "utf8").split("\n").find((each) => each.startsWith("- Write only"));
      for (const entry of entries) assert.ok(line.includes(entry), `${skill}: ${entry}`);
    }
  });

  it("names a step and the path it wrote outside its set", () => {
    assert.deepEqual(stepBreaks("02-brand", {}, after("brand.md", "system.md")), ["02-brand wrote aidd_docs/ui/system.md"]);
    assert.deepEqual(stepBreaks("02-brand", {}, { ...after("brand.md"), "src/app.js": "x" }), ["02-brand wrote src/app.js"]);
    assert.deepEqual(stepBreaks("04-components", {}, after("components/a.md", "assets/b.md", "journeys/c.md")), ["04-components wrote aidd_docs/ui/journeys/c.md"]);
  });

  it("allows each file of its set, a folder's file included, and the engine's files", () => {
    for (const [skill, entries] of Object.entries(OWNED)) {
      const files = entries.map((entry) => (entry.endsWith("/") ? `${entry}x.md` : entry));
      assert.deepEqual(stepBreaks(skill, {}, after(...files, ...ENGINE_FILES)), [], skill);
    }
  });

  it("names a step that wrote none of its files, the engine's files aside", () => {
    assert.deepEqual(stepBreaks("03-foundations", {}, after(...ENGINE_FILES)), ["03-foundations wrote none of its files"]);
    assert.deepEqual(stepBreaks("03-foundations", {}, {}), ["03-foundations wrote none of its files"]);
  });

  it("counts a file a step changed or deleted, not one it left as it was", () => {
    assert.deepEqual(stepBreaks("02-brand", { [ui("brand.md")]: "a", [ui("system.md")]: "s" }, { [ui("brand.md")]: "b", [ui("system.md")]: "s" }), []);
    assert.deepEqual(stepBreaks("02-brand", { [ui("brand.md")]: "a", [ui("system.md")]: "s" }, { [ui("brand.md")]: "a" }), ["02-brand wrote aidd_docs/ui/system.md", "02-brand wrote none of its files"]);
  });
});

describe("aidd-ui pilot chain run", () => {
  const SKILL_OF = /^\/aidd-ui:(\S+) /;
  const ownedAnywhere = (rel) => ENGINE_FILES.includes(rel) || Object.values(OWNED).some((entries) => entries.some((entry) => (entry.endsWith("/") ? rel.startsWith(entry) : rel === entry)));
  let full;
  let base;

  beforeEach(() => {
    full = makeTmp("aidd-ui-pilot-full-");
    base = makeTmp("aidd-ui-pilot-base-");
    writeProject(full);
    // every journey step names a wireframe, so a chain that lays the whole project leaves no step without one
    put(full, `${UI}/journeys/onboarding.md`, fs.readFileSync(path.join(full, UI, "journeys/onboarding.md"), "utf8").replaceAll("| home |", "| search-flow |"));
  });

  afterEach(() => {
    removeTmp(full);
    removeTmp(base);
  });

  const copyFromFull = (cwd, file) => {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.copyFileSync(path.join(full, file), path.join(cwd, file));
  };
  const filesOf = (skill) => filesUnder(path.join(full, UI)).map((file) => path.relative(full, file)).filter((file) => {
    const rel = path.relative(UI, file);
    return OWNED[skill].some((entry) => (entry.endsWith("/") ? rel.startsWith(entry) : rel === entry)) || (skill === "03-foundations" && ENGINE_FILES.includes(rel));
  });
  const lay = (skill) => (cwd) => filesOf(skill).forEach((file) => copyFromFull(cwd, file));

  /** A copy holding the project but for what the chain writes, then a model laying each skill's files, or `instead`. */
  function run(instead = {}) {
    const logs = [];
    const [log, error, tmpdir] = [console.log, console.error, process.env.TMPDIR];
    console.log = (line) => logs.push(String(line));
    console.error = (line) => logs.push(String(line));
    process.env.TMPDIR = base;
    try {
      const code = main(["--gouvernail", "/g", "--kairos", "/k", "--only", "kairos"], {
        copyProject: (_, dest) => filesUnder(full).map((file) => path.relative(full, file)).filter((file) => !(file.startsWith(`${UI}/`) && ownedAnywhere(path.relative(UI, file)))).forEach((file) => copyFromFull(dest, file)),
        runStep: (cwd, request) => {
          const skill = request.match(SKILL_OF)[1];
          (instead[skill] ?? lay(skill))(cwd, lay(skill));
          return true;
        },
      });
      return { code, logs };
    } finally {
      console.log = log;
      console.error = error;
      if (tmpdir === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = tmpdir;
    }
  }

  it("exits 0 and says steps ok when each step wrote its own files and the engine's", () => {
    const { code, logs } = run();
    assert.deepEqual([code, logs.at(-1).endsWith("wireframes all code untouched steps ok")], [0, true], logs.join("|"));
  });

  it("exits 1, naming the step and the path, when a step wrote outside its set", () => {
    const { code, logs } = run({ "02-brand": (cwd, laid) => { laid(cwd); copyFromFull(cwd, `${UI}/system.md`); } });
    assert.equal(code, 1);
    assert.ok(logs.some((line) => line.endsWith("steps broken 1")), logs.join("|"));
    assert.ok(logs.includes("02-brand wrote aidd_docs/ui/system.md"), logs.join("|"));
  });

  it("exits 1, naming the step, when a step changed none of its files", () => {
    const { code, logs } = run({ "04-components": (cwd) => copyFromFull(cwd, `${UI}/history.md`) });
    assert.equal(code, 1);
    assert.ok(logs.includes("04-components wrote none of its files"), logs.join("|"));
  });

  it("exits 1 and says no journey when the chain leaves no journey step, nothing else wrong", () => {
    const history = path.join(full, UI, "history.md");
    fs.writeFileSync(history, fs.readFileSync(history, "utf8").split("\n").filter((line) => !line.startsWith("| onboarding |")).join("\n"));
    const { code, logs } = run({ "01-journeys": (cwd) => [".md", ".html"].forEach((extension) => copyFromFull(cwd, `${UI}/wireframes/search-flow${extension}`)) });
    assert.equal(code, 1);
    assert.ok(logs.some((line) => line.includes("wireframes no journey")), logs.join("|"));
  });
});

describe("aidd-ui pilot chain", () => {
  it("sends one request per skill, in the order of the path", () => {
    assert.deepEqual(CHAIN.map(([skill]) => skill), ["01-journeys", "02-brand", "03-foundations", "04-components"]);
    assert.deepEqual(CHAIN.map(([, part]) => part), ["journeys", "brand", "foundations", "components"]);
  });

  it("points each request at the task folder of its own part", () => {
    for (const [skill, part] of CHAIN) assert.ok(requestOf("real", skill, part).endsWith(`Task folder: aidd_docs/tasks/${part}.`), part);
  });

  it("sends each part of a pilot's request once, whole", () => {
    for (const pilot of ["blank", "real"]) {
      const requests = CHAIN.map(([skill, part]) => requestOf(pilot, skill, part));
      for (const [part, words] of Object.entries(REQUESTS[pilot])) assert.equal(requests.filter((request) => request.includes(words)).length, 1, `${pilot} ${part}`);
      requests.forEach((request, at) => assert.ok(request.startsWith(`/aidd-ui:${CHAIN[at][0]} `), request));
    }
  });
});

describe("aidd-ui pilot platforms", () => {
  it("asks for web and mobile in the blank foundations request, not in the brand one", () => {
    assert.equal(REQUESTS.blank.brand.includes("web and mobile"), false);
    assert.ok(REQUESTS.blank.foundations.includes("web and mobile"));
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

  it("runs nothing when --only names no pilot", () => {
    assert.equal(pilotsOf(["--gouvernail", "/g", "--kairos", "/k", "--only", "kairos2"]), null);
  });

  it("refuses a missing checkout", () => {
    assert.equal(pilotsOf(["--gouvernail", "/g"]), null);
    assert.equal(pilotsOf([]), null);
  });
});

describe("aidd-ui pilot run", () => {
  it("returns 2, with the message, when a step throws, and spawns no model", () => {
    const tmpdir = process.env.TMPDIR;
    process.env.TMPDIR = copy;
    const logged = [];
    const error = console.error;
    const log = console.log;
    console.error = (line) => logged.push(line);
    console.log = () => {};
    let modelRuns = 0;
    try {
      const code = main(["--gouvernail", "/g", "--kairos", "/k", "--only", "kairos"], {
        copyProject: () => { throw new Error("git archive failed in the source"); },
        runStep: () => { modelRuns += 1; return true; },
      });
      assert.equal(code, 2);
    } finally {
      console.error = error;
      console.log = log;
      if (tmpdir === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = tmpdir;
    }
    assert.equal(modelRuns, 0);
    assert.ok(logged.some((line) => String(line).includes("git archive failed in the source")), logged.join("|"));
  });
});
