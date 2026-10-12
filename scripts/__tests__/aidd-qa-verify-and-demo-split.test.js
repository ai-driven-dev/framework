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
