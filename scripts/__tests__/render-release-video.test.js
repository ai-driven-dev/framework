const assert = require("node:assert/strict");
const test = require("node:test");

const { buildHtml, musicSegments, musicSections, sceneDuration, soundCues, soundTrack, totalDuration } = require("../../.claude/skills/release-video/assets/render-release-video.cjs");

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

test("a scene's lead says in plain words what it brings, under its title", () => {
  const withLead = {
    scenes: [{ ...plan.scenes[0], lead: "Ask what a task cost and get the answer." }],
    skipped: [],
  };
  const html = buildHtml(withLead, { version: "5.13" });

  assert.match(html, /<\/h2><p class="lead" id="s1-lead">Ask what a task cost and get the answer\.<\/p>/);
});

test("a lead gives the scene time to be read", () => {
  const bare = plan.scenes[0];

  assert.ok(sceneDuration({ ...bare, lead: "Ask what a task cost." }) > sceneDuration(bare));
});

test("the intro says what the release holds, in a few words", () => {
  const html = buildHtml(
    { ...plan, intro: { tagline: "Costs, batches, conflicts.", highlights: ["Token costs", "Parallel agents", "Git conflicts"] } },
    { version: "5.13" },
  );

  assert.match(html, /<p class="tagline" id="intro-tag">Costs, batches, conflicts\.<\/p>/);
  assert.match(html, /<span class="hl it">Token costs<\/span><span class="hl it">Parallel agents<\/span><span class="hl it">Git conflicts<\/span>/);
});

test("the intro keeps a default tagline when the plan gives none", () => {
  assert.match(buildHtml(plan, { version: "5.13" }), /What's new, <b>end to end\.<\/b>/);
});

test("a music track plays under the whole video and fades in and out", () => {
  const total = 5 + sum(plan.scenes) + 4;
  const html = buildHtml(plan, { version: "5.13", music: "assets/music.mp3" });
  const audio = /<audio[^>]*>/.exec(html)?.[0] ?? "";

  assert.match(audio, /id="music"/);
  assert.match(audio, /src="assets\/music\.mp3"/);
  assert.match(audio, new RegExp(`data-start="0" data-duration="${total}"`));
  assert.match(audio, /data-automation="[^"]*&quot;target&quot;:&quot;volume&quot;/);
  assert.ok(audio.includes(`&quot;t&quot;:${total}`), "the fade ends with the video");
});

test("no music track, no audio element", () => {
  assert.ok(!buildHtml(plan, { version: "5.13" }).includes("<audio"));
});

test("totalDuration is what the root declares, so a music track can be cut to fit", () => {
  const withIntro = { ...plan, intro: { highlights: ["a"] } };

  assert.equal(totalDuration(plan), 5 + sum(plan.scenes) + 4);
  assert.equal(totalDuration(withIntro), 6.5 + sum(plan.scenes) + 4);
  assert.match(buildHtml(withIntro, { version: "5.13" }), new RegExp(`data-duration="${totalDuration(withIntro)}"`));
});

test("the music stays under the picture: the fade peaks at the music level, not at full volume", () => {
  const audio = /<audio[^>]*>/.exec(buildHtml(plan, { version: "5.13", music: "assets/music.mp3" }))[0];

  assert.match(audio, /&quot;t&quot;:0\.3,&quot;v&quot;:0\.5/);
  assert.ok(!audio.includes("&quot;v&quot;:1}"), "a point at full volume");
});

// Energy of a real track, one value per half second: a silent start, a loud hook, a quiet bed,
// a loud finale that fades out.
const rms = [
  -37, ...Array(11).fill(-10), ...Array(61).fill(-26), ...Array(5).fill(-8), -23, -61,
];

test("musicSections finds the hook and the ending of a track, the bed is what lies between", () => {
  assert.deepEqual(musicSections(rms), {
    headStart: 0.5,
    headEnd: 6,
    tailStart: 35.5,
    tailEnd: 39.5,
  });
});

test("a track with no loud hook has no sections", () => {
  assert.equal(musicSections(Array(40).fill(-26)), null);
});

test("the hook plays under the intro, the bed under the scenes and the outro, the ending closes the video", () => {
  const sections = musicSections(rms);
  const [head, body, tail] = musicSegments(sections, { intro: 5, total: 30, outro: 4 });

  assert.deepEqual(head, { part: "head", from: 0.5, length: 5, at: 0 });
  assert.equal(body.part, "body");
  assert.equal(body.at, 5);
  assert.equal(body.length, 30 - 4 - 5);
  assert.deepEqual(tail, { part: "tail", from: 35.5, length: 4, at: 26 });
});

test("an intro longer than the hook lets the bed start early, never a gap", () => {
  const [head, body] = musicSegments(musicSections(rms), { intro: 6.5, total: 30, outro: 4 });

  assert.equal(head.length, 5.5);
  assert.equal(body.at, head.at + head.length);
});

const cuesOf = (kind, from, to) => soundCues(plan, { version: "5.13" }).filter((c) => c.kind === kind && c.t >= from && c.t < to);

