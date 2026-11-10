const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const PLUGIN = path.resolve(__dirname, "../../plugins/aidd-context");
const SKILL = path.join(PLUGIN, "skills/02-project-memory");
const { lintFile } = require(path.join(PLUGIN, "hooks/memory.cjs"));
const { RULES } = require(path.join(PLUGIN, "hooks/lib/memory-rules.cjs"));

const CAPABILITIES = [
  ...Array(6).fill("core"),
  ...["ecosystem", "backlog", "deployment", "api", "cli", "package", "auth", "database", "data", "messaging", "realtime", "ui", "mobile", "desktop"],
];
const HEADER = ["Capability", "File", "Meaning", "Detected when", "Always", "Accepted names"];
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

/** The first table of a file: the rows of its first run of `|` lines. */
function tableOf(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/u);
  const first = lines.findIndex((line) => line.startsWith("|"));
  const run = lines.slice(first);
  const rows = run
    .slice(0, run.findIndex((line) => !line.startsWith("|")) < 0 ? run.length : run.findIndex((line) => !line.startsWith("|")))
    .filter((line) => !/^\|[\s|:-]+\|$/u.test(line))
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

test("capabilities.md holds one row per file, and every memory template belongs to a row", () => {
  const { header, rows } = tableOf(path.join(SKILL, "references/capabilities.md"));
  assert.deepEqual(header, HEADER);
  assert.deepEqual(rows.map(([capability]) => capability.replace(/`/gu, "")), CAPABILITIES);
  for (const cells of rows) assert.ok(cells[HEADER.indexOf("Meaning")] !== "" && cells[HEADER.indexOf("Detected when")] !== "", `${cells[0]} lacks its meaning or detection`);
  const named = rows.map((cells) => cells[HEADER.indexOf("File")]).join(" ");
  const templates = filesUnder(path.join(SKILL, "assets/templates/memory")).map((file) => path.basename(file));
  for (const template of templates) assert.ok(named.includes(template), `${template} belongs to no capability row`);
});

/** A message asset as it is sent: the template without its help comments. */
function messageOf(file) {
  return skillText(file).replace(/<!--[\s\S]*?-->\n*/gu, "");
}

function skillText(file) {
  return fs.readFileSync(path.join(SKILL, file), "utf8");
}

const FIXTURES = path.resolve(__dirname, "../../cli/tests/fixtures/hooks-routes");
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
  return skillText("references/engine.md");
}

function actionsText() {
  return ["01-scan", "02-write", "03-check", "04-sync"].map((name) => skillText(`actions/${name}.md`)).join("\n");
}

test("check prints its findings through the report message: no assets/report.md ships and no file names one", () => {
  assert.equal(fs.existsSync(path.join(SKILL, "assets/report.md")), false);
  for (const file of skillMarkdown()) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /report\.md|memory-check/u, path.relative(SKILL, file));
  }
});

test("the engine reference locates the engine once, with no fallback for a build that ships no engine, and no action keeps a hand-lint table", () => {
  const engine = engineSection();
  for (const name of ["memory.cjs"]) {
    assert.ok(engine.includes(name), `the Engine section does not name ${name}`);
    assert.ok(fs.existsSync(path.join(PLUGIN, "hooks", name)), `${name} is not under the plugin's hooks/`);
  }
  // Every build ships the engine, so a model is never sent to lint by hand.
  assert.doesNotMatch(engine, /Found none|Machine/u, "the Engine section keeps a fallback for a build with no engine");
  for (const file of skillMarkdown().filter((candidate) => !candidate.endsWith("SKILL.md"))) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(text, /rule table/iu, `${path.relative(SKILL, file)} names the fallback`);
  }
});

test("the lint command the skill gives takes the root first, and exits 1 on a planted unfinished marker", () => {
  const given = engineSection().match(/`node memory\.cjs check (\.) (aidd_docs\/memory\/<file>\.md)`/u);
  assert.ok(given, "the engine reference gives no `node memory.cjs check . aidd_docs/memory/<file>.md`");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lint-command-"));
  try {
    fs.mkdirSync(path.join(root, "aidd_docs/memory"), { recursive: true });
    const template = fs.readFileSync(path.join(SKILL, "assets/templates/memory/vcs.md"), "utf8");
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
  // Kilo and OpenCode have no native build: every route of theirs that installs the plugin ships
  // the engine and its libraries in the tool's folder.
  for (const tool of ["kilo", "opencode"]) {
    assert.match(fs.readFileSync(path.join(FIXTURES, tool, "native-build.txt"), "utf8"), /^route not supported by this tool$/mu, `${tool} now has a native build`);
    for (const route of ["flat-translate", "plugin-install", "plugin-install-twice", "setup-plugins-reinstall"]) {
      const shipped = fs.readFileSync(path.join(FIXTURES, tool, `${route}.txt`), "utf8");
      for (const file of ["memory.cjs", "lib/common-rules.cjs", "lib/memory-rules.cjs", "lib/host.cjs"]) {
        assert.match(shipped, new RegExp(`^## \\S+/\\.${tool}/hooks/aidd-context/${file.replace(".", "\\.")}$`, "mu"), `${tool}/${route} does not ship ${file}`);
      }
    }
  }
  assert.match(engine, /hooks\/aidd-context\//u, "no tool-folder layout");
  assert.match(engine, /plugin's `hooks\/`/u, "no plugin layout");
  assert.match(engine, /inside this skill/u, "no skill-own layout");
  const order = ["plugin's `hooks/`", "hooks/aidd-context/", "inside this skill"].map((needle) => engine.indexOf(needle));
  assert.deepEqual([...order].sort((a, b) => a - b), order, "the lookup order is not plugin, tool folder, skill");
});

function routerEdges() {
  return section(skillText("SKILL.md"), "Actions")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.includes("-->"));
}

test("refresh runs scan, check, write, then sync", () => {
  const edges = routerEdges();
  assert.ok(edges.some((edge) => /^request\b.*\|\s*scan\b/u.test(edge) && /refresh/u.test(edge)), "refresh does not start at scan");
  assert.match(edges.find((edge) => /^scan\b.*\|\s*check\b/u.test(edge)) ?? "", /refresh/u, "refresh does not go from scan to check");
  assert.ok(edges.some((edge) => /^check\b\s*-->(?:\|[^|]*\|)?\s*write\b/u.test(edge)), "refresh does not go from check to write");
  assert.ok(edges.some((edge) => /^write\b.*-->\s*sync$/u.test(edge)), "write does not go to sync");
});

test("check reads the bank at its root: a team file is kept and never linted or removed, a misplaced one is reported and never moved, an accepted older name is kept", () => {
  const protocol = skillText("references/review-protocol.md");
  const check = skillText("actions/03-check.md") + protocol;
  assert.match(check, /team/u, "a team's own root file is not named");
  assert.match(check, /Accepted names/u);
  assert.doesNotMatch(check, /orphan/iu, "a root file no row produces is the team's, not an orphan");
  assert.doesNotMatch(check, /got an answer/u, "check cannot know what write was answered");
  assert.match(section(protocol, "Format"), /a row produces/u, "Format is not bound to the files a row produces");
  assert.match(section(protocol, "Structure"), /report it/u, "a misplaced file is not only reported");
  assert.doesNotMatch(check, /offer[^\n]*\bmove\b|\bmove\b[^\n]*offer/iu, "check offers a move");
  assert.match(section(protocol, "Format"), /whole-bank check/u, "Format does not run the engine");
});

test("write ends on the engine, writes only the root, and holds back a capability a misplaced file or an accepted name covers", () => {
  const write = skillText("actions/02-write.md");
  assert.match(write, /engine/u);
  const writing = section(skillText("references/capabilities.md"), "Writing");
  assert.match(write, /capabilities\.md#writing/u, "write does not point to the writing rules");
  assert.match(writing, /misplaced/u);
  assert.match(writing, /Accepted names/u, "an accepted name does not hold back the capability's file");
  assert.match(writing, /create no second/u, "an accepted name still gets a second file");
  assert.doesNotMatch(write, /each found capability|guidance comment|every selected row exists/u, "a stale instruction is left");
});

test("write ends on the engine's guard, which lists what the sheet did not approve, and keeps no copy of the bank", () => {
  const steps = skillText("actions/02-write.md").match(/^\d+\. .*$/gmu);
  assert.doesNotMatch(skillText("actions/02-write.md") + skillText("SKILL.md"), /scratch|copy it/u, "a bank copy or a scratch folder is left");
  assert.match(steps[6], /fix each error on the lines you wrote, check each warning against the code and keep a true line/u, "the lint step does not say what to do with a warning");
  assert.match(skillText("actions/01-scan.md"), /reading-sources\.md#filling-the-sheet/u, "scan does not point to the collecting rules");
  assert.match(steps.at(-2), /`vanished`/u, "no step runs the guard before the sync");
  assert.match(steps.at(-2), /change nothing/u);
  assert.match(steps.at(-1), /Go on to \[sync\]/u);
  assert.match(steps.at(-1), /reply with the \[report message\]\(\.\.\/assets\/report-message\.md\), with what `vanished` listed/u, "the last step does not reply through the report message");
  assert.match(skillText("references/engine.md"), /memory\.cjs vanished \. --sheet/u);
  assert.match(skillText("references/engine.md"), /HEAD only/u, "the guard hides that uncommitted edits are not seen");
  assert.doesNotMatch(actionsText(), /memory\.cjs lines/u);
});

test("no file of the skill offers a merge or names a former file", () => {
  for (const file of skillMarkdown().filter((candidate) => !path.relative(SKILL, candidate).startsWith("assets"))) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /\bmerg(?:e|es|ed|ing)\b|Former files?/iu, `${path.relative(SKILL, file)} speaks of a merge`);
  }
});

test("a refresh shows the wired tools ticked, the old tag form counting as wired, and silence keeps the wiring", () => {
  assert.match(skillText("references/tools.md"), /^\| On a refresh \| wired: a context file holding a block, the old `<aidd_project_memory>` tag included; shown ticked with the sheet, the detected others not; run `sync --add` with each tool the answer adds, then always a bare `sync`, which refreshes every block and copilot's pointer; silence keeps the wiring \|$/mu, "a refresh does not show the wired tools or cannot add one");
});

test("the cases cover the kept older name, the misplaced move, the team cli.md, the CLI setup and the refresh sync", () => {
  const cases = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../skill-eval/cases.json"), "utf8"));
  const memory = cases.filter((entry) => entry.skill === "02-project-memory");
  const all = JSON.stringify(memory);
  assert.doesNotMatch(all, /aidd_docs\/tasks\/|Match step|Prune step/u, "a case still expects a report file or an old step");
  const find = (pattern, what) => {
    const found = memory.find((entry) => pattern.test(entry.name));
    assert.ok(found, `no case ${what}`);
    return found;
  };
  const kept = find(/offers no merge/u, "keeps an older name and offers no merge");
  assert.ok(kept.expect.stdoutNotContains.includes("contract.md") && kept.expect.stdoutNotContains.includes("merge"));
  assert.ok(kept.expect.filesUnchanged.includes("aidd_docs/memory/api.md"));
  const team = find(/team's cli\.md/u, "refreshes a bank holding a team's cli.md");
  // The team's line survives; a true fact the refresh adds next to it is allowed.
  assert.ok(team.expect.fileContains["aidd_docs/memory/cli.md"].some((line) => line.startsWith("- `shopctl`")));
  assert.ok(team.expect.filesAbsent.some((file) => /contract\.md/u.test(file)));
  const cli = find(/CLI project/u, "sets up a CLI project");
  assert.ok(cli.expect.fileContains["aidd_docs/memory/cli.md"].includes("# CLI"));
  const misplaced = find(/misplaced/u, "flags a misplaced file");
  assert.ok(misplaced.expect.filesAbsent.includes("aidd_docs/memory/auth.md"), "a root copy is not ruled out");
  assert.ok(misplaced.expect.filesUnchanged.includes("aidd_docs/memory/principles.md"), "the team file is checked by judge only");
  assert.match(misplaced.prompt, /decline every change/u, "a request that changes nothing does not decline the plan");
  assert.ok(misplaced.expect.stdoutContains.includes("internal/auth.md"), "the misplaced file is not shown");
  assert.doesNotMatch(all, /Structure findings|Format findings|Content findings|\brewire\b/u, "a case still expects a check report or a rewire mode");
  const oldTag = find(/old tag/u, "fills a block wired under the old tag");
  assert.match(oldTag.prompt, /refresh/u);
  assert.ok(oldTag.expect.fileContains["CLAUDE.md"].includes("<!-- aidd_project_memory:start -->"));
  const refresh = find(/^refresh/u, "refreshes a bank");
  assert.deepEqual(refresh.expect.fileContains["CLAUDE.md"], ["@aidd_docs/memory/deployment.md"]);
  assert.ok(refresh.expect.filesExist.includes("aidd_docs/memory/codebase-map.md"), "the codebase map is not asserted");
});

test("check reviews the files a row produces or accepts under another name, never a team file, and a misplaced file only a report", () => {
  const protocol = skillText("references/review-protocol.md");
  const lines = protocol.split(/\r?\n/u);
  assert.match(section(protocol, "Scope"), /a row produces/u, "Scope reviews the team's files too");
  const accepted = lines.filter((candidate) => /Accepted names/u.test(candidate) && /offer nothing/u.test(candidate));
  assert.equal(accepted.length, 1, "no single line keeps a file matching Accepted names without an offer");
  assert.match(lines.find((candidate) => /misplaced/u.test(candidate)) ?? "", /move nothing/u, "a misplaced file is moved");
});

test("one entry: no check or rewire mode in the argument hint, the router, the description or any skill text", () => {
  const router = skillText("SKILL.md");
  assert.equal(router.match(/^argument-hint: (.*)$/mu)[1], "setup | refresh", "the argument hint names another case");
  const labels = routerEdges().flatMap((edge) => [...edge.matchAll(/\|"([^"]*)"\|/gu)].map((match) => match[1])).join("\n");
  assert.doesNotMatch(labels, /\bcheck\b|\brewire\b|no mode/u, "a router edge names a check or rewire mode");
  for (const file of skillMarkdown().filter((candidate) => !path.relative(SKILL, candidate).startsWith(`assets${path.sep}templates`))) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /check request|\b[Rr]ewire\b|tool question|`Needs attention`/u, `${path.relative(SKILL, file)} keeps a check or rewire mode`);
  }
});

const TABLE_FIRST_FILES = () => skillMarkdown().filter((file) => !path.relative(SKILL, file).startsWith("assets"));

/** The prose paragraphs of a markdown text that hold several sentences, as `line: start`. */
function proseWithSeveralSentences(text) {
  const found = [];
  let fence = false;
  let front = false;
  let current = [];
  const flush = () => {
    const prose = current.map(({ line }) => line).join(" ").replace(/`[^`]*`/gu, "X").replace(/\[[^\]]*\]\([^)]*\)/gu, "L");
    if ((prose.match(/[.!?](?:\s|$)/gu) ?? []).length > 1) found.push(`${current[0].number}: ${current[0].line.slice(0, 60)}`);
    current = [];
  };
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (index === 0 && line === "---") front = true;
    else if (front && line === "---") {
      front = false;
      continue;
    }
    if (front) continue;
    if (line.startsWith("```")) {
      flush();
      fence = !fence;
      continue;
    }
    if (fence) continue;
    if (line.trim() === "" || /^(?:\||#|>|[-*+]\s|\d+[.)]\s|\s)/u.test(line)) {
      flush();
      continue;
    }
    current.push({ number: index + 1, line });
  }
  flush();
  return found;
}

test("the table-first guard sees a prose paragraph of several sentences and a sentence over the engine's limit", () => {
  assert.equal(proseWithSeveralSentences("One sentence here.\nIt goes on.\n").length, 1);
  assert.equal(proseWithSeveralSentences("One sentence only.\n\n- A list. With two.\n| a. | b. |\n").length, 0);
  const m1 = RULES.find((rule) => rule.id === "M1");
  assert.equal(m1.check({ file: "x.md", text: `${"word ".repeat(30)}end.\n` }).length, 1);
});

test("the skill's own markdown is table-first: no sentence the engine's M1 flags, no prose paragraph of several sentences", () => {
  const m1 = RULES.find((rule) => rule.id === "M1");
  for (const file of TABLE_FIRST_FILES()) {
    const name = path.relative(SKILL, file);
    const text = fs.readFileSync(file, "utf8");
    assert.deepEqual(m1.check({ file: name, text }).map(({ line, message }) => `${name}:${line} ${message}`), []);
    assert.deepEqual(proseWithSeveralSentences(text).map((where) => `${name}:${where}`), [], `${name} holds a prose paragraph of several sentences: make it a table or a list`);
  }
});

test("a recall case seeds a repo and expects the facts the restored slots must produce", () => {
  const cases = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../skill-eval/cases.json"), "utf8"));
  const recall = cases.find((entry) => entry.skill === "02-project-memory" && /recall/u.test(entry.name));
  assert.ok(recall, "no recall case for 02-project-memory");
  const files = Object.keys(recall.setup.files);
  assert.ok(files.some((name) => name.endsWith(".int.test.ts")), "the seeded repo has no test suffix convention");
  assert.ok(files.includes(".env.example"), "the seeded repo declares no environment variables");
  assert.ok(!files.some((name) => /CONTRIBUTING/u.test(name)), "the seeded repo carries a contributing file");
  const expected = recall.expect.fileContains;
  for (const [file, facts] of Object.entries({
    "aidd_docs/memory/testing.md": [".int.test.ts"],
    "aidd_docs/memory/architecture.md": [".env.example"],
    "aidd_docs/memory/ui.md": ["src/router.tsx"],
    "aidd_docs/memory/project-brief.md": ["export-invoices"],
  })) {
    for (const fact of facts) assert.ok(expected[file]?.includes(fact), `the recall case does not expect ${fact} in ${file}`);
    for (const fact of facts) assert.ok(JSON.stringify(recall.setup.files).includes(fact), `${fact} is not in the seeded repo`);
  }
  // The narrowest-run slot accepts one test file or a changed-only run: expect the slot answered, not one answer.
  assert.ok(expected["aidd_docs/memory/testing.md"]?.includes("Narrowest run: `"), "the recall case does not expect the narrowest run answered");
});

// the fact sheet: every fact with its source, one view, one rule of consent

test("the sheet asset fixes the grammar the engine parses, the four blocks and the cap of eight questions", () => {
  const asset = skillText("assets/fact-sheet.md");
  assert.ok(asset.includes("- <id> | <file> > <section> | <fact> | <source> | <answer>"), "no grammar line");
  assert.ok(asset.startsWith("<!--") && asset.includes("{{") && !asset.includes("```"), "the sheet is not the template itself");
  for (const block of ["## Read", "## Inferred", "## Unknown", "## To rule"]) assert.ok(asset.includes(block), block);
  assert.match(asset, /eight/u);
  assert.match(asset, /Capabilities: C1/u, "no capability line");
  assert.match(asset, /no backticks, line number or glob/u);
  assert.match(asset, /^- \{\{the `Since` line `changes` printed\}\}$/mu, "a refresh's header does not carry the base as changes prints it");
  assert.doesNotMatch(asset, /create/u, "a scope word other than setup, refresh, check");
  assert.equal(fs.existsSync(path.join(SKILL, "assets/scan-summary.md")), false, "the sheet is the one view: no second summary");
});

test("scan collects the sheet into the task folder and write shows it once, after check", () => {
  const scan = skillText("actions/01-scan.md");
  const sheet = skillText("assets/fact-sheet.md");
  assert.match(scan, /fact-sheet\.md/u);
  assert.match(sheet, /aidd_docs\/tasks\/\{\{yyyy_mm\}\}\/\{\{yyyy_mm_dd\}\}_memory-\{\{scope\}\}\/facts\.md/u);
  assert.doesNotMatch(scan, /Show/u, "scan shows the sheet before check has added its lines");
  const steps = skillText("actions/02-write.md").match(/^\d+\. .*$/gmu);
  assert.match(steps[0], /Show the \[sheet message\]\(\.\.\/assets\/sheet-message\.md\)/u, "write does not show the sheet through the sheet message");
  assert.match(steps[1], /Wait for the answer, then write it into the sheet's answer fields[^\n]*, before any memory file\./u, "the answers do not reach the sheet before the bank");
  assert.match(skillText("actions/03-check.md"), /ask(?:ing)? nothing/u, "check asks on a refresh");
});

// A model that cannot find the markers opens the engine's source to learn them: the engine adds the
// block itself, and the skill sends no one into its code.
test("sync adds a missing block itself on a pick, so the skill only creates an absent file and never opens the engine", () => {
  const engine = engineSection();
  assert.match(engine, /^- Run the engine; never open its source or `lib\/`\.$/mu);
  assert.match(engine, /`node memory\.cjs sync \[--add\] <tool>\.\.\.` \| [^|]+ \| tool names only, no root; [^\n]*`--add` appends the block to a picked tool's file holding none/u);
  const sync = skillText("actions/04-sync.md");
  assert.match(sync, /^3\. Create each picked tool's absent context file, per \[tools\]/mu);
  assert.match(sync, /^5\. Offer in the report to reconcile a picked tool's context file whose AIDD structure differs, per \[tools\]/mu, "a differing file stops before the picked tool is wired");
  assert.match(sync, /on a setup, run it with `--add` and the picked tools, per \[tools\]/mu);
  assert.doesNotMatch(sync, /carries the block, per/u, "the skill still makes the model write the block");
  assert.match(skillText("references/tools.md"), /^\| Its AIDD structure differs \| a picked tool still gets its block with `--add`; offer to reconcile the rest in the report, applying only what the user approves \|$/mu, "a picked tool waits on a reconcile");
  assert.match(skillText("../10-learn/references/sync-arguments.md"), /^\| Argument \| Refreshes \|$/mu, "10-learn's bare sync no longer only refreshes");
});

test("check on a refresh adds its findings to the sheet as unanswered D lines", () => {
  const check = skillText("actions/03-check.md");
  assert.match(skillText("assets/fact-sheet.md"), /start with `remove` or `replace`/u);
  assert.match(check, /D lines added to the sheet/u);
  assert.match(check, /every finding/u);
  assert.match(skillText("assets/fact-sheet.md"), /`move <path> to <path>`/u, "a misplaced file is not a D line");
  assert.doesNotMatch(check, /or created/u);
});

test("write ends at once on an empty sheet, drops a capability answered no, keeps every absent always file and skips an unapproved removal", () => {
  const write = skillText("actions/02-write.md");
  assert.match(write, /no fact line, no absent always file and no added tool[^\n]*bank current/u);
  assert.match(write, /fix the sheet until it passes/u);
  const writing = section(skillText("references/capabilities.md"), "Writing");
  assert.match(writing, /`move <path> to <path>` line answered yes \| move the file/u);
  assert.match(writing, /plus every absent always file, minus a capability answered no/u);
  assert.match(writing, /A `remove` or `replace` line whose answer is not yes \| skip it/u);
});

test("the consent rule, applied where write takes the answers: silence is yes, a removal or replacement needs a yes, an unanswered question drops its slot", () => {
  const step = section(skillText("references/capabilities.md"), "Answers");
  assert.match(skillText("actions/02-write.md").match(/^2\. .*$/mu)[0], /capabilities\.md#answers/u, "write does not point to the answers");
  assert.match(step, /silence on an addition \| yes/u);
  assert.match(step, /an answer unclear for a line \| leaves a `remove` or `replace` on it unapplied/u, "an unclear answer could apply a removal");
  assert.doesNotMatch(step, /explicit/u, "an explicit yes is not a rule a small model can apply");
  assert.match(step, /autonomous \| only when the caller's instruction answers/u, "autonomous is not defined");
  assert.match(step, /an unanswered `Q` \| drops its slot/u);
  assert.doesNotMatch(skillText("actions/02-write.md"), /[Ss]ilence/u, "the consent rule is stated twice");
  assert.doesNotMatch(section(skillText("SKILL.md"), "Transversal rules"), /[Ss]ilence/u, "the consent rule is stated twice");
  assert.doesNotMatch(step, /file by file and line by line/u, "the old approval rule contradicts the new one");
  assert.doesNotMatch(skillText("assets/fact-sheet.md"), /silence|## Answers/u, "the sheet template holds the answers");
});

test("write takes its content from the sheet only, after the engine checked its sources", () => {
  const write = skillText("actions/02-write.md");
  assert.match(write, /sheet only/u);
  assert.match(write, /`facts`/u, "the sheet is not verified before the write");
  assert.ok(write.indexOf("`facts`") < write.indexOf("Write each file"), "the write precedes the verification");
  assert.ok(skillText("references/engine.md").includes("memory.cjs facts"), "the engine gives no facts command");
});

test("the sheet message shows once, airy and in one fixed order: files with what they hold, changes old to new, questions, tools, one reply line, the sheet path last", () => {
  const asset = skillText("assets/sheet-message.md");
  const sample = messageOf("assets/sheet-message.md");
  assert.ok(asset.startsWith("<!--") && asset.includes("{{") && !asset.includes("```"), "the message is not the template itself");
  const at = (pattern) => sample.search(pattern);
  const order = [/^Memory plan$/mu, /^Since \{\{short sha\}\} \(\{\{subject\}\}\), \{\{relative date\}\}: \{\{n\}\} commits, \{\{m\}\} files changed$/mu, /^Will write$/mu, /^Will change$/mu, /^Questions$/mu, /^Tools to wire$/mu, /^Does this look right\? Say ok, or what to change/mu, /^Sheet: aidd_docs\/tasks\//mu].map(at);
  assert.ok(order.every((index) => index >= 0), `a part of the message is missing: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, "the parts are out of order");
  assert.match(sample, /^ {2}\S+\.md {2,}\S.+$/mu, "a file is listed without what it holds");
  assert.match(sample, /^ {2}D\{\{n\}\} {2}\S+\.md$/mu, "a change carries no id and file");
  assert.match(sample, /^ {6}→ /mu, "a change shows no old to new");
  assert.match(sample, /^ {2}Q\{\{n\}\} {2}\S/mu);
  assert.match(sample, /^ {2}\[x\] \w+/mu, "no detected tool is ticked");
  assert.match(sample, /^Does this look right\? Say ok, or what to change, for example "not D\{\{n\}\}" or "Q\{\{n\}\}: …"\.$/mu, "the reply is not the one question");
  assert.doesNotMatch(sample, /·/u, "an answer syntax line is left");
  assert.match(asset, /in the person's language/u);
  assert.match(asset, /Will write: a new file/u);
  assert.match(asset, /Will change: an edit to existing lines/u, "the help and the sample name the change section differently");
  assert.doesNotMatch(asset, /Will update/u);
  assert.match(asset, /plain chat text, not in a code fence/u);
  assert.equal(sample.match(/aidd_docs\//gu).length, 1, "a path other than the sheet's is shown");
  assert.doesNotMatch(sample, /silence|\bgrammar\b|\bremove\b|\breplace\b/iu, "engine words reach the person");
  assert.match(asset, /leave out a section with nothing in it/u);
  assert.match(asset, /<!-- Tools: never left out, on a setup or a refresh\. Ticked: on a setup the detected tools, on a refresh the wired ones; the others unticked\. -->/u, "the tools are a setup's only, or a refresh leaves them out");
  assert.match(asset, /<!-- Since: a refresh only, the first line `changes` printed, copied as it is; information, never a question\. -->/u, "the Since line has no help comment");
  assert.match(asset, /Stop after the message: no offer to reverse a declined line/u);
  assert.match(skillText("actions/02-write.md").match(/^1\. .*$/mu)[0], /sheet-message\.md/u, "write does not show the sheet as the asset says");
  assert.match(skillText("actions/02-write.md").match(/^2\. .*$/mu)[0], /^2\. Wait for the answer/u, "write does not wait on the sheet");
  assert.doesNotMatch(skillText("actions/02-write.md"), /end the turn/u, "the wait is a router node, not prose");
  assert.doesNotMatch(skillText("assets/fact-sheet.md"), /## Presentation/u, "the sheet file still holds the message");
});

test("the report message is airy and keeps what was written, changed, left out and warned", () => {
  const report = skillText("assets/report-message.md");
  const sample = messageOf("assets/report-message.md");
  assert.ok(report.startsWith("<!--") && report.includes("{{") && !report.includes("```"), "the message is not the template itself");
  const order = [/^Written$/mu, /^Changed$/mu, /^Left out$/mu, /^Heads-up$/mu].map((pattern) => sample.search(pattern));
  assert.ok(order.every((index) => index >= 0), `a part of the message is missing: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, "the parts are out of order");
  assert.match(report, /plain chat text, not in a code fence/u);
  assert.match(report, /Stop after the message/u);
  assert.match(report, /Never name the engine's commands, their exit codes or the warning count/u);
  assert.match(report, /At most one line per changed file/u);
  assert.match(report, /At most one line per left-out item/u);
  assert.match(report, /At most one heads-up/u);
  assert.match(sample, /^ {2}Q\{\{n\}\} .*unanswered\. .*any time/mu, "an unanswered question shows no way to add it later");
});

test("the tools are asked once, with the sheet: a setup takes the picks, a refresh adds them to the wired ones; nothing asks the tools alone", () => {
  const tools = skillText("references/tools.md");
  const sync = skillText("actions/04-sync.md");
  const answers = section(skillText("references/capabilities.md"), "Answers");
  assert.match(answers, /`tools: /u, "the answer cannot name the tools");
  assert.match(tools, /Setup[^\n]*`tools:`[^\n]*detected[^\n]*never asked again/u, "setup does not take the sheet's picks");
  assert.match(tools, /On a refresh[^\n]*shown ticked with the sheet/u, "a refresh hides the tools");
  assert.match(skillText("actions/02-write.md").match(/^1\. .*$/mu)[0], /with the \[tools\]/u, "write shows only the detected tools");
  assert.doesNotMatch(tools, /^\| Rewire/mu, "a rewire still asks the tools alone");
  assert.match(sync, /picks/u);
  assert.doesNotMatch(sync, /wait for the picks/u, "sync stops a second time");
});

test("the description opens with the verbs a request uses and names the bare check, with no mode to pick", () => {
  const description = skillText("SKILL.md").match(/^description: (.*)$/mu)[1];
  for (const verb of ["Set up", "refresh", "update"]) assert.match(description, new RegExp(verb, "u"), `the description omits ${verb}`);
  assert.ok(description.includes('even a bare "check the project memory"'), "a bare check request does not match the description");
  assert.match(description, /no bank[^.]*sets? (?:one )?up[^.]*a bank[^.]*refresh/u, "the description does not say the bank decides");
  assert.doesNotMatch(description, /\brewire\b/u);
});

test("the router waits on the user after the sheet, and speaks only to ask or reply", () => {
  const edges = routerEdges();
  assert.ok(edges.some((edge) => /^write\b.*\|\s*user\(\(user answers\)\)/u.test(edge)), "write does not go to the user");
  assert.ok(edges.some((edge) => /^user\b.*\|\s*write\b/u.test(edge)), "the user's answer does not go back to write");
  assert.ok(!edges.some((edge) => /^sync\b.*\|\s*user\b/u.test(edge) && /tools/u.test(edge)), "sync asks the tools alone");
  const rules = section(skillText("SKILL.md"), "Transversal rules");
  assert.match(rules, /Speak only to ask or to give the final reply; otherwise call tools\./u);
  assert.match(rules, /After the sheet or a reconcile offer, wait\./u);
  assert.match(rules, /Edit no memory file outside write\./u);
  assert.ok(rules.split(/\r?\n/u).filter((line) => line.startsWith("- ")).length <= 4, "more than four transversal rules");
});

test("the bank alone decides: a request goes to setup without a bank and to refresh with one, whatever word it uses", () => {
  const edges = routerEdges();
  const toScan = edges.filter((edge) => /^request\b.*\|\s*scan\b/u.test(edge));
  assert.equal(toScan.length, 2, "the request has more entries than the bank's two states");
  assert.ok(toScan.some((edge) => /\|"no bank: set up"\|/u.test(edge)), "no bank does not mean setup");
  assert.ok(toScan.some((edge) => /\|"a bank: refresh"\|/u.test(edge)), "a bank does not mean refresh");
  assert.doesNotMatch(edges.join("\n"), /\{/u, "the router decides with a diamond, not labelled edges");
});

test("an ok answer writes yes only where a line takes one, all but X writes no on X, and a remove or replace fact quotes the old line", () => {
  const answers = section(skillText("references/capabilities.md"), "Answers");
  assert.match(answers, /the person's own words \| ids optional/u);
  assert.match(answers, /`ok` or "all good" \| `yes` on each `remove`, `replace` and `move` line, the others left blank/u);
  assert.match(answers, /"all but X" \| as `ok`, with `no` on X, in one turn/u);
  assert.match(answers, /silence on an addition \| yes/u);
  assert.match(section(skillText("references/capabilities.md"), "Writing"), /^\| A line answered no \| skip it \|$/mu);
  assert.match(skillText("assets/fact-sheet.md"), /quote the old line exactly between double quotes/u);
});

test("no action offers to remove a file", () => {
  for (const file of skillMarkdown().filter((candidate) => /actions[\\/]/u.test(candidate))) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/u)) {
      assert.doesNotMatch(line.replace(/\bnever offer[^.]*\./iu, ""), /(?:offer|propose)[^\n]*\b(?:remov|delet|drop)\w*[^\n]*\bfile|\b(?:remov|delet|drop)\w*[^\n]*\bfile[^\n]*(?:offer|propose)/iu, `${path.basename(file)}: ${line}`);
    }
  }
  assert.match(skillText("actions/03-check.md"), /never offers? to remove a file/iu);
});

test("check reviews the content of each file against its defining files before the engine's format run, which comes last and investigates no warning", () => {
  const protocol = skillText("references/review-protocol.md");
  const at = (name) => protocol.indexOf(`## ${name}`);
  assert.ok(at("Content") >= 0 && at("Content") < at("Format"), "Content does not precede Format");
  assert.match(section(protocol, "Scope"), /one at a time/u, "the files are not reviewed one at a time");
  assert.match(section(protocol, "Format"), /not investigate/u, "warnings are chased");
  assert.doesNotMatch(protocol, /one sweep/u, "the review is still one sweep across files");
  const steps = skillText("actions/03-check.md").match(/^\d+\. .*$/gmu);
  assert.ok(steps.findIndex((step) => /content/u.test(step)) < steps.findIndex((step) => /format/u.test(step)), "check does not review the content before the format");
});

test("the reading order names the files that define a command or a convention, by category and never by tool, and a fact comes from the file that defines it", () => {
  const text = skillText("references/reading-sources.md");
  for (const [label, pattern] of [
    ["what runs before a commit", /before a commit/iu],
    ["the commit message rules", /commit message rules/iu],
    ["the task commands", /task commands/iu],
    ["the contribution guide", /contribution guide/iu],
    ["the AI instructions and rules", /AI instructions and rules/iu],
    ["the workspace file", /workspace file/iu],
  ]) assert.match(text, pattern, `the reading order lacks ${label}`);
  assert.match(text, /defines it/u, "no defining-file rule");
  assert.match(text, /`R`/u, "the defining file's fact does not go to the R block");
  assert.doesNotMatch(text, /first source that answers/u, "the reading still stops at the first source");
  assert.doesNotMatch(text, /\b(?:husky|lefthook|pre-commit|commitlint|makefile|justfile|taskfile|pnpm|npm|yarn|bun|cargo|gradle|poetry|uv|eslint|prettier|biome|ruff|turbo|nx)\b/iu, "regression guard: the reading order names a tool");
});

test("scan answers the brief's functional sections from the repository on a setup, and a refresh never adds them", () => {
  const step = skillText("references/reading-sources.md");
  for (const heading of ["Users", "Main journey", "Business rules"]) assert.ok(step.includes(`\`${heading}\``), `${heading} is not named`);
  assert.match(step, /else a `Q` line, never invented/u, "an unanswered section is invented or silently dropped");
  assert.match(step, /a setup collects them, a refresh never adds them/u, "a setup does not collect them, or a refresh forces them");
  assert.doesNotMatch(step, /\baudit\b|from a base/u, "a second refresh scope is left");
});

test("the review checks a cited command and a commit type against the files that define them", () => {
  const text = skillText("references/review-protocol.md");
  assert.match(text, /commit type/u, "no commit type check");
  assert.match(text, /reading-sources\.md/u, "the defining files are not the reading order's");
  assert.doesNotMatch(text, /\b(?:husky|lefthook|pre-commit|commitlint|makefile|pnpm|npm|yarn|bun|cargo|gradle|poetry|uv)\b/iu, "regression guard: the review names a tool");
});


test("the memory names what it lists and never asks for a count or a date", () => {
  assert.doesNotMatch(skillText("references/reading-sources.md"), /\bcount\b/u);
  assert.match(skillText("references/memory-rules.md"), /\| Name, never count or date \| the packages by name \| `four packages`, a date, `currently` \| exempt \|/u);
});

test("a refresh reviews the whole bank every time: changes orders the review and points to new facts, and limits nothing", () => {
  const protocol = skillText("references/review-protocol.md");
  const scope = section(protocol, "Scope");
  assert.doesNotMatch(scope, /^\| (?:Update|Audit) \|/mu, "the review still splits an update from an audit");
  assert.match(scope, /^\| Every refresh \| every line of the files a row produces or lists under Accepted names, one at a time, against its source and the code \|$/mu, "a refresh does not review every line");
  assert.match(scope, /^\| First \| the lines `changes` cites \|$/mu, "the cited lines are not reviewed first");
  assert.match(scope, /^\| New facts \| looked for in the files `changes` lists \|$/mu, "the changed files are not where new facts are looked for");
  assert.match(scope, /^\| A line outside the change set \| reviewed all the same, never skipped \|$/mu, "a line outside the change set is skipped");
  assert.doesNotMatch(skillText("references/engine.md"), /refresh or check/u, "changes still serves a check");
  assert.match(skillText("actions/03-check.md"), /^1\. Review the whole bank per the \[review protocol\]/mu, "check does not review the whole bank");
});

test("declining the plan writes nothing: no memory file, no sync", () => {
  const answers = section(skillText("references/capabilities.md"), "Answers");
  assert.match(answers, /^\| `no`, or the plan declined \| `no` on every line: nothing is written, nothing is synced \|$/mu, "a declined plan is not read as no on every line");
  assert.match(skillText("actions/02-write.md").match(/^3\. .*$/mu)[0], /^3\. If the plan is declined, write nothing and stop; if it holds no fact line, no absent always file and no added tool, report the bank current and stop\.$/u, "write does not stop on a declined plan, or a tool added to a current bank is never wired");
});

test("a refresh adds each tool the answer picks, then always runs a bare sync for every block; a setup adds the picked tools", () => {
  const sync = skillText("actions/04-sync.md");
  assert.match(sync, /^4\. On a refresh, run \[`sync`\]\([^)]+\) with `--add` and each tool the answer adds, then always with no tool name; on a setup, run it with `--add` and the picked tools, per \[tools\]/mu, "a refresh waits for a pick before it syncs, or drops a tool the answer adds");
});
