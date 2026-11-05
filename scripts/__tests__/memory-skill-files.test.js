const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const PLUGIN = path.resolve(__dirname, "../../plugins/aidd-context");
const SKILL = path.join(PLUGIN, "skills/02-project-memory");
const { lintFile } = require(path.join(PLUGIN, "hooks/memory.cjs"));

const CAPABILITIES = ["core", "ecosystem", "backlog", "deployment", "contract", "auth", "data", "async", "ui", "native"];
const HEADER = ["Capability", "Detected when", "File", "Always", "Former files"];
const DROPPED_TEMPLATES = /templates\/(?:GUIDELINES|CONTRIBUTING)\.md|templates\/memory\/README\.md/u;
const { UNFINISHED } = require("./helpers/unfinished-marker.js");
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

const FIXTURES = path.resolve(__dirname, "../../cli/tests/fixtures/hooks-routes");
const ENGINE_NAMES = /memory\.cjs/u;
const PLUGIN_HOOKS = /^(?:[^/]+\/)*plugins\/aidd-context\/hooks\/memory\.cjs$/u;
const TOOL_HOOKS = /^(?:[^/]+\/)*\.[a-z]+\/hooks\/aidd-context\/memory\.cjs$/u;

function section(text, heading) {
  const start = text.indexOf(`## ${heading}`);
  assert.ok(start >= 0, `no ${heading} section`);
  const rest = text.slice(start + 3);
  const end = rest.search(/\n## /u);
  return end < 0 ? rest : rest.slice(0, end);
}

function engineSection() {
  return section(skillText("SKILL.md"), "Engine");
}

test("check prints its findings: no report template ships and no file names one", () => {
  assert.equal(fs.existsSync(path.join(SKILL, "assets/report.md")), false);
  for (const file of skillMarkdown()) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /report\.md|memory-check/u, path.relative(SKILL, file));
  }
});

test("the engine's file names and its fallback live in the router's Engine section only", () => {
  const engine = engineSection();
  for (const name of ["memory.cjs"]) {
    assert.ok(engine.includes(name), `the Engine section does not name ${name}`);
    assert.ok(fs.existsSync(path.join(PLUGIN, "hooks", name)), `${name} is not under the plugin's hooks/`);
  }
  assert.match(engine, /memory-rules\.md/u, "the fallback does not link the rules");
  assert.match(engine, /Machine/u, "the fallback does not name the Machine table");
  for (const file of skillMarkdown().filter((candidate) => !candidate.endsWith("SKILL.md"))) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(text, ENGINE_NAMES, `${path.relative(SKILL, file)} names an engine script`);
    assert.doesNotMatch(text, /rule table/iu, `${path.relative(SKILL, file)} names the fallback`);
  }
});

