const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { UI, HISTORY, LIB, makeTmp, removeTmp, filesUnder, engine, validate, writeProject, addHistory, edit, editTokens, record } = require("../fixtures/aidd-ui/project.js");
const { load } = require(path.join(LIB, "project.cjs"));
const { byId, reviewStatesOf } = require(path.join(LIB, "model.cjs"));
const { isReviewed } = require(path.join(LIB, "history.cjs"));
const { list } = require(path.join(LIB, "markdown.cjs"));

// The publish command is driven as a subprocess, as the skill calls it, after bump has raised
// the versions, and judged by the engine's own validator.
const RECOLOUR = "aidd_docs/tasks/recolour";
const RETHEME = "aidd_docs/tasks/retheme";
const RELABEL = "aidd_docs/tasks/relabel";
const USAGE = "usage: node aidd-ui.cjs publish ([--breaking] | <id>…) [--root <dir>]\n";

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
const JOURNEY = `${UI}/journeys/onboarding.md`;
const GATE = `${UI}/reviews/gate.md`;
/** Writes a review holding an ok verdict for each state of each id at its current version, and its history row. */
const reviewed = (dir, ...ids) => {
  const index = byId(load(dir));
  const rows = ids.flatMap((id) => {
    const states = reviewStatesOf(index.get(id));
    const { version } = index.get(id).frontMatter;
    return (states.length ? states : [""]).map((state) => `| ${id} | ${state} | ${version} | ok | |`);
  });
  const verdicts = ["## Verdicts", "", "| Screen | State | Version | Verdict | Comment |", "| --- | --- | --- | --- | --- |", ...rows].join("\n");
  const first = !fs.existsSync(path.join(dir, GATE));
  fs.writeFileSync(path.join(dir, GATE), record(["id: gate", "kind: review", "status: proposed", "version: 1", "scope: system", `screens: [${ids.join(", ")}]`], "# Gate", verdicts));
  if (first) addHistory(dir, ["gate", "1", "created", "no", "aidd_docs/tasks/ds-init"]);
};
const HOME_STATES = ["default", "empty", "loading", "error"];
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Writes the capture of each state of a screen at `version`, beside its record. */
const captured = (dir, id, states, version = "1") =>
  states.forEach((state) => fs.writeFileSync(path.join(dir, `${UI}/screens/${id}.${state}@${version}.png`), PNG));
const unsealed = () => fs.writeFileSync(path.join(tmp, HISTORY), read(HISTORY).replace(/ \| [0-9a-f]{12} \|$/gm, " |  |"));
const snapshot = () => filesUnder(tmp).map((file) => [file, fs.readFileSync(file, "utf8")]);

