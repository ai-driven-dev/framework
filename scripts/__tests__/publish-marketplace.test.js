const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, join, resolve } = require("node:path");
const { afterEach, beforeEach, test } = require("node:test");
const { cleanEnv } = require("../lib/hook-sandbox.cjs");

const script = resolve(__dirname, "../publish-marketplace.cjs");
const CATALOGS = { claude: ".claude-plugin/marketplace.json", codex: ".agents/plugins/marketplace.json" };

let dir;
let remote;

beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), "aidd-publish-marketplace-test-")));
  remote = join(dir, "remote.git");
  execFileSync("git", ["init", "--quiet", "--bare", remote], { env: cleanEnv() });
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** A release's catalog directory: the tool's catalog and one plugin whose file holds `content`. */
function release(tool, content = "one") {
  const source = join(dir, `source-${tool}-${content}`);
  write(
    join(source, CATALOGS[tool]),
    `${JSON.stringify({ name: "aidd-framework", plugins: [{ name: "aidd-context" }] })}\n`
  );
  write(join(source, "plugins/aidd-context/skill.md"), content);
  return source;
}

function run(...args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: cleanEnv() });
}

const tag = (tool, version, source) => run("tag", tool, version, source, remote);
const advance = (tool, version) => run("advance", tool, version, remote);

/** The tag step, then the branch step, as the release job runs them around the verification. */
function publish(tool, version, source) {
  const tagged = tag(tool, version, source);
  return tagged.status === 0 ? advance(tool, version) : tagged;
}

function git(...args) {
  return execFileSync("git", ["--git-dir", remote, ...args], { encoding: "utf8", env: cleanEnv() }).trim();
}

const ref = (name) => git("for-each-ref", "--format=%(objectname)", name);
const tree = (name) => git("rev-parse", `${name}^{tree}`);

function publishAll(tool, versions) {
  for (const version of versions) {
    const result = publish(tool, version, release(tool, version));
    assert.equal(result.status, 0, result.stderr);
  }
}

test("the first release creates the stable branch and its version tag at one commit", () => {
  const result = publish("codex", "v1.0.0", release("codex"));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(ref("refs/heads/codex"), ref("refs/tags/codex-v1.0.0"));
});

test("tagging a release leaves the stable branch on the previous release", () => {
  publishAll("codex", ["v1.0.0"]);
  const stable = ref("refs/heads/codex");
  const result = tag("codex", "v1.1.0", release("codex", "v1.1.0"));
  assert.equal(result.status, 0, result.stderr);
  assert.ok(ref("refs/tags/codex-v1.1.0"));
  assert.equal(ref("refs/heads/codex"), stable);
});

test("tagging the first release creates no stable branch", () => {
  const result = tag("codex", "v1.0.0", release("codex"));
  assert.equal(result.status, 0, result.stderr);
  assert.ok(ref("refs/tags/codex-v1.0.0"));
  assert.equal(ref("refs/heads/codex"), "");
});

test("a tagged release the stable branch has not reached is advanced by a rerun", () => {
  publishAll("codex", ["v1.0.0"]);
  tag("codex", "v1.1.0", release("codex", "v1.1.0"));
  const result = publish("codex", "v1.1.0", release("codex", "v1.1.0"));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(ref("refs/heads/codex"), ref("refs/tags/codex-v1.1.0"));
});

test("advancing a release that is not tagged is refused", () => {
  const result = advance("codex", "v1.0.0");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /refs\/tags\/codex-v1\.0\.0 is not tagged/);
});

test("a newer release advances the branch on top of the previous one", () => {
  publishAll("codex", ["v1.0.0", "v1.1.0"]);
  assert.equal(ref("refs/heads/codex"), ref("refs/tags/codex-v1.1.0"));
  assert.equal(git("rev-parse", "refs/heads/codex~1"), ref("refs/tags/codex-v1.0.0"));
});

test("versions compare as numbers, not as text", () => {
  publishAll("codex", ["v5.9.0", "v5.14.0"]);
  assert.equal(ref("refs/heads/codex"), ref("refs/tags/codex-v5.14.0"));
  publishAll("codex", ["v5.10.0"]);
  assert.equal(ref("refs/heads/codex"), ref("refs/tags/codex-v5.14.0"));
});

test("an older release is tagged without moving the stable branch", () => {
  publishAll("codex", ["v2.0.0"]);
  const stable = ref("refs/heads/codex");
  const result = publish("codex", "v1.0.0", release("codex", "older"));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /stays on v2\.0\.0/);
  assert.equal(ref("refs/heads/codex"), stable);
  assert.ok(ref("refs/tags/codex-v1.0.0"));
});

test("a release published twice with the same content changes nothing", () => {
  publishAll("codex", ["v1.0.0"]);
  const published = ref("refs/tags/codex-v1.0.0");
  const again = tag("codex", "v1.0.0", release("codex", "v1.0.0"));
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /already tagged/);
  assert.equal(ref("refs/tags/codex-v1.0.0"), published);
});

test("a version tag is never overwritten with different content", () => {
  publishAll("codex", ["v1.0.0"]);
  const published = ref("refs/tags/codex-v1.0.0");
  const result = tag("codex", "v1.0.0", release("codex", "changed"));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /already points to different content/);
  assert.equal(ref("refs/tags/codex-v1.0.0"), published);
});

test("the hosted catalog carries the one distribution name, whatever the tool", () => {
  publishAll("codex", ["v1.0.0"]);
  publishAll("claude", ["v1.0.0"]);
  for (const tool of ["codex", "claude"]) {
    const catalog = JSON.parse(git("show", `refs/tags/${tool}-v1.0.0:${CATALOGS[tool]}`));
    assert.equal(catalog.name, "aidd-marketplace");
  }
});

test("a catalog with no plugin is refused", () => {
  const source = release("codex");
  write(join(source, CATALOGS.codex), `${JSON.stringify({ name: "aidd-framework", plugins: [] })}\n`);
  const result = publish("codex", "v1.0.0", source);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid catalog/);
});

test("a tool that publishes no catalog is refused with the usage", () => {
  const result = tag("kimi", "v1.0.0", release("codex"));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: publish-marketplace/);
});

test("a stable branch whose tip carries no version tag is refused, not overwritten", () => {
  publishAll("codex", ["v1.0.0"]);
  const untagged = git("commit-tree", tree("refs/heads/codex"), "-m", "Untagged");
  git("update-ref", "refs/heads/codex", untagged);
  const result = publish("codex", "v1.1.0", release("codex", "next"));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unexpected history on codex/);
  assert.equal(ref("refs/heads/codex"), untagged);
});
