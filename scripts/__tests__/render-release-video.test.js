const assert = require("node:assert/strict");
const test = require("node:test");

const { buildHtml, sceneDuration } = require("../render-release-video.cjs");

const window = (rows) => ({ label: "Claude Code · ~/acme-app", rows });

const plan = {
  scenes: [
    {
      template: "terminal-demo",
      pill: "/aidd-telemetry:01-usage",
      title: "Know what your work costs,",
      accent: "in tokens.",
      window: window([
        { prompt: "/aidd-telemetry:01-usage how many tokens did ticket 412 use?" },
        { text: "$ aidd telemetry report --json", tone: "dim" },
        { chips: ["input", "output", "cache read", "cache write"] },
      ]),
      note: "Example figures.",
    },
    {
      template: "terminal-demo",
      pill: "/aidd-dev:10-batch",
      title: "One prompt,",
      accent: "one report.",
      window: window([
        { prompt: "/aidd-dev:10-batch fix three things" },
        { table: { head: ["Agent", "Task", "Status"], rows: [["executor-1", "README typo", { status: "Done" }]] } },
      ]),
    },
    {
      template: "terminal-demo",
      pill: "/aidd-orchestrator:01-sdlc",
      title: "Deliver end to end.",
      window: window([{ prompt: "/aidd-orchestrator:01-sdlc add a dark mode toggle" }]),
      flow: [
        { n: "01", title: "Frame", sub: "pause · contract" },
        { title: "Draft PR", final: true },
      ],
    },
    {
      template: "two-panels",
      pill: "/aidd-vcs:05-resolve-conflict",
      title: "Git conflicts, resolved.",
      panels: [
        { label: "config.yml", flex: 0.8, rows: [{ code: "<<<<<<< HEAD\ntimeout: 30" }] },
        { label: "resolve-conflict", flex: 1.6, rows: [{ check: "deterministic conflicts resolved" }, { check: "a real choice", mark: "!" }] },
      ],
    },
    {
      template: "bullet-grid",
      pill: "docs",
      title: "Docs that",
      accent: "pick for you.",
      cells: [{ title: "MCP or CLI, by usage", detail: "GitLab · Linear", wide: true }, { title: "Cook recipes refreshed" }],
    },
    { template: "contributors", pill: "release notes", title: "Shipped by", accent: "2 contributors.", logins: ["alice", "bob"] },
  ],
  skipped: [],
};

const sum = (scenes) => scenes.reduce((total, scene) => total + sceneDuration(scene), 0);

test("the intro starts with no version on screen and types it in", () => {
  const html = buildHtml(plan, { version: "5.13" });

  assert.match(html, /<span id="ver-t"><\/span><span class="dot"><\/span><span id="ver-n"><\/span>/);
  assert.match(html, /const full = "5\.13"/);
  assert.match(html, /AIDD <span class="g">v5\.13<\/span>/);
});

test("a scene's note appears after its last row, not with its window", () => {
  const html = buildHtml(plan, { version: "5.13" });
  const noteAt = Number(/enter\("#s1 \.fin", ([\d.]+)/.exec(html)?.[1]);
  const lastRowAt = 5 + 1.3 + 0.45 * (plan.scenes[0].window.rows.length - 1);

  assert.match(html, /<p class="note fin">Example figures\.<\/p>/);
  assert.ok(noteAt > lastRowAt, `note at ${noteAt}, last row at ${lastRowAt}`);
});

test("a window has the traffic-light bar and its label", () => {
  const html = buildHtml(plan, { version: "5.13" });

  assert.match(html, /<i style="background:#ff6b6b"><\/i><i style="background:#ffd37a"><\/i><i style="background:#5ee6a8"><\/i><span>Claude Code · ~\/acme-app<\/span>/);
});

test("every row kind a scene can hold is drawn", () => {
  const html = buildHtml(plan, { version: "5.13" });

  assert.match(html, /<span class="grn">&gt;<\/span> \/aidd-telemetry:01-usage how many/);
  assert.match(html, /class="chip c1">input</);
  assert.match(html, /<th>Agent<\/th>/);
  assert.match(html, /<span class="done">Done<\/span>/);
  assert.match(html, /<div class="row code">&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD\ntimeout: 30<\/div>/);
  assert.match(html, /<span class="amb">!<\/span><span>a real choice<\/span>/);
});

test("a flow draws its steps, arrows and the final one", () => {
  const html = buildHtml(plan, { version: "5.13" });

  assert.match(html, /<span class="t">Frame<\/span><span class="p">pause · contract<\/span>/);
  assert.match(html, /<span class="arrow it">→<\/span>/);
  assert.match(html, /step pr it"><span class="n">&nbsp;<\/span><span class="t grn">Draft PR<\/span>/);
});

test("a title carries its gradient accent", () => {
  const html = buildHtml(plan, { version: "5.13" });

  assert.match(html, /Know what your work costs, <span class="g">in tokens\.<\/span>/);
});

test("panels keep their relative width", () => {
  const html = buildHtml(plan, { version: "5.13" });

  assert.match(html, /style="flex:0\.8"/);
  assert.match(html, /style="flex:1\.6"/);
});

test("buildHtml renders each scene's title, in order", () => {
  const html = buildHtml(plan, { version: "5.13" });
  const at = ["Know what your work costs", "One prompt", "Deliver end to end", "Git conflicts", "Docs that", "Shipped by"].map((t) =>
    html.indexOf(t)
  );

  assert.ok(at.every((i) => i > -1), `missing title: ${at}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at);
});

test("buildHtml escapes text so a scene cannot inject markup", () => {
  const evil = {
    scenes: [{ template: "terminal-demo", pill: "p", title: "<img src=x>", window: window([{ text: "<b>x</b>" }]) }],
    skipped: [],
  };
  const html = buildHtml(evil, { version: "5.13" });

  assert.ok(!html.includes("<img src=x>") && !html.includes("<b>x</b>"));
});

test("the root duration is intro, scenes and outro added up", () => {
  const html = buildHtml(plan, { version: "5.13" });

  assert.match(html, new RegExp(`id="root"[^>]*data-duration="${5 + sum(plan.scenes) + 4}"`));
});

test("a scene with more rows lasts longer", () => {
  const few = { template: "terminal-demo", window: window([{ text: "a" }]) };
  const many = { template: "terminal-demo", window: window([{ text: "a" }, { text: "b" }, { text: "c" }]) };

  assert.ok(sceneDuration(many) > sceneDuration(few));
});

test("buildHtml fails on an unknown template", () => {
  assert.throws(
    () => buildHtml({ scenes: [{ template: "spinning-logo" }], skipped: [] }, { version: "5.13" }),
    /Unknown template: spinning-logo/
  );
});

test("a contributor avatar points at a file next to the page", () => {
  assert.match(buildHtml(plan, { version: "5.13" }), /src="assets\/av-alice\.png"/);
});