describe("aidd-ui publish", () => {
  it("writes the next minor version of the system, listing the task nothing published yet, and leaves the design system valid", () => {
    bump(RECOLOUR);
    const { code, report, err } = publish();
    assert.deepEqual([code, err, report], [0, "", { version: "2.1.0", tasks: [RECOLOUR] }]);
    assert.equal(systemRows().at(-1), `| system | 2.1.0 | published | no | ${RECOLOUR} | |`);
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });

  it("lists every unpublished task, sorted and comma separated", () => {
    bump(RETHEME);
    bump(RECOLOUR);
    assert.deepEqual(publish().report, { version: "2.1.0", tasks: [RECOLOUR, RETHEME] });
    assert.equal(systemRows().at(-1), `| system | 2.1.0 | published | no | ${RECOLOUR}, ${RETHEME} | |`);
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });

  it("leaves out every task a publication already lists, however many it lists", () => {
    bump(RETHEME);
    bump(RECOLOUR);
    publish();
    bump(RELABEL);
    assert.deepEqual(publish().report, { version: "2.2.0", tasks: [RELABEL] });
  });

  it("lists a task whose system content row is no publication, so an element row beside it stays unpublished", () => {
    bump(RECOLOUR);
    edit(tmp, `${UI}/system.md`, "version: 1", "version: 2");
    addHistory(tmp, ["system", "2", "tokens recoloured", "no", RECOLOUR]);
    assert.deepEqual(publish().report, { version: "2.1.0", tasks: [RECOLOUR] });
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });

  it("is a new major version, breaking, when a task it lists broke an element", () => {
    bump(RETHEME);
    bump(RECOLOUR, "--breaking");
    assert.deepEqual(publish().report, { version: "3.0.0", tasks: [RECOLOUR, RETHEME] });
    assert.equal(systemRows().at(-1), `| system | 3.0.0 | published | yes | ${RECOLOUR}, ${RETHEME} | |`);
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });

  it("is a new major version, breaking, with --breaking for a change no element row shows breaking", () => {
    bump(RECOLOUR);
    assert.deepEqual(publish("--breaking").report, { version: "3.0.0", tasks: [RECOLOUR] });
    assert.equal(systemRows().at(-1), `| system | 3.0.0 | published | yes | ${RECOLOUR} | |`);
    assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
  });

  describe("an element", () => {
    const BUTTON = `${UI}/components/button.md`;
    const rowOf = (id, version) => read(HISTORY).split("\n").find((line) => line.startsWith(`| ${id} | ${version} |`));

    it("validates it: status validated, its fingerprint in the row of its version, and the design system valid", () => {
      bump(RECOLOUR);
      assert.equal(validate(tmp).code, 0);
      reviewed(tmp, "button");
      const { code, report, err } = publish("button");
      assert.deepEqual([code, err], [0, ""]);
      assert.deepEqual(report.validated.map(({ id, version }) => [id, version]), [["button", "2"]]);
      assert.match(report.validated[0].fingerprint, /^[0-9a-f]{12}$/);
      assert.ok(read(BUTTON).includes("\nstatus: validated\n"));
      assert.equal(rowOf("button", 2), `| button | 2 | new action colour | no | ${RECOLOUR} | ${report.validated[0].fingerprint} |`);
      assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
    });

    it("validates the brand and the system, reviewed ok in their one state", () => {
      unsealed();
      reviewed(tmp, "brand", "system");
      const { code, report, err } = publish("brand", "system");
      assert.deepEqual([code, err], [0, ""]);
      assert.deepEqual(report.validated.map(({ id, version }) => [id, version]), [["brand", "1"], ["system", "1"]]);
      assert.ok(read(`${UI}/brand.md`).includes("\nstatus: validated\n"));
      assert.equal(rowOf("system", 1), `| system | 1 | created | no | aidd_docs/tasks/ds-init | ${report.validated[1].fingerprint} |`);
      assert.equal(validate(tmp).out.some((line) => /(brand|system)\.md/.test(line)), false); // the elements left unsealed are the others'
      edit(tmp, `${UI}/brand.md`, "## Project\n\nA search tool.", "## Project\n\nA search tool, for analysts.");
      assert.ok(validate(tmp).out.some((line) => line.includes("brand.md H8")));
    });

    it("validates an asset with no state given one ok verdict", () => {
      unsealed();
      reviewed(tmp, "icon-search");
      assert.deepEqual(publish("icon-search").report.validated.map(({ id }) => id), ["icon-search"]);
    });

    it("validates a wireframe reviewed ok, writing its fingerprint", () => {
      reviewed(tmp, "search-flow");
      const { code, report } = publish("search-flow");
      assert.equal(code, 0);
      assert.match(report.validated[0].fingerprint, /^[0-9a-f]{12}$/);
      assert.ok(read(`${UI}/wireframes/search-flow.md`).includes("\nstatus: validated\n"));
      assert.equal(rowOf("search-flow", 1), `| search-flow | 1 | created | no | aidd_docs/tasks/ds-init | ${report.validated[0].fingerprint} |`);
    });

    describe("a journey", () => {
      const proposedJourney = () => edit(tmp, JOURNEY, "status: validated", "status: proposed");

      it("is validated with no review, its fingerprint in the row of its version", () => {
        proposedJourney();
        const { code, report, err } = publish("onboarding");
        assert.deepEqual([code, err], [0, ""]);
        assert.deepEqual(report.validated.map(({ id, version }) => [id, version]), [["onboarding", "1"]]);
        assert.match(report.validated[0].fingerprint, /^[0-9a-f]{12}$/);
        assert.ok(read(JOURNEY).includes("\nstatus: validated\n"));
        assert.equal(rowOf("onboarding", 1), `| onboarding | 1 | created | no | aidd_docs/tasks/ds-init | ${report.validated[0].fingerprint} |`);
        assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
      });

      it("is judged by no review: it holds no state, and the engine does not count it a reviewed record", () => {
        const journey = byId(load(tmp)).get("onboarding");
        assert.deepEqual([isReviewed(journey), reviewStatesOf(journey)], [false, []]);
      });
    });

    describe("a refusal", () => {
      const refused = (ids, message) => {
        const before = snapshot();
        const done = publish(...ids);
        assert.deepEqual([done.code, done.report, done.err], [2, null, `aidd-ui: ${message}\n`]);
        assert.deepEqual(snapshot(), before);
      };

      it("names an id that is no element, writing nothing", () => {
        unsealed();
        reviewed(tmp, "button");
        refused(["button", "first-pass"], 'no element named "first-pass"');
        refused(["ghost"], 'no element named "ghost"');
      });

      it("names a journey whose version already holds a fingerprint, as it does any record", () => {
        edit(tmp, JOURNEY, "status: validated", "status: proposed");
        assert.equal(publish("onboarding").code, 0);
        refused(["onboarding"], '"onboarding" version 1 is already validated, raise its version with bump to change it');
      });

      it("names an element no review holds, writing nothing", () => {
        unsealed();
        refused(["button"], '"button" has no ok verdict for state default at version 1, review it first');
      });

      it("names the first state whose verdict is pending or revise", () => {
        unsealed();
        reviewed(tmp, "button");
        edit(tmp, GATE, "| button | hover | 1 | ok |", "| button | hover | 1 | pending |");
        refused(["button"], '"button" has no ok verdict for state hover at version 1, review it first');
        edit(tmp, GATE, "| button | hover | 1 | pending |", "| button | hover | 1 | ok |");
        edit(tmp, GATE, "| button | focus | 1 | ok |", "| button | focus | 1 | revise | needs more contrast |");
        refused(["button"], '"button" has a revise verdict for state focus at version 1, change it first');
      });

      it("names a state holding an ok and a revise at its version, in either order", () => {
        unsealed();
        reviewed(tmp, "button");
        edit(tmp, GATE, "| button | hover | 1 | ok | |", "| button | hover | 1 | ok | |\n| button | hover | 1 | revise | needs more contrast |");
        refused(["button"], '"button" has a revise verdict for state hover at version 1, change it first');
        edit(tmp, GATE, "| button | hover | 1 | ok | |\n| button | hover | 1 | revise | needs more contrast |", "| button | hover | 1 | revise | needs more contrast |\n| button | hover | 1 | ok | |");
        refused(["button"], '"button" has a revise verdict for state hover at version 1, change it first');
      });

      it("names a state with no verdict row while another state is ok", () => {
        unsealed();
        reviewed(tmp, "button");
        for (const state of ["hover", "focus", "disabled"]) edit(tmp, GATE, `| button | ${state} | 1 | ok | |\n`, "");
        refused(["button"], '"button" has no ok verdict for state hover at version 1, review it first');
      });

      it("names an element whose ok verdict judged an earlier version", () => {
        reviewed(tmp, "button");
        bump(RECOLOUR);
        refused(["button"], '"button" has no ok verdict for state default at version 2, review it first');
      });

      it("names an asset with no state and no verdict row", () => {
        unsealed();
        refused(["icon-search"], '"icon-search" has no ok verdict at version 1, review it first');
      });

      it("names a deprecated element, writing nothing", () => {
        refused(["old-button"], '"old-button" is deprecated, nothing to validate');
      });

      it("names an element whose version already holds a fingerprint, so an edit is never sealed without a raise", () => {
        edit(tmp, BUTTON, "## Usage", "## Usage\n\nEdited after validation.");
        refused(["button"], '"button" version 1 is already validated, raise its version with bump to change it');
      });

      it("names an element without a row at its version, writing nothing", () => {
        edit(tmp, BUTTON, "version: 1", "version: 2");
        refused(["button"], '"button" has no history row at its version 2');
      });
    });
  });

  describe("a screen", () => {
    const HOME = `${UI}/screens/home.md`;
    const CODE_LINE = "code: src/ui/HomePage.tsx#HomePage@1";
    beforeEach(() => {
      fs.writeFileSync(path.join(tmp, HISTORY), read(HISTORY).replace(/^(\| home \| 1 \|.*) [0-9a-f]{12} \|$/m, "$1  |"));
      // the fixture's own review holds a revise on home: a revise blocks the publication, so these cases start without it
      edit(tmp, `${UI}/reviews/first-pass.md`, "| home | loading | 1 | revise | spinner too small |", "| home | loading | 1 | pending | |");
    });

    const refused = (message) => {
      const before = snapshot();
      const done = publish("home");
      assert.deepEqual([done.code, done.report, done.err], [2, null, `aidd-ui: ${message}\n`]);
      assert.deepEqual(snapshot(), before);
    };

    it("is published with no capture when no code is linked to it", () => {
      edit(tmp, HOME, `${CODE_LINE}\n`, "");
      reviewed(tmp, "home");
      const { code, report } = publish("home");
      assert.equal(code, 0);
      assert.match(report.validated[0].fingerprint, /^[0-9a-f]{12}$/);
      assert.ok(read(HOME).includes("\nstatus: validated\n"));
    });

    it("is published with each state's capture when its code is at its version, and the capture stays out of its fingerprint", () => {
      reviewed(tmp, "home");
      captured(tmp, "home", HOME_STATES);
      const { code, report } = publish("home");
      assert.equal(code, 0);
      assert.match(report.validated[0].fingerprint, /^[0-9a-f]{12}$/);
      fs.writeFileSync(path.join(tmp, `${UI}/screens/home.default@1.png`), Buffer.concat([PNG, Buffer.from("again")]));
      assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
    });

    it("is refused when its code is at its version and a state has no capture, naming the path to write", () => {
      reviewed(tmp, "home");
      refused("home: default has no capture at screens/home.default@1.png");
      captured(tmp, "home", ["default", "empty"]);
      refused("home: loading has no capture at screens/home.loading@1.png");
    });

    it("is refused when only the capture of an earlier version exists", () => {
      reviewed(tmp, "home");
      captured(tmp, "home", HOME_STATES, "0");
      refused("home: default has no capture at screens/home.default@1.png");
    });

    it("is published with no capture when its code is at an earlier version", () => {
      edit(tmp, HOME, CODE_LINE, "code: src/ui/HomePage.tsx#HomePage@0");
      reviewed(tmp, "home");
      assert.equal(publish("home").code, 0);
    });

    it("is refused when a state holds a revise verdict, capture or not", () => {
      reviewed(tmp, "home");
      captured(tmp, "home", HOME_STATES);
      edit(tmp, GATE, "| home | loading | 1 | ok | |", "| home | loading | 1 | revise | spinner too small |");
      refused('"home" has a revise verdict for state loading at version 1, change it first');
    });

  });

  describe("a capture", () => {
    it("is no record: a png beside a record is left unread, and validate says nothing of it", () => {
      const before = load(tmp).records.length;
      captured(tmp, "home", HOME_STATES);
      assert.equal(load(tmp).records.length, before);
      assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
    });
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
      edit(tmp, HISTORY, "| system | 1.0.0 | first system | no | aidd_docs/tasks/ds-init | |\n", "");
      edit(tmp, HISTORY, "| system | 2.0.0 | old-button retired | yes | aidd_docs/tasks/retire-old-button | |\n", "");
      refused(`aidd-ui: ${HISTORY} has no system row, write the first with bump --created system\n`);
    });

    it("names a project without a design system", () => {
      fs.rmSync(path.join(tmp, UI), { recursive: true });
      refused("aidd-ui: no aidd_docs/ui folder at this root. Run from the project root, after writing a record.\n");
    });

    it("prints the usage and exits 2 given --breaking with an id, or --root without a value", () => {
      bump(RECOLOUR);
      const before = snapshot();
      for (const args of [["--breaking", "button"], ["--root"]]) {
        const done = engine("publish", ...args);
        assert.deepEqual([done.status, done.stdout, done.stderr], [2, "", USAGE]);
      }
      assert.deepEqual(snapshot(), before);
    });
  });

  describe("a wireframe validated", () => {
    const WIREFRAME = `${UI}/wireframes/search-flow.md`;
    const publishedWireframe = () => {
      reviewed(tmp, "search-flow");
      assert.equal(publish("search-flow").code, 0);
    };

    it("is held to its fingerprint: edited since, H8 names it", () => {
      publishedWireframe();
      assert.deepEqual(validate(tmp), { code: 0, out: ["VALID"], err: "" });
      edit(tmp, WIREFRAME, "# Search flow", "# Search flow\n\nEdited after validation.");
      const { code, out } = validate(tmp);
      assert.equal(code, 1);
      assert.ok(out.some((line) => line.includes("search-flow.md H8 => raise its version with bump")), out.join("\n"));
    });

    it("is held to a fingerprint: validated without one, H8 names it", () => {
      edit(tmp, WIREFRAME, "status: proposed", "status: validated");
      const { code, out } = validate(tmp);
      assert.equal(code, 1);
      assert.ok(out.some((line) => line.includes("search-flow.md H8 => run publish search-flow")), out.join("\n"));
    });

    it("deprecated with a last row that is not breaking: H6 names it", () => {
      edit(tmp, WIREFRAME, "status: proposed", "status: deprecated");
      assert.ok(validate(tmp).out.some((line) => line.includes("search-flow.md H6 =>")));
    });

    it("stays valid when a token of a component it expects changes, as bump never raises it for one", () => {
      publishedWireframe();
      editTokens(tmp, (tree) => (tree.font.weight.bold.$value = 600));
      const { code, out } = validate(tmp);
      assert.equal(code, 1);
      assert.ok(out.some((line) => line.includes("search-field.md H8 =>")), out.join("\n"));
      assert.ok(!out.some((line) => line.includes("search-flow")), out.join("\n"));
    });
  });
});
