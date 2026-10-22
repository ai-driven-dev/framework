const assert = require("node:assert/strict");
const test = require("node:test");

const { recap, changedVersions } = require("../release-recap.js");

const base = {
  tag: "v5.13.0",
  repo: "ai-driven-dev/framework",
  runUrl: "https://github.com/ai-driven-dev/framework/actions/runs/1",
  assets: ["bundle.zip", "release-video.mp4"],
  needs: {
    "build-and-attach": { result: "success" },
    "build-per-tool": { result: "success" },
    "build-plugin": { result: "skipped" },
    "build-release-video": { result: "success" },
    "publish-cli": { result: "skipped" },
    "publish-release": { result: "success" },
  },
};

test("a clean release says it is published and links the release and the run", () => {
  const text = recap({ ...base, published: true });

  assert.match(text, /^Release v5\.13\.0 published/);
  assert.ok(text.includes("https://github.com/ai-driven-dev/framework/releases/tag/v5.13.0"));
  assert.match(text, /actions\/runs\/1/);
  assert.doesNotMatch(text, /failed/);
});

test("every job that ran is listed with what happened to it, and skipped ones are left out", () => {
  const text = recap({ ...base, published: true });

  assert.match(text, /✅ Marketplace bundle/);
  assert.match(text, /✅ Release video/);
  assert.doesNotMatch(text, /Plugin archives/);
  assert.doesNotMatch(text, /CLI on npm/);
});

test("a failed job is named as failed, and a release left as a draft says so", () => {
  const needs = { ...base.needs, "build-per-tool": { result: "failure" }, "publish-release": { result: "skipped" } };
  const text = recap({ ...base, needs, published: false, assets: ["bundle.zip"] });

  assert.match(text, /^Release v5\.13\.0 NOT published/);
  assert.match(text, /❌ Distributions: failed/);
  assert.match(text, /draft/);
});

test("a failed video is reported even though the release went out", () => {
  const needs = { ...base.needs, "build-release-video": { result: "failure" } };
  const text = recap({ ...base, needs, published: true, assets: ["bundle.zip"] });

  assert.match(text, /^Release v5\.13\.0 published/);
  assert.match(text, /❌ Release video: failed/);
  assert.match(text, /No release video attached/);
});

test("the versions that shipped are one line, the root named framework and the CLI named CLI", () => {
  const text = recap({ ...base, published: true, versions: ["framework 5.13.0", "CLI 5.6.0", "aidd-dev 2.8.0"] });

  assert.match(text, /^Versions: framework 5\.13\.0 · CLI 5\.6\.0 · aidd-dev 2\.8\.0$/m);
});

test("no versions leaves no versions line", () => {
  assert.doesNotMatch(recap({ ...base, published: true, versions: [] }), /Versions/);
});

test("only what changed since the previous release is listed", () => {
  const previous = { ".": "5.12.0", cli: "5.5.0", "plugins/aidd-dev": "2.7.0", "plugins/aidd-pm": "2.6.0" };
  const current = { ".": "5.13.0", cli: "5.6.0", "plugins/aidd-dev": "2.8.0", "plugins/aidd-pm": "2.6.0" };

  assert.deepEqual(changedVersions(current, previous), ["framework 5.13.0", "CLI 5.6.0", "aidd-dev 2.8.0"]);
});

test("without a previous release every version is listed", () => {
  assert.deepEqual(changedVersions({ ".": "5.13.0", "plugins/aidd-dev": "2.8.0" }, {}), ["framework 5.13.0", "aidd-dev 2.8.0"]);
});
