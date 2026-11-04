const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, HISTORY, makeTmp, removeTmp, filesUnder, engine, validate, writeProject, edit } = require("../fixtures/aidd-ui/project.js");

// The publish command is driven as a subprocess, as the skill calls it, after bump has raised
// the versions, and judged by the engine's own validator.
const RECOLOUR = "aidd_docs/tasks/recolour";
const RETHEME = "aidd_docs/tasks/retheme";
const RELABEL = "aidd_docs/tasks/relabel";
const USAGE = "usage: node aidd-ui.cjs publish [--breaking] [--root <dir>]\n";

let tmp;

beforeEach(() => {
  tmp = makeTmp("aidd-ui-publish-");
  writeProject(tmp);
});

afterEach(() => removeTmp(tmp));

const bump = (task, ...extra) => assert.equal(engine("bump", "--root", tmp, "--task", task, "--change", "new action colour", ...extra, "color.action.default").status, 0);
const publish = (...args) => {
  const done = engine("publish", "--root", tmp, ...args);
  return { code: done.status, report: done.stdout ? JSON.parse(done.stdout) : null, err: done.stderr };
};
const read = (name) => fs.readFileSync(path.join(tmp, name), "utf8");
const systemRows = () => read(HISTORY).split("\n").filter((line) => line.startsWith("| system |"));
const snapshot = () => filesUnder(tmp).map((file) => [file, fs.readFileSync(file, "utf8")]);

describe("aidd-ui publish", () => {
  it("writes the next minor version of the system, listing the task nothing published yet, and leaves the design system valid", () => {
    bump(RECOLOUR);
    const { code, report, err } = publish();
    assert.deepEqual([code, err, report], [0, "", { version: "2.1.0", tasks: [RECOLOUR] }]);
    assert.equal(systemRows().at(-1), `| system | 2.1.0 | published | no | ${RECOLOUR} |`);
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });

  it("lists every unpublished task, sorted and comma separated", () => {
    bump(RETHEME);
    bump(RECOLOUR);
    assert.deepEqual(publish().report, { version: "2.1.0", tasks: [RECOLOUR, RETHEME] });
    assert.equal(systemRows().at(-1), `| system | 2.1.0 | published | no | ${RECOLOUR}, ${RETHEME} |`);
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });

  it("leaves out every task a publication already lists, however many it lists", () => {
    bump(RETHEME);
    bump(RECOLOUR);
    publish();
    bump(RELABEL);
    assert.deepEqual(publish().report, { version: "2.2.0", tasks: [RELABEL] });
  });

  it("is a new major version, breaking, when a task it lists broke an element", () => {
    bump(RETHEME);
    bump(RECOLOUR, "--breaking");
    assert.deepEqual(publish().report, { version: "3.0.0", tasks: [RECOLOUR, RETHEME] });
    assert.equal(systemRows().at(-1), `| system | 3.0.0 | published | yes | ${RECOLOUR}, ${RETHEME} |`);
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });

  it("is a new major version, breaking, with --breaking for a change no element row shows breaking", () => {
    bump(RECOLOUR);
    assert.deepEqual(publish("--breaking").report, { version: "3.0.0", tasks: [RECOLOUR] });
    assert.equal(systemRows().at(-1), `| system | 3.0.0 | published | yes | ${RECOLOUR} |`);
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });

  describe("a refusal", () => {
    const refused = (message) => {
      const before = snapshot();
      const done = publish();
      assert.deepEqual([done.code, done.report, done.err], [2, null, message]);
      assert.deepEqual(snapshot(), before);
    };

    it("names that no task is unpublished, writing nothing", () => {
      refused("aidd-ui: no unpublished task, nothing to publish\n");
      bump(RECOLOUR);
      publish();
      refused("aidd-ui: no unpublished task, nothing to publish\n");
    });

    it("names a history.md with no system row, writing nothing", () => {
      bump(RECOLOUR);
      edit(tmp, HISTORY, "| system | 1.0.0 | first system | no | aidd_docs/tasks/ds-init |\n", "");
      edit(tmp, HISTORY, "| system | 2.0.0 | old-button retired | yes | aidd_docs/tasks/retire-old-button |\n", "");
      refused(`aidd-ui: ${HISTORY} has no system row, write the first with bump --created system\n`);
    });

    it("names a project without a design system", () => {
      fs.rmSync(path.join(tmp, UI), { recursive: true });
      refused("aidd-ui: no design system under aidd_docs/ui\n");
    });

    it("prints the usage and exits 2 given anything else than --breaking and --root", () => {
      bump(RECOLOUR);
      const before = snapshot();
      for (const args of [["button"], ["--root"]]) {
        const done = engine("publish", ...args);
        assert.deepEqual([done.status, done.stdout, done.stderr], [2, "", USAGE]);
      }
      assert.deepEqual(snapshot(), before);
    });
  });
});