test("the lint command the skill gives takes the root first, and exits 1 on a planted unfinished marker", () => {
  const given = engineSection().match(/`node memory\.cjs check (\.) (aidd_docs\/memory\/<file>\.md)`/u);
  assert.ok(given, "the Engine section gives no `node memory.cjs check . aidd_docs/memory/<file>.md`");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lint-command-"));
  try {
    fs.mkdirSync(path.join(root, "aidd_docs/memory"), { recursive: true });
    const template = fs.readFileSync(path.join(SKILL, "assets/templates/memory/core/vcs.md"), "utf8");
    fs.writeFileSync(path.join(root, "aidd_docs/memory/vcs.md"), `# VCS\n\n- ${template.match(/\{\{[^{}\n]*\}\}/u)[0]}\n`);
    const run = (file) =>
      spawnSync("node", [path.join(PLUGIN, "hooks/memory.cjs"), "check", given[1], file.replace("<file>", "vcs")], {
        cwd: root,
        encoding: "utf8",
      });
    const result = run(given[2]);
    assert.equal(result.status, 1, `${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /M3/u);
    // The mistake this guards: the file first reads as the root, finds nothing, and exits 0.
    const swapped = spawnSync("node", [path.join(PLUGIN, "hooks/memory.cjs"), "check", "aidd_docs/memory/vcs.md"], { cwd: root, encoding: "utf8" });
    assert.equal(swapped.status, 1, "the engine no longer passes silently on a file given as the root");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the Engine section matches the install layouts the hook fixtures show", () => {
  const engine = engineSection();
  const delivered = [];
  for (const tool of fs.readdirSync(FIXTURES)) {
    for (const scenario of fs.readdirSync(path.join(FIXTURES, tool))) {
      const lines = fs.readFileSync(path.join(FIXTURES, tool, scenario), "utf8").split(/\r?\n/u);
      for (const line of lines) {
        if (!line.startsWith("## ") || !line.endsWith("memory.cjs")) continue;
        const where = line.slice(3);
        assert.ok(PLUGIN_HOOKS.test(where) || TOOL_HOOKS.test(where), `${tool}/${scenario}: ${where} fits no layout the Engine section states`);
        delivered.push(`${tool}/${scenario}`);
      }
    }
  }
  assert.ok(delivered.length > 20, "the fixtures hold too few engine deliveries to compare");
  for (const none of ["kilo", "opencode"]) {
    const built = fs.readFileSync(path.join(FIXTURES, none, "native-build.txt"), "utf8");
    assert.doesNotMatch(built, /memory\.cjs/u, `${none} native build now ships the engine`);
  }
  assert.match(engine, /hooks\/aidd-context\//u, "no tool-folder layout");
  assert.match(engine, /plugin's `hooks\/`/u, "no plugin layout");
  assert.match(engine, /inside this skill/u, "no skill-own layout");
  assert.match(engine, /Kilo/u);
  assert.match(engine, /OpenCode/u);
  const order = ["plugin's `hooks/`", "hooks/aidd-context/", "inside this skill"].map((needle) => engine.indexOf(needle));
  assert.deepEqual([...order].sort((a, b) => a - b), order, "the lookup order is not plugin, tool folder, skill");
});

test("refresh runs scan, check, write, then sync", () => {
  assert.match(skillText("SKILL.md"), /\(\[refresh\]\)\s*-->\s*scan\s*-->\s*check\s*-->\s*write\s*-->\s*sync/u);
});

test("check reads the bank at its root: a team file is kept and never linted or removed, a misplaced one moves, a former file merges", () => {
  const check = skillText("actions/03-check.md");
  const lines = check.split(/\r?\n/u);
  const line = (pattern) => lines.find((candidate) => pattern.test(candidate));
  assert.match(check, /team/u, "a team's own root file is not named");
  assert.match(check, /Former files/u);
  assert.doesNotMatch(check, /orphan/iu, "a root file no row produces is the team's, not an orphan");
  assert.doesNotMatch(check, /got an answer/u, "check cannot know what write was answered");
  assert.match(line(/remove/u) ?? "", /a row produces/u, "the removal offer is not bound to the files a row produces");
  assert.match(line(/\*\*Format/u) ?? "", /a row produces/u, "Format is not bound to the files a row produces");
  const moves = lines.filter((candidate) => /misplaced|folder/u.test(candidate) && /move/u.test(candidate));
  assert.ok(moves.length >= 2, "the file move and the folder move are not two statements");
  for (const move of moves) assert.ok(!(/to the root/u.test(move) && /under `internal\/`/u.test(move)), `two destinations in one clause: ${move}`);
  for (const heading of ["Structure findings", "Format findings", "Content findings"]) assert.ok(check.includes(heading), `no ${heading} block`);
  assert.match(check, /no table/u);
  assert.match(check, /one finding per line/u);
  assert.match(check, /the engine/u);
});

test("write ends on the engine, writes only the root, and holds back a capability a misplaced or unmerged file covers", () => {
  const write = skillText("actions/02-write.md");
  assert.match(write, /engine/u);
  assert.match(write, /misplaced/u);
  assert.match(write, /Former files/u, "a pending former-file merge does not hold back the capability's file");
  assert.doesNotMatch(write, /each found capability|guidance comment|every selected row exists/u, "a stale instruction is left");
});

test("a merge applies only with the former file's own removal approved, and says so once, in write", () => {
  const merge = skillText("actions/02-write.md")
    .split(/\r?\n/u)
    .filter((candidate) => /merge/iu.test(candidate) && /removal/u.test(candidate));
  assert.equal(merge.length, 1, "write does not state, in one line, what a merge needs before it touches the former file");
  assert.match(merge[0], /former file's removal was approved/u);
  assert.match(merge[0], /neither file/u, "a merge without its removal can still copy, leaving every fact in two files");
  for (const file of skillMarkdown().filter((candidate) => !candidate.endsWith("02-write.md"))) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(text, /merge[^.\n]*removal|removal[^.\n]*merge/iu, `${path.relative(SKILL, file)} restates the merge rule`);
  }
});

test("sync fills the wired tools without asking when refresh calls it, the old tag form counting as wired", () => {
  const sync = skillText("actions/04-sync.md");
  assert.match(sync, /refresh/u);
  assert.match(sync, /<aidd_project_memory>/u);
});

test("the cases cover the merge offer, the misplaced move, and the refresh sync", () => {
  const cases = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../skill-eval/cases.json"), "utf8"));
  const memory = cases.filter((entry) => entry.skill === "02-project-memory");
  const all = JSON.stringify(memory);
  assert.doesNotMatch(all, /aidd_docs\/tasks\/|Match step|Prune step/u, "a case still expects a report file or an old step");
  const find = (pattern, what) => {
    const found = memory.find((entry) => pattern.test(entry.name));
    assert.ok(found, `no case ${what}`);
    return found;
  };
  const merge = find(/merge/u, "offers a former file a merge");
  assert.ok(merge.expect.stdoutContains.includes("api.md") && merge.expect.stdoutContains.includes("contract.md"));
  assert.ok(merge.expect.filesUnchanged.includes("aidd_docs/memory/api.md"));
  const misplaced = find(/misplaced/u, "flags a misplaced file");
  assert.ok(misplaced.expect.filesAbsent.includes("aidd_docs/memory/auth.md"), "a root copy is not ruled out");
  assert.ok(misplaced.expect.filesUnchanged.includes("aidd_docs/memory/principles.md"), "the team file is checked by judge only");
  for (const heading of ["Structure findings", "Format findings", "Content findings"]) assert.ok(misplaced.expect.stdoutContains.includes(heading), heading);
  const refresh = find(/^refresh/u, "refreshes a bank");
  assert.deepEqual(refresh.expect.fileContains["CLAUDE.md"], ["@aidd_docs/memory/deployment.md"]);
  assert.ok(refresh.expect.filesExist.includes("aidd_docs/memory/codebase-map.md"), "the declined merge is not asserted");
});

test("check reviews the files a row produces or names as former, never a team file, offers a merge for a former file, and a misplaced file only its move", () => {
  const lines = skillText("actions/03-check.md").split(/\r?\n/u);
  const line = (pattern) => lines.find((candidate) => pattern.test(candidate)) ?? "";
  assert.match(line(/\*\*Content/u), /a row produces/u, "Content reviews the team's files too");
  const merge = lines.filter((candidate) => /Former files/u.test(candidate) && /merge/u.test(candidate));
  assert.equal(merge.length, 1, "no single step offers the merge for a Former files match");
  assert.match(line(/misplaced/u), /only the move/u, "a misplaced file is offered more than its move");
  assert.match(line(/remove/u), /at the root/u, "a removal is offered for a file that is not at the root");
});

test("a check request has its own route: scan, then check, and no sync", () => {
  const router = skillText("SKILL.md");
  const route = router.split(/\r?\n/u).find((candidate) => /\(\[check\]\)/u.test(candidate)) ?? "";
  assert.match(route, /\(\[check\]\)\s*-->\s*scan\s*-->\s*check/u, "no check route");
  assert.doesNotMatch(route, /sync/u, "the check route syncs");
  assert.doesNotMatch(route, /-->\s*write/u, "the check route writes without approval");
  assert.match(router.split(/\r?\n/u).find((candidate) => /^argument-hint:/u.test(candidate)) ?? "", /check/u, "the argument hint omits check");
});
