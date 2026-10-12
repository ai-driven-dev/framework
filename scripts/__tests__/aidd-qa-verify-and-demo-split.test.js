const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const qa = path.resolve(__dirname, "../../plugins/aidd-qa");
const verify = path.join(qa, "skills/01-acceptance-qa");
const demo = path.join(qa, "skills/02-demo");

const filesOf = (dir) =>
  fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));

const textOf = (dir) => filesOf(dir).map((file) => fs.readFileSync(file, "utf8")).join("\n");

test("verify carries no media", () => {
  const offenders = filesOf(verify).filter((file) =>
    /ffmpeg|ffprobe|webm|video/i.test(fs.readFileSync(file, "utf8")),
  );
  assert.deepEqual(offenders.map((file) => path.relative(qa, file)), []);
});

test("demo owns the duration cap, the VP9 encode and frame validation", () => {
  const text = textOf(demo);
  assert.match(text, /12 seconds/);
  assert.match(text, /libvpx-vp9/);
  assert.match(text, /fps=4/);
});

test("the plugin lists verify and demo", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(qa, ".claude-plugin/plugin.json"), "utf8"));
  assert.deepEqual(manifest.skills, ["./skills/01-acceptance-qa", "./skills/02-demo"]);
});

const read = (...parts) => fs.readFileSync(path.join(...parts), "utf8");
const record = () => read(demo, "actions/01-record.md");

test("demo yields a video for a browser journey and a transcript for a CLI one", () => {
  assert.match(record(), /browser journey[^\n]*WebM/i);
  assert.match(record(), /CLI journey[^\n]*transcript[^\n]*exit status/i);
});

test("demo lands beside the journey's source, never in a temporary directory", () => {
  assert.match(record(), /beside the journey's source/);
  assert.match(record(), /never a temporary directory/);
});

test("demo names an artifact after its journey, never happy-path for a bug", () => {
  assert.match(record(), /journey slug/);
  assert.match(record(), /never `happy-path`/);
});

test("demo shows a failing journey as observed, never staged", () => {
  assert.match(record(), /fail[^\n]*as observed[^\n]*not expected/i);
  assert.match(record(), /never stage or fake/i);
});

test("demo asks nothing when invoked by another skill, and offers review only to a direct user", () => {
  assert.match(read(demo, "SKILL.md"), /Invoked by another skill or agent, never ask: return `blocked` with the question/);
  assert.match(record(), /only when the user invoked it directly/i);
});

test("demo needs ffmpeg and ffprobe only for a browser video", () => {
  assert.match(record(), /`ffmpeg` and `ffprobe` only for a browser video/);
});

for (const [name, dir] of [["verify", verify], ["demo", demo]]) {
  test(`${name} router table follows the action table form`, () => {
    const [header, , ...rows] = read(dir, "SKILL.md").match(/^\|.*\|$/gm);
    assert.equal(header, "| Action | Does |");
    assert.ok(rows.length > 0);
    for (const row of rows) {
      const [, action, does] = row.split("|").map((cell) => cell.trim());
      assert.match(action, /^[a-z][a-z-]*$/);
      assert.match(does, /^[a-z][^.]*[^.]$/);
    }
  });
}