test("every sound is on a time of the video, in order", () => {
  const cues = soundCues(plan, { version: "5.13" });

  assert.ok(cues.length > 0);
  assert.ok(cues.every((c) => c.t >= 0 && c.t < totalDuration(plan)), "a cue outside the video");
  assert.deepEqual(cues.map((c) => c.t), cues.map((c) => c.t).sort((a, b) => a - b));
});

test("a key tick sounds for each character of the version as it is typed", () => {
  const typed = cuesOf("key", 0.8, 1.9);

  assert.equal(typed.length, "5.13".length + 1);
});

test("each scene opens with a whoosh at its own start", () => {
  const starts = plan.scenes.reduce(
    (acc, scene) => [...acc, acc[acc.length - 1] + sceneDuration(scene)],
    [5],
  ).slice(0, plan.scenes.length);
  const whooshes = soundCues(plan, { version: "5.13" }).filter((c) => c.kind === "whoosh").map((c) => c.t);

  assert.deepEqual(whooshes, starts);
});

test("a click sounds when each row of a window appears", () => {
  const first = plan.scenes[0];
  const start = 5;
  const clicks = cuesOf("click", start + 1.3, start + sceneDuration(first)).map((c) => c.t);
  const rows = first.window.rows.length;

  assert.deepEqual(clicks, Array.from({ length: rows }, (_, i) => Math.round((start + 1.3 + 0.45 * i) * 100) / 100));
});

test("a pop sounds as each window or item slides in", () => {
  const start = 5;
  const first = plan.scenes[0];
  const pops = cuesOf("pop", start + 0.6, start + 0.7 + 0.3 * 2).map((c) => c.t);

  assert.ok(first.window, "scene 1 has a window");
  assert.ok(pops.includes(start + 0.63 + 0.3 * 0), "the window pop");
});

test("the outro has no sound of its own: the ending of the music opens it", () => {
  assert.equal(soundCues(plan, { version: "5.13" }).filter((c) => c.kind === "chime").length, 0);
  assert.equal(cuesOf("pop", totalDuration(plan) - 4, totalDuration(plan)).length, 2);
});

test("the sound track is a wav as long as the video, loud on a cue and silent between", () => {
  const wav = soundTrack(plan, { version: "5.13" });
  const rate = wav.readUInt32LE(24);
  const sample = (seconds) => Math.abs(wav.readInt16LE(44 + 2 * Math.floor(seconds * rate)));
  const peakNear = (seconds) => Math.max(...Array.from({ length: 400 }, (_, i) => sample(seconds + i / rate)));

  assert.equal(wav.toString("latin1", 0, 4), "RIFF");
  assert.equal(wav.length, 44 + 2 * Math.round(totalDuration(plan) * rate));
  assert.ok(peakNear(5 + 1.3) > 1000, "silent on a click");
  assert.equal(peakNear(5 + 0.3), 0, "noise between cues");
});

test("the sound track plays under the whole video, quieter than the picture would", () => {
  const html = buildHtml(plan, { version: "5.13", sfx: "assets/sfx.wav" });
  const audio = /<audio id="sfx"[^>]*>/.exec(html)?.[0] ?? "";

  assert.match(audio, /src="assets\/sfx\.wav"/);
  assert.match(audio, new RegExp(`data-start="0" data-duration="${totalDuration(plan)}"`));
  assert.match(audio, /data-volume="0\.\d+"/);
});

test("no sound track, no sfx element", () => {
  assert.ok(!buildHtml(plan, { version: "5.13" }).includes('id="sfx"'));
});

test("a red line flags a problem: the row and its colour are drawn", () => {
  const html = buildHtml(
    { scenes: [{ template: "terminal-demo", pill: "p", title: "t", window: window([{ text: "Conflict", tone: "red" }]) }], skipped: [] },
    { version: "5.13" },
  );

  assert.match(html, /<div class="row red">Conflict<\/div>/);
  assert.match(html, /\.row\.red \{/);
});

test("the kit ships its own music, so a render on the CI sounds like a local one", () => {
  const kit = require("node:path").join(__dirname, "../../.claude/skills/release-video/assets/music.mp3");

  assert.ok(require("node:fs").existsSync(kit), "the skill's music.mp3 is missing");
});

test("an intro with tags and no phrase shows the tags alone, from the start of the text", () => {
  const withTags = { ...plan, intro: { highlights: ["Telemetry for Codex", "No clashing rules"] } };
  const html = buildHtml(withTags, { version: "5.13" });

  assert.ok(!html.includes('id="intro-tag"'), "a phrase is drawn");
  assert.match(html, /<span class="hl it">Telemetry for Codex<\/span>/);
  assert.match(html, /enter\("#intro \.hl", 2,/);
});

test("no pop is cued for a phrase the intro does not draw", () => {
  const withTags = { ...plan, intro: { highlights: ["a", "b"] } };
  const pops = soundCues(withTags, { version: "5.13" }).filter((c) => c.kind === "pop" && c.t < 4).map((c) => c.t);

  assert.deepEqual(pops, [0.1, 2, 2.3]);
});
