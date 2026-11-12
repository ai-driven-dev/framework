const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ENGINE = path.resolve(__dirname, "../../plugins/aidd-context/hooks/memory.cjs");
const TEMPLATE = path.resolve(__dirname, "../../plugins/aidd-context/skills/02-project-memory/assets/templates/memory/browsing.md");
const SHEET = "aidd_docs/tasks/2026_11/2026_11_12_memory-setup/facts.md";
const OPEN = "<!-- aidd_project_memory:start -->";
const CLOSE = "<!-- aidd_project_memory:end -->";
const { ALWAYS_WRITTEN } = require(ENGINE);

function project(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-browsing-"));
  for (const [name, text] of Object.entries(files)) put(root, name, text);
  return root;
}

function put(root, name, text) {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function engine(root, ...args) {
  return spawnSync(process.execPath, [ENGINE, ...args], { cwd: root, encoding: "utf8" });
}

function factsOf(root) {
  return fs.readFileSync(path.join(root, SHEET), "utf8");
}

function syncClaude(root) {
  return engine(root, "sync", "--add", "claude");
}

function seedAlways(root) {
  for (const name of ALWAYS_WRITTEN) {
    const file = `aidd_docs/memory/${name}`;
    if (!fs.existsSync(path.join(root, file))) put(root, file, `# ${name}\n\n- Existing project context.\n`);
  }
}

function writeBrowsing(root, profile, session) {
  const template = fs.readFileSync(TEMPLATE, "utf8");
  const browserMemory = template
    .replace("{{Which browser tool or MCP is configured for project work, how is it invoked, and which mode does it use?}}", "Playwright MCP, invoked through the project MCP config.")
    .replace("{{Which browser profile or account should project work use?}}", profile)
    .replace("{{Should links open in the integrated or external browser?}}", "Integrated browser.")
    .replace("{{What starting URL or discovery path does project work use?}}", "https://docs.example.test")
    .replace("{{How is authenticated access reached without recording secrets?}}", session);
  assert.doesNotMatch(browserMemory, /\{\{/u);
  put(root, "aidd_docs/memory/browsing.md", browserMemory);
}

function promoteAnsweredQuestions(root) {
  const lines = factsOf(root).split("\n");
  let nextId = Math.max(0, ...lines.flatMap((line) => [...line.matchAll(/^- R(\d+) \|/gu)].map(([, id]) => Number(id)))) + 1;
  const answers = lines.flatMap((line) => {
    if (!line.startsWith("- Q")) return [];
    const [id, target, , source, answer = ""] = line.slice(2).split("|").map((part) => part.trim());
    assert.equal(source, "none");
    assert.notEqual(answer, "", `${id} has no user answer to promote`);
    return [`- R${nextId++} | ${target} | ${answer} | user |`];
  });
  const kept = lines.filter((line) => !line.startsWith("- Q"));
  const insertAt = kept.indexOf("## Inferred");
  assert.ok(insertAt >= 0, "fact sheet has no Inferred block");
  kept.splice(insertAt, 0, ...answers, "");
  put(root, SHEET, kept.join("\n"));
}

test("browsing setup passes plan, exact answers, template write, check and sync", () => {
  const profile = "Project Chrome profile";
  const session = "Reuse the authenticated project profile";
  const facts = [
    "# Facts: setup",
    "",
    "- Capabilities: C1 browsing",
    "",
    "## Read",
    "",
    "- R1 | browsing.md > Tool setup | Playwright MCP is configured for this project. | .aidd/browser.json |",
    "- R2 | browsing.md > Tool setup | Project Chrome profile. | .aidd/browser.json |",
    "- R3 | browsing.md > Links | Open links in the integrated browser. | .aidd/browser.json |",
    "- R4 | browsing.md > Links | Start at https://docs.example.test. | .aidd/browser.json |",
    "- R5 | browsing.md > Authentication | Reuse the authenticated project profile. | .aidd/browser.json |",
    "",
  ].join("\n");
  const root = project({
    ".aidd/browser.json": JSON.stringify({ tool: "Playwright MCP", profile, linkBrowser: "integrated", entry: "https://docs.example.test", auth: session }),
    "package.json": "{}\n",
    [SHEET]: facts,
    "CLAUDE.md": `# Project\n\n${OPEN}\n${CLOSE}\n`,
  });

  try {
    seedAlways(root);
    const plan = engine(root, "plan", SHEET, "--tools", "claude");
    assert.equal(plan.status, 0, plan.stdout + plan.stderr);
    const detail = fs.readFileSync(path.join(root, SHEET.replace("facts.md", "plan.md")), "utf8");
    assert.match(detail, /browsing\.md \(new\)/u);
    assert.doesNotMatch(plan.stdout, /Questions/u, "the configured browser leaves no material choice open");
    assert.doesNotMatch(plan.stdout, /Reply ok|Say ok/u, "an addition needs no confirmation prompt");
    assert.equal(fs.existsSync(path.join(root, "aidd_docs/memory/browsing.md")), false, "plan wrote memory before the answer");

    // The request already supplies all material choices. Showing the plan must not force an `ok` reply.
    writeBrowsing(root, profile, session);

    const check = engine(root, "check", ".", "aidd_docs/memory/browsing.md");
    assert.equal(check.status, 0, check.stdout + check.stderr);
    const sync = syncClaude(root);
    assert.equal(sync.status, 0, sync.stdout + sync.stderr);
    assert.match(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), /@aidd_docs\/memory\/browsing\.md/u);
    const report = engine(root, "report", SHEET);
    assert.equal(report.status, 0, report.stdout + report.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("answer records only the user's exact answer to a browsing question", () => {
  const userAnswer = "Reuse the authenticated project profile";
  const facts = [
    "# Facts: refresh",
    "",
    "- Capabilities: C1 browsing",
    "",
    "## Read",
    "",
    "- R1 | browsing.md > Tool setup | Playwright MCP is configured for this project. | .aidd/browser.json |",
    "",
    "## Inferred",
    "",
    "## Unknown",
    "",
    "- Q1 | browsing.md > Authentication | Which authenticated session should project work reuse? | none |",
    "",
  ].join("\n");
  const root = project({
    ".aidd/browser.json": JSON.stringify({ tool: "Playwright MCP" }),
    "package.json": "{}\n",
    [SHEET]: facts,
    "CLAUDE.md": `# Project\n\n${OPEN}\n${CLOSE}\n`,
  });

  try {
    seedAlways(root);
    const plan = engine(root, "plan", SHEET, "--tools", "claude");
    assert.equal(plan.status, 0, plan.stdout + plan.stderr);
    assert.match(plan.stdout, /Q1  Which authenticated session/u);
    assert.doesNotMatch(plan.stdout, /Reply ok|Say ok/u, "the question does not need an approval prompt");
    const answer = engine(root, "answer", SHEET, `ok Q1: ${userAnswer}`);
    assert.equal(answer.status, 0, answer.stdout + answer.stderr);
    assert.match(factsOf(root), /Q1 \|[^\n]+\| none \|$/mu, "the engine fabricated a Q answer");

    // The skill copies the user's words into Q's answer field; the engine leaves it for the writer.
    put(root, SHEET, factsOf(root).replace(
      "- Q1 | browsing.md > Authentication | Which authenticated session should project work reuse? | none |",
      `- Q1 | browsing.md > Authentication | Which authenticated session should project work reuse? | none | ${userAnswer}`,
    ));
    promoteAnsweredQuestions(root);
    const updatedPlan = engine(root, "plan", SHEET, "--tools", "claude");
    assert.equal(updatedPlan.status, 0, updatedPlan.stdout + updatedPlan.stderr);
    assert.doesNotMatch(updatedPlan.stdout, /Questions/u);
    assert.equal(engine(root, "answer", SHEET, "ok").status, 0, "reuse the prior approval for the same browsing file");

    writeBrowsing(root, "Project Chrome profile", userAnswer);
    const check = engine(root, "check", ".", "aidd_docs/memory/browsing.md");
    assert.equal(check.status, 0, check.stdout + check.stderr);
    const sync = syncClaude(root);
    assert.equal(sync.status, 0, sync.stdout + sync.stderr);
    assert.match(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), /@aidd_docs\/memory\/browsing\.md/u);
    const report = engine(root, "report", SHEET);
    assert.equal(report.status, 0, report.stdout + report.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("user-confirmed browsing without repo config becomes a normal fact and syncs without a second ask", () => {
  const answers = [
    "Playwright MCP, invoked through the project MCP connection.",
    "Project Chrome profile.",
    "Integrated browser.",
    "https://docs.example.test",
    "Reuse the authenticated project profile; store no credentials.",
  ];
  const questions = [
    ["Tool setup", "Which browser tool and mode should project work use?"],
    ["Tool setup", "Which browser profile or account should it use?"],
    ["Links", "Should links open in the integrated or external browser?"],
    ["Links", "What starting URL should project work use?"],
    ["Authentication", "How should project work reuse authenticated access without secrets?"],
  ];
  const unknown = [
    "# Facts: setup",
    "",
    "- Capabilities: C1 browsing",
    "",
    "## Read",
    "",
    "## Inferred",
    "",
    "## Unknown",
    "",
    ...questions.map(([section, question], index) => `- Q${index + 1} | browsing.md > ${section} | ${question} | none | ${answers[index]}`),
    "",
  ].join("\n");
  const root = project({
    "package.json": "{}\n",
    [SHEET]: unknown,
    "CLAUDE.md": `# Project\n\n${OPEN}\n${CLOSE}\n`,
  });

  try {
    assert.equal(fs.existsSync(path.join(root, ".aidd/browser.json")), false);
    seedAlways(root);
    promoteAnsweredQuestions(root);
    assert.equal((factsOf(root).match(/^- R\d+ \| browsing\.md/gmu) ?? []).length, 5);
    assert.doesNotMatch(factsOf(root), /^- Q/mu);

    const plan = engine(root, "plan", SHEET, "--tools", "claude");
    assert.equal(plan.status, 0, plan.stdout + plan.stderr);
    assert.doesNotMatch(plan.stdout, /Questions/u);
    assert.doesNotMatch(plan.stdout, /Reply ok|Say ok/u, "the user-confirmed addition needs no new approval");
    assert.match(fs.readFileSync(path.join(root, SHEET.replace("facts.md", "plan.md")), "utf8"), /browsing\.md \(new\)/u);

    writeBrowsing(root, answers[1], answers[4]);
    assert.equal(engine(root, "check", ".", "aidd_docs/memory/browsing.md").status, 0);
    assert.equal(syncClaude(root).status, 0);
    assert.match(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), /@aidd_docs\/memory\/browsing\.md/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("refresh without a configured browser does not propose or remove existing browsing memory", () => {
  const browserMemory = "# Browsing\n\n- Tool: Playwright MCP.\n- Profile: Project Chrome profile.\n";
  const testing = "# Testing\n\n- Legacy test command: `yarn test`.\n";
  const facts = [
    "# Facts: refresh",
    "",
    "- Capabilities: C1 core",
    "- Since abc123 (memory setup), 1 minute ago: 1 commit, 1 file changed",
    "",
    "## Inferred",
    "",
    '- D1 | testing.md > Run | remove "- Legacy test command: `yarn test`." because the command is gone | package.json |',
    "",
  ].join("\n");
  const root = project({
    "package.json": JSON.stringify({ scripts: { test: "pnpm test" } }),
    "aidd_docs/memory/browsing.md": browserMemory,
    "aidd_docs/memory/testing.md": testing,
    [SHEET]: facts,
    "CLAUDE.md": `# Project\n\n${OPEN}\n${CLOSE}\n`,
  });

  try {
    assert.equal(fs.existsSync(path.join(root, ".aidd/browser.json")), false, "fixture unexpectedly configures a browser");
    seedAlways(root);
    const plan = engine(root, "plan", SHEET, "--tools", "claude");
    assert.equal(plan.status, 0, plan.stdout + plan.stderr);
    const detail = fs.readFileSync(path.join(root, SHEET.replace("facts.md", "plan.md")), "utf8");
    assert.match(detail, /testing\.md/u);
    assert.doesNotMatch(plan.stdout + detail, /browsing\.md/u);

    const answer = engine(root, "answer", SHEET, "ok");
    assert.equal(answer.status, 0, answer.stdout + answer.stderr);
    assert.match(factsOf(root), /D1 \|[^\n]+\| yes$/mu);
    put(root, "aidd_docs/memory/testing.md", "# Testing\n");
    const check = engine(root, "check", ".", "aidd_docs/memory/browsing.md");
    assert.equal(check.status, 0, check.stdout + check.stderr);
    assert.equal(fs.readFileSync(path.join(root, "aidd_docs/memory/testing.md"), "utf8"), "# Testing\n");
    assert.equal(fs.readFileSync(path.join(root, "aidd_docs/memory/browsing.md"), "utf8"), browserMemory);

    const sync = syncClaude(root);
    assert.equal(sync.status, 0, sync.stdout + sync.stderr);
    assert.match(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), /@aidd_docs\/memory\/browsing\.md/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a replan and later ok preserve an earlier not N refusal after a Q answer", () => {
  const oldLine = "- Legacy test command: `yarn test`.";
  const facts = [
    "# Facts: refresh",
    "",
    "- Capabilities: C1 browsing",
    "",
    "## Read",
    "",
    "## Inferred",
    "",
    `- D1 | testing.md > Run | remove \"${oldLine}\" because the old command is gone | package.json |`,
    "",
    "## Unknown",
    "",
    "- Q1 | browsing.md > Links | Where should project links open? | none |",
    "",
  ].join("\n");
  const root = project({
    "package.json": JSON.stringify({ scripts: { test: "pnpm test" } }),
    "aidd_docs/memory/testing.md": `# Testing\n\n${oldLine}\n`,
    [SHEET]: facts,
    "CLAUDE.md": `# Project\n\n${OPEN}\n${CLOSE}\n`,
  });

  try {
    seedAlways(root);
    const firstPlan = engine(root, "plan", SHEET, "--tools", "claude");
    assert.equal(firstPlan.status, 0, firstPlan.stdout + firstPlan.stderr);
    assert.match(firstPlan.stdout, /Reply ok/u, "the unresolved removal needs approval");
    assert.equal(engine(root, "answer", SHEET, "not 1").status, 0);
    assert.match(factsOf(root), /D1 \|[^\n]+\| no$/mu);

    put(root, SHEET, factsOf(root).replace(
      "- Q1 | browsing.md > Links | Where should project links open? | none |",
      "- Q1 | browsing.md > Links | Where should project links open? | none | Integrated browser.",
    ));
    promoteAnsweredQuestions(root);
    const secondPlan = engine(root, "plan", SHEET, "--tools", "claude");
    assert.equal(secondPlan.status, 0, secondPlan.stdout + secondPlan.stderr);
    assert.doesNotMatch(secondPlan.stdout, /Questions|Reply ok/u);
    assert.match(factsOf(root), /D1 \|[^\n]+\| no$/mu, "replanning reset the refusal");

    // Simulate a stale or later broad reply: it may approve the new addition, never the declined deletion.
    const laterOk = engine(root, "answer", SHEET, "ok");
    assert.equal(laterOk.status, 0, laterOk.stdout + laterOk.stderr);
    assert.match(factsOf(root), /D1 \|[^\n]+\| no$/mu);
    const write = "# Browsing\n\n- Browser: Integrated browser.\n";
    put(root, "aidd_docs/memory/browsing.md", write);
    assert.equal(engine(root, "check", ".", "aidd_docs/memory/browsing.md").status, 0);
    assert.equal(syncClaude(root).status, 0);
    assert.match(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), /@aidd_docs\/memory\/browsing\.md/u);
    const report = engine(root, "report", SHEET);
    assert.equal(report.status, 0, report.stdout + report.stderr);
    assert.match(report.stdout, /testing\.md: you declined/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
