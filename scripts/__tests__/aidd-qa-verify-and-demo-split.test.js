const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const qa = path.resolve(__dirname, "../../plugins/aidd-qa");
const verify = path.join(qa, "skills/01-acceptance-qa");

test("static contract: the plugin declares acceptance QA and demo", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(qa, ".claude-plugin/plugin.json"), "utf8"));
  assert.deepEqual(manifest.skills, ["./skills/01-acceptance-qa", "./skills/02-demo"]);
});

test("static ownership: acceptance QA contains no media tooling", () => {
  const offenders = fs.readdirSync(verify, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => /\b(?:ffmpeg|ffprobe|libvpx-vp9)\b|\.webm\b/.test(fs.readFileSync(file, "utf8")));
  assert.deepEqual(offenders.map((file) => path.relative(qa, file)), []);
});

test("static report contract: criteria, candidate, observations and gaps remain traceable", () => {
  const template = fs.readFileSync(path.join(verify, "assets/qa-report-template.md"), "utf8");
  const fields = [...template.matchAll(/^- \*\*([^*]+)\*\*:/gm)].map((match) => match[1]);
  for (const field of ["Verdict", "Source", "Candidate"]) assert.ok(fields.includes(field), field);
  const columns = template.match(/^\| Scenario \|.*$/m)[0].split("|").map((cell) => cell.trim());
  for (const column of ["Criteria", "Expected", "Actual", "Verdict"]) assert.ok(columns.includes(column), column);
  const sections = [...template.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
  for (const section of ["Out of interface", "Rejected", "Limitations"]) assert.ok(sections.includes(section), section);
});
