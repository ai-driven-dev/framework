const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const yaml = require("js-yaml");

const promote = yaml.load(
  fs.readFileSync(path.resolve(__dirname, "../../.github/workflows/promote.yml"), "utf8"),
);
const open = promote.jobs.promote.steps.find(
  (step) => step.name === "Open the promote PR, enable merge auto-merge",
);

test("promote offers a way to skip the release video check", () => {
  const input = promote.on.workflow_dispatch.inputs.skip_video;

  assert.equal(input.type, "boolean");
  assert.equal(input.default, false);
  assert.equal(open.env.SKIP_VIDEO, "${{ inputs.skip_video }}");
});

test("promote checks the release video on next's tip, before it pushes anything", () => {
  const check = open.run.indexOf("node .claude/skills/release-video/assets/check-release-video.js");
  const push = open.run.indexOf("git push origin");

  assert.ok(check > -1, "the check never runs");
  assert.ok(check < push, "the check runs after the snapshot is pushed");
  assert.match(open.run, /git checkout --detach origin\/next/);
});

test("the skip is the only way past the check", () => {
  assert.match(open.run, /if \[ "\$\{SKIP_VIDEO\}" != "true" \]; then\n\s+git checkout --detach origin\/next\n\s+node \.claude\/skills\/release-video\/assets\/check-release-video\.js\nfi/);
});
