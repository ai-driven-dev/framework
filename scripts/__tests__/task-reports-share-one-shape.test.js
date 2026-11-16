const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");

/**
 * The reports a task folder collects, one per skill, read alike: a titled file, one appended
 * section per pass, and its facts as `- Key: value` lines.
 */

const SKILLS = path.resolve(__dirname, "../../plugins/aidd-dev/skills");
const TEMPLATES = {
  run: "02-implement/assets/run-template.md",
  assert: "03-assert/assets/assert-template.md",
  review: "05-review/assets/review-template.md",
};
const read = (file) => fs.readFileSync(path.join(SKILLS, file), "utf8");

describe("the task reports share one shape", () => {
  for (const [kind, file] of Object.entries(TEMPLATES)) {
    it(`${kind} is titled after the work it reports on`, () => {
      assert.match(read(file).split("\n")[0], new RegExp(`^# ${kind[0].toUpperCase()}${kind.slice(1)}: \\{\\{.+\\}\\}$`));
    });

    it(`${kind} appends one numbered section per pass`, () => {
      assert.match(read(file), /^## (Run|Round) \{\{.+\}\}/m);
    });
  }

  it("a pass names the commit it judged, as a field", () => {
    for (const file of [TEMPLATES.run, TEMPLATES.assert]) assert.match(read(file), /^- Head: `\{\{.+\}\}`/m, file);
  });

  it("assert says the commit judged and its verdict, nothing more", () => {
    const fields = [...read(TEMPLATES.assert).matchAll(/^- (\w+):/gm)].map((match) => match[1]);
    assert.deepEqual(fields, ["Head", "Verdict"]);
  });

  it("the assert action fills its round from the template", () => {
    assert.match(read("03-assert/actions/01-assert.md"), /\[assert template\]\(\.\.\/assets\/assert-template\.md\)/);
  });
});
