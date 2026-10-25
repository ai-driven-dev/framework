const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const yaml = require("js-yaml");

const ci = yaml.load(fs.readFileSync(path.resolve(__dirname, "../../.github/workflows/ci.yml"), "utf8"));
const job = ci.jobs["build-release-video"];
const script = (job?.steps ?? []).map((step) => step.run ?? "").join("\n");

test("a release renders its video once the release exists", () => {
  assert.deepEqual(job.needs, ["release-please"]);
  assert.equal(job.if, "needs.release-please.outputs.release_created == 'true'");
});

test("the video is rendered for the release's major.minor and attached to its tag", () => {
  assert.match(script, /render-release-video\.cjs --version "\$\{MINOR\}"/);
  assert.match(script, /MINOR="\$\{VERSION%\.\*\}"/);
  assert.match(script, /gh release upload "\$\{TAG\}" release-video\.mp4 release-video\.json --clobber/);
});

test("the YouTube title and description are written for the tag and attached with the video", () => {
  assert.match(script, /youtube-metadata\.js --version "\$\{MINOR\}" --tag "\$\{TAG\}" --repo "\$\{\{ github\.repository \}\}"/);
});

test("the job installs ffmpeg and may write the release asset", () => {
  assert.match(script, /apt-get install -y ffmpeg/);
  assert.equal(job.permissions.contents, "write");
});

const config = require("../../release-please-config.json");
const publish = ci.jobs["publish-release"];
const publishScript = (publish?.steps ?? []).map((step) => step.run ?? "").join("\n");
const pin = ci.jobs["release-please"].steps.find((step) => step.name === "Pin umbrella release as latest");

test("only the umbrella release is a draft, and its tag exists from the start", () => {
  assert.equal(config.packages["."].draft, true);
  assert.equal(config.packages["."]["force-tag-creation"], true);
  for (const [name, options] of Object.entries(config.packages)) {
    if (name !== ".") assert.equal(options.draft, undefined, `${name} must publish at once`);
  }
});

test("a draft cannot be the latest release, so latest is set when it is published", () => {
  assert.equal(pin, undefined);
  assert.match(publishScript, /gh release edit "\$\{TAG\}" --draft=false --latest/);
});

test("the release is published once its bundle and distributions are attached, video or not", () => {
  assert.deepEqual(publish.needs.sort(), [
    "build-and-attach",
    "build-per-tool",
    "build-plugin",
    "build-release-video",
    "release-please",
  ]);
  assert.match(publish.if, /always\(\)/);
  assert.match(publish.if, /needs\.build-and-attach\.result == 'success'/);
  assert.match(publish.if, /needs\.build-per-tool\.result == 'success'/);
  assert.doesNotMatch(publish.if, /build-release-video/);
});

test("publishing uses the App token so the release event reaches the other workflows", () => {
  const uses = publish.steps.map((step) => step.uses ?? "").join("\n");
  assert.match(uses, /create-github-app-token/);
  assert.match(JSON.stringify(publish.steps), /steps\.app-token\.outputs\.token/);
});

const recapJob = ci.jobs["release-recap"];

test("every release leaves a recap, whatever happened to its jobs", () => {
  assert.match(recapJob.if, /always\(\)/);
  assert.match(recapJob.if, /release_created == 'true'/);
  assert.deepEqual(recapJob.needs.sort(), [
    "build-and-attach",
    "build-per-tool",
    "build-plugin",
    "build-release-video",
    "publish-cli",
    "publish-release",
    "release-please",
  ]);
});

test("the recap reads every job's result and posts nowhere, n8n owns the Slack message", () => {
  const step = recapJob.steps.find((s) => (s.run ?? "").includes("scripts/release-recap.js"));

  assert.equal(step.env.NEEDS, "${{ toJSON(needs) }}");
  assert.equal(step.env.SLACK_WEBHOOK_URL, undefined);
});

test("the recap checks out the whole history so it can compare with the previous release", () => {
  const checkout = recapJob.steps.find((s) => (s.uses ?? "").startsWith("actions/checkout"));

  assert.equal(checkout.with?.["fetch-depth"], 0);
});
