const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const PLUGIN = path.resolve(__dirname, "../../plugins/aidd-context");
const SKILL = path.join(PLUGIN, "skills/02-project-memory");
const { lintFile } = require(path.join(PLUGIN, "hooks/memory-lint.cjs"));

const CAPABILITIES = ["core", "ecosystem", "backlog", "deployment", "contract", "auth", "data", "async", "ui", "native"];
const HEADER = ["Capability", "Detected when", "File", "Always", "Former files"];
const DROPPED_TEMPLATES = /templates\/(?:GUIDELINES|CONTRIBUTING)\.md|templates\/memory\/README\.md/u;
const { UNFINISHED } = require("./fixtures/unfinished-marker.js");
const MERGED_REFERENCES = /capability-signals|memory-destinations|structure\.md/u;

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

function skillMarkdown() {
  return filesUnder(SKILL).filter((file) => file.endsWith(".md"));
}

function tableOf(file) {
  const rows = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("|") && !/^\|[\s|:-]+\|$/u.test(line))
    .map((line) => line.replace(/^\||\|$/gu, "").split("|").map((cell) => cell.trim()));
  return { header: rows[0], rows: rows.slice(1) };
}

test("the README template is finished and passes the memory engine under another name", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "readme-probe-"));
  try {
    const bank = path.join(root, "aidd_docs/memory");
    fs.mkdirSync(bank, { recursive: true });
    fs.copyFileSync(path.join(SKILL, "assets/templates/README.md"), path.join(bank, "readme-probe.md"));
    const errors = lintFile(root, "aidd_docs/memory/readme-probe.md").filter((problem) => problem.severity === "error");
    assert.deepEqual(errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  const text = fs.readFileSync(path.join(SKILL, "assets/templates/README.md"), "utf8");
  assert.doesNotMatch(text, UNFINISHED, "a placeholder or a guidance comment is left");
  for (const link of ["GUIDES.md", "CONCEPTS.md", "#get-started"]) assert.ok(text.includes(link), `no link to ${link}`);
});

test("an autolink is not an unfinished marker, a placeholder is", () => {
  assert.doesNotMatch("See <https://example.com/guide> for more.", UNFINISHED);
  assert.match("<your team rule here>", UNFINISHED);
  assert.match("{{a question}}", UNFINISHED);
  assert.match("<!-- guidance -->", UNFINISHED);
});

test("the team templates are not shipped", () => {
  for (const name of ["GUIDELINES.md", "CONTRIBUTING.md", "memory/README.md"]) {
    assert.equal(fs.existsSync(path.join(SKILL, "assets/templates", name)), false, name);
  }
});

test("no file of the skill names a dropped template or a merged reference", () => {
  for (const file of skillMarkdown()) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(text, DROPPED_TEMPLATES, `${path.relative(SKILL, file)} names a dropped template`);
    assert.doesNotMatch(text, MERGED_REFERENCES, `${path.relative(SKILL, file)} names a merged reference`);
  }
});

test("capabilities.md holds one row per capability, and every memory template belongs to a row", () => {
  const { header, rows } = tableOf(path.join(SKILL, "references/capabilities.md"));
  assert.deepEqual(header, HEADER);
  assert.deepEqual(rows.map(([capability]) => capability.replace(/`/gu, "")), CAPABILITIES);
  const named = rows.map((cells) => cells[HEADER.indexOf("File")]).join(" ");
  const templates = filesUnder(path.join(SKILL, "assets/templates/memory")).map((file) => path.basename(file));
  for (const template of templates) assert.ok(named.includes(template), `${template} belongs to no capability row`);
});

function skillText(file) {
  return fs.readFileSync(path.join(SKILL, file), "utf8");
}

test("check prints its findings: no report template ships and no file names one", () => {
  assert.equal(fs.existsSync(path.join(SKILL, "assets/report.md")), false);
  for (const file of skillMarkdown()) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /report\.md|memory-check/u, path.relative(SKILL, file));
  }
});

test("the router says where the engine sits in each install, and the plugin ships it there", () => {
  const router = skillText("SKILL.md");
  for (const engine of ["memory-lint.cjs", "update_memory.js"]) {
    assert.ok(router.includes(engine), `SKILL.md does not locate ${engine}`);
    assert.ok(fs.existsSync(path.join(PLUGIN, "hooks", engine)), `${engine} is not under the plugin's hooks/`);
  }
  assert.match(router, /hooks\/aidd-context\//u, "no flat install location");
  assert.match(router, /plugin install/u, "no plugin install location");
});

test("refresh runs scan, check, write, then sync", () => {
  assert.match(skillText("SKILL.md"), /\(\[refresh\]\)\s*-->\s*scan\s*-->\s*check\s*-->\s*write\s*-->\s*sync/u);
});

test("check reads the bank at its root: a team file is kept, a misplaced one is offered a move, a former file a merge", () => {
  const check = skillText("actions/03-check.md");
  assert.match(check, /team/u, "a team's own root file is not named");
  assert.match(check, /internal\//u, "a file under internal/ is not named");
  assert.match(check, /misplaced/u);
  assert.match(check, /Former files/u);
  assert.doesNotMatch(check, /orphan/iu, "a root file no row produces is the team's, not an orphan");
  for (const heading of ["Structure", "Format", "Content"]) assert.ok(check.includes(heading), `no ${heading} block`);
  assert.ok(check.includes("memory-lint.cjs"), "check does not run the engine");
});

test("write ends on the engine, writes only the root, and never copies a misplaced file's capability", () => {
  const write = skillText("actions/02-write.md");
  assert.ok(write.includes("memory-lint.cjs"), "write does not run the engine");
  assert.match(write, /misplaced/u);
  assert.doesNotMatch(write, /each found capability|guidance comment/u, "a stale instruction is left");
  assert.doesNotMatch(write, /every selected row exists/u, "a conditional file with no answer is not an absence");
});

test("sync fills the wired tools without asking when refresh calls it", () => {
  assert.match(skillText("actions/04-sync.md"), /refresh/u);
});

test("the cases cover the merge offer, the misplaced move, and the refresh sync", () => {
  const cases = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../skill-eval/cases.json"), "utf8"));
  const memory = cases.filter((entry) => entry.skill === "02-project-memory");
  const all = JSON.stringify(memory);
  assert.doesNotMatch(all, /aidd_docs\/tasks\/|Match step|Prune step/u, "a case still expects a report file or an old step");
  const merge = memory.find((entry) => /merge/u.test(entry.name));
  assert.ok(merge, "no case offers a former file a merge");
  assert.ok(merge.expect.stdoutContains.includes("api.md") && merge.expect.stdoutContains.includes("contract.md"));
  assert.ok(merge.expect.filesUnchanged.includes("aidd_docs/memory/api.md"));
  const misplaced = memory.find((entry) => /misplaced/u.test(entry.name));
  assert.ok(misplaced, "no case flags a misplaced file");
  assert.ok(misplaced.expect.filesAbsent.includes("aidd_docs/memory/auth.md"), "a root copy is not ruled out");
  const refresh = memory.find((entry) => /^refresh/u.test(entry.name));
  assert.ok(refresh.expect.fileContains["CLAUDE.md"].some((line) => line.includes("deployment.md")), "refresh does not sync the wired tool");
  assert.ok(refresh.expect.filesExist.includes("aidd_docs/memory/codebase-map.md"), "the declined merge is not asserted");
});
