const assert = require("node:assert/strict");
const test = require("node:test");

const { buildHtml, measureRms, musicSegments, musicSections, sceneDuration, soundCues, posterArgs, soundTrack, thumbnailHtml, totalDuration } = require("../../.claude/skills/release-video/assets/render-release-video.cjs");

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

test("the thumbnail is its own still composition: the logo, the release and the whole version, then the themes", () => {
  const html = thumbnailHtml({ ...plan, youtube: { themes: ["Télémétrie", "Plan"], programme: [] } }, { version: "5.13" });

  assert.match(html, /<span id="ver-t">v5<\/span><span class="dot">\.<\/span><span id="ver-n">13<\/span>/);
  assert.match(html, /<img id="intro-logo"/);
  assert.match(html, /AIDD Framework/);
  assert.match(html, /NEW RELEASE/);
  assert.match(html, /<p class="themes">Télémétrie · Plan<\/p>/);
  assert.match(html, /data-duration="1"/);
  assert.doesNotMatch(html, /class="hl|typed|enter\(/);
});

test("the video opens on the thumbnail for one frame, so a chat shows it as the preview, and keeps its bitrate", () => {
  const args = posterArgs({ video: "v.mp4", poster: "t.png", out: "o.mp4", bitrate: 866446 });
  const joined = args.join(" ");

  assert.ok(args.includes("t.png") && args.includes("v.mp4") && args.at(-1) === "o.mp4");
  assert.match(joined, /concat=n=2:v=1:a=0/);
  assert.match(joined, /adelay=34\|34/);
  assert.equal(args[args.indexOf("-b:v") + 1], "866k");
  assert.equal(args[args.indexOf("-maxrate") + 1], "1083k");
});

test("a thumbnail with no themes draws none", () => {
  assert.doesNotMatch(thumbnailHtml({ ...plan, youtube: undefined }, { version: "5.13" }), /class="themes"/);
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

test("an intro without tags opens on the thumbnail's themes", () => {
  const html = buildHtml({ ...plan, youtube: { themes: ["Antigravity", "Agents"] } }, { version: "5.14" });

  assert.match(html, /<p class="themes" id="intro-themes">Antigravity · Agents<\/p>/);
  assert.match(html, /enter\("#intro-themes", 2\.0,/);
  assert.ok(!html.includes('id="intro-tag"'), "the default phrase is drawn too");
});

test("a grid cell shows the icon of its intent beside its title", () => {
  const grid = { template: "bullet-grid", pill: "Agents", title: "4 new", surfaces: [], cells: [{ title: "explorer", icon: "search" }] };
  const html = buildHtml({ ...plan, scenes: [grid] }, { version: "5.14" });

  assert.match(html, /<b><svg class="ico"[^>]*>.*?<\/svg>explorer<\/b>/);
});

test("a table cell takes the tone it is given", () => {
  const row = { table: { head: ["Tool", "Status"], rows: [["Jira", { tone: "amb", text: "Signed out" }]] } };
  const demo = { template: "terminal-demo", pill: "Connections", title: "Check", surfaces: [], window: { label: "x", rows: [row] } };
  const html = buildHtml({ ...plan, scenes: [demo] }, { version: "5.14" });

  assert.match(html, /<td class="amb">Signed out<\/td>/);
});

const agents = {
  template: "terminal-demo",
  pill: "Agents",
  title: "4 new",
  surfaces: [],
  window: window([{ prompt: "add a login page" }]),
  flow: [
    { n: "1", title: "explorer", sub: "finds the code", icon: "search", log: ["src/", "auth/"] },
    { n: "2", title: "executor", sub: "builds and tests", icon: "build" },
  ],
};
const workTimes = (html) => [...html.matchAll(/work\("#s1", (\d+), ([\d.]+), [\d.]+[^)]*\);/g)].map((m) => [Number(m[1]), Number(m[2])]);

test("a flow step shows the icon of its intent beside its title", () => {
  const html = buildHtml({ ...plan, scenes: [agents] }, { version: "5.14" });

  assert.match(html, /<span class="t"><svg class="ico"[^>]*>.*?<\/svg>explorer<\/span>/);
});

test("each flow step works in turn, once the scene is on screen: its bar fills, then it is done", () => {
  const html = buildHtml({ ...plan, scenes: [agents] }, { version: "5.14" });
  const times = workTimes(html);

  assert.match(html, /class="step it" data-w="0">.*?<span class="wbar"><i><\/i><\/span>/);
  assert.match(html, /class="step it" data-w="1">/);
  assert.deepEqual(times.map(([w]) => w), [0, 1]);
  assert.ok(times[0][1] >= 5 + 0.63 + 0.3 * 4, "a step works before every step is on screen");
  assert.ok(times[1][1] >= times[0][1] + 1, "the next step starts before the previous one is done");
});

test("a scene lasts long enough for each step to work in turn", () => {
  const still = { ...agents, flow: agents.flow.map(({ title, sub }) => ({ title, sub, final: true })) };

  assert.ok(sceneDuration(agents) >= sceneDuration(still) + 2);
});

test("a checked table row first shows it is checking, then its result", () => {
  const row = {
    table: {
      head: ["Tool", "Status", "Next step"],
      rows: [["Jira", { checking: { tone: "amb", text: "Signed out" } }, { result: "sign in" }], ["GitHub", { status: "Read OK" }, ""]],
    },
  };
  const demo = { template: "terminal-demo", pill: "Connections", title: "Check", surfaces: [], window: window([row]) };
  const html = buildHtml({ ...plan, scenes: [demo] }, { version: "5.14" });

  assert.match(html, /<tr data-w="0"><td>Jira<\/td><td><div class="wcell"><span class="wpend dim">checking…<span class="wbar"><i><\/i><\/span><\/span><span class="wres amb">Signed out<\/span><\/div><\/td>/);
  assert.match(html, /<td><div class="wcell"><span class="wpend"><\/span><span class="wres">sign in<\/span><\/div><\/td><\/tr>/);
  assert.match(html, /<tr><td>GitHub<\/td>/);
  assert.deepEqual(workTimes(html).map(([w]) => w), [0]);
});

test("a working step shows what it does, line by line, while its bar fills", () => {
  const html = buildHtml({ ...plan, scenes: [agents] }, { version: "5.14" });

  assert.match(html, /data-w="0">.*?<span class="wlog"><span class="wrun" data-run="0"><span class="wl">src\/<\/span><span class="wl">auth\/<\/span><\/span><\/span>/);
  assert.match(html, /tl\.from\(lines, \{[^}]*stagger: fill \/ /);
});

test("a checked cell may say what it waits for instead of checking", () => {
  const row = { table: { head: ["Path", "Holds"], rows: [[".agents/skills/", { checking: { status: "48 skills" }, pending: "installing…" }]] } };
  const demo = { template: "terminal-demo", pill: "Antigravity", title: "Setup", surfaces: [], window: window([row]) };
  const html = buildHtml({ ...plan, scenes: [demo] }, { version: "5.14" });

  assert.match(html, /<span class="wpend dim">installing…<span class="wbar">/);
});

test("checked rows tick by faster than flow steps, and their time is counted once", () => {
  const rows = (n) => ({
    template: "terminal-demo",
    pill: "Install",
    title: "Setup",
    surfaces: [],
    window: window([{ table: { head: ["Tool", "Installed"], rows: Array.from({ length: n }, (_, i) => [`t${i}`, { checking: "ok" }]) } }]),
  });
  const html = buildHtml({ ...plan, scenes: [rows(3)] }, { version: "5.14" });
  const [[, a], [, b]] = workTimes(html);

  assert.ok(b - a < 1, "a row takes as long as a step");
  assert.ok(sceneDuration(rows(6)) - sceneDuration(rows(4)) <= 2 * (b - a) + 0.5, "a checked row is counted as a row and as work");
});

test("a check that ends pops", () => {
  const html = buildHtml({ ...plan, scenes: [agents] }, { version: "5.14" });
  const cues = soundCues({ ...plan, scenes: [agents] }, { version: "5.14" });

  assert.equal(workTimes(html).length, 2);
  for (const [, at] of workTimes(html)) assert.ok(cues.some((c) => c.kind === "pop" && Math.abs(c.t - (at + 1.2)) < 0.01), `no pop at ${at + 1.2}`);
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

test("the hook plays whole, even past a shorter intro, the bed under the scenes and the outro, the ending closes the video", () => {
  const sections = musicSections(rms);
  const [head, body, tail] = musicSegments(sections, { total: 30 });

  assert.deepEqual(head, { part: "head", from: 0.5, length: 5.5, at: 0 });
  assert.equal(body.part, "body");
  assert.equal(body.at, 5.5);
  assert.equal(body.length, 30 - 4 - 5.5);
  assert.deepEqual(tail, { part: "tail", from: 35.5, length: 4, at: 26 });
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
  assert.equal(cuesOf("pop", totalDuration(plan) - 4, totalDuration(plan)).length, 4, "logo, title and two items");
});

test("the sound track is a wav as long as the video, loud on a cue and silent between", () => {
  const wav = soundTrack(plan, { version: "5.13" });
  const rate = wav.readUInt32LE(24);
  const sample = (seconds) => Math.abs(wav.readInt16LE(44 + 2 * Math.floor(seconds * rate)));
  const peakNear = (seconds) => Math.max(...Array.from({ length: 400 }, (_, i) => sample(seconds + i / rate)));

  assert.equal(wav.toString("latin1", 0, 4), "RIFF");
  assert.equal(wav.length, 44 + 2 * Math.round(totalDuration(plan) * rate));
  assert.ok(peakNear(5 + 1.3) > 1000, "silent on a click");
  assert.equal(peakNear(4.5), 0, "noise between cues");
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

test("the intro tags are drawn large enough to be read first", () => {
  const html = buildHtml(plan, { version: "5.13" });
  const size = Number(html.match(/\.hl \{[^}]*font-size: (\d+)px/)?.[1]);

  assert.ok(size >= 40, `tags at ${size}px`);
});

const beforeAfter = {
  template: "before-after",
  pill: "Brainstorm",
  title: "Brainstorm, lean",
  figures: [
    { from: "13", to: "8", label: "files" },
    { from: "4", to: "3", label: "steps" },
  ],
  before: { label: "Before", rows: [{ del: "probe" }, { del: "integrate" }] },
  after: { label: "After", rows: [{ add: "explore" }] },
};

test("a before-after scene puts its figures above the old and the new side by side", () => {
  const html = buildHtml({ scenes: [beforeAfter], skipped: [] }, { version: "5.13" });

  assert.ok(html.indexOf('class="fig it"') < html.indexOf('class="split diff"'), "figures come after the cards");
  assert.match(html, /<span class="from">13<\/span>[^]*<span class="to">8<\/span>[^]*files/);
  assert.ok(html.indexOf("Before") < html.indexOf("After"), "the new comes first");
  assert.match(html, /<div class="row del">- probe<\/div>/);
  assert.match(html, /<div class="row add">\+ explore<\/div>/);
});

test("a before-after scene lasts for its figures and the lines of both cards", () => {
  const bare = { ...beforeAfter, figures: [], before: { label: "Before", rows: [] }, after: { label: "After", rows: [] } };

  assert.ok(sceneDuration(beforeAfter) > sceneDuration(bare));
});

test("no pop is cued for a phrase the intro does not draw", () => {
  const withTags = { ...plan, intro: { highlights: ["a", "b"] } };
  const pops = soundCues(withTags, { version: "5.13" }).filter((c) => c.kind === "pop" && c.t < 4).map((c) => c.t);

  assert.deepEqual(pops, [0.1, 2, 2.3]);
});

const full = {
  scenes: [{ template: "terminal-demo", pill: "p", title: "t", lead: "l", window: window([{ prompt: "a" }, { text: "b" }]), note: "n" }],
  skipped: [],
};
const inRange = (p, from, to) => soundCues(p, { version: "5.13" }).filter((c) => c.t >= from && c.t < to);

test("everything that appears in a scene has a sound at its own time", () => {
  assert.deepEqual(inRange(full, 5, 8), [
    { kind: "whoosh", t: 5 },
    { kind: "tick", t: 5.14 },
    { kind: "pop", t: 5.28 },
    { kind: "tick", t: 5.5 },
    { kind: "pop", t: 5.63 },
    { kind: "click", t: 6.3 },
    { kind: "click", t: 6.75 },
    { kind: "pop", t: 7.5 },
  ]);
});

test("a scene without a lead or a note has no sound for them", () => {
  const bare = { scenes: [{ ...full.scenes[0], lead: undefined, note: undefined }], skipped: [] };

  assert.deepEqual(inRange(bare, 5, 8).map((c) => c.t), [5, 5.14, 5.28, 5.63, 6.3, 6.75]);
});

test("the intro pill and release label, the outro logo and title each have a sound", () => {
  const end = totalDuration(full) - 4;

  assert.deepEqual(inRange(full, 0.3, 0.7).map((c) => [c.kind, c.t]), [["tick", 0.4], ["tick", 0.55]]);
  assert.deepEqual(inRange(full, end, end + 0.5).map((c) => [c.kind, c.t]), [["pop", end + 0.07], ["pop", end + 0.28]]);
});

test("the sounds are smooth, not the 5-bit steps of a chip tune", () => {
  const wav = soundTrack(full, { version: "5.13" });
  const levels = new Set();
  for (let i = 44; i < wav.length; i += 2) levels.add(wav.readInt16LE(i));

  assert.ok(levels.size > 500, `only ${levels.size} sample values`);
});

test("a hook only a few dB above the bed is still found", () => {
  const close = [-30, ...Array(13).fill(-21), ...Array(32).fill(-25.5), ...Array(8).fill(-24), -61];

  assert.deepEqual(musicSections(close), { headStart: 0.5, headEnd: 7, tailStart: 23, tailEnd: 27 });
});

const kit = require("node:path").join(__dirname, "../../.claude/skills/release-video/assets/music.mp3");
const hasFfmpeg = require("node:child_process").spawnSync("ffmpeg", ["-version"]).status === 0;

test("the shipped track has a hook as long as the intro with tags, a bed of whole bars and a 4 s ending", { skip: !hasFfmpeg }, () => {
  const sections = musicSections(measureRms(kit));

  assert.ok(sections, "no hook found");
  assert.equal(sections.headEnd, 6.5);
  assert.equal(sections.tailEnd - sections.tailStart, 4);
  assert.equal((sections.tailStart - sections.headEnd) % 2, 0, "the bed is not a whole number of bars");
});

const retry = {
  ...agents,
  flow: [
    { n: "1", title: "explorer", sub: "maps the code", icon: "search", log: ["src/"] },
    { n: "2", title: "executor", sub: "builds", icon: "build", runs: [{ log: ["+ login.tsx"] }, { log: ["+ error message"] }] },
    { n: "3", title: "validator", sub: "checks", icon: "check", runs: [{ log: ["✗ no error shown"], fail: true }, { log: ["✓ goal met"] }] },
  ],
};

test("a failed check sends the work back to the step before it, then checks again", () => {
  const html = buildHtml({ ...plan, scenes: [retry] }, { version: "5.14" });
  const times = workTimes(html);

  assert.deepEqual(times.map(([w]) => w), [0, 1, 2, 1, 2]);
  assert.ok(times.every(([, at], i) => i === 0 || at > times[i - 1][1]), "the runs overlap");
  assert.match(html, /work\("#s1", 2, [\d.]+, [\d.]+, 0, true\);/);
  assert.match(html, /work\("#s1", 1, [\d.]+, [\d.]+, 1, false\);/);
});

test("a step sent back says so and where the work goes, then shows its next run", () => {
  const html = buildHtml({ ...plan, scenes: [retry] }, { version: "5.14" });

  assert.match(html, /data-w="2">.*?<span class="wfail pnk">✗ sent back<\/span>/);
  assert.match(html, /<span class="wrun" data-run="0"><span class="wl">✗ no error shown<\/span><span class="wl pnk">↩ back to executor<\/span><\/span><span class="wrun" data-run="1"><span class="wl">✓ goal met<\/span><\/span>/);
  assert.match(html, /fail \? "#ff8fa8" : "#5ee6a8"/);
});

test("a scene lasts long enough for every run, its retries included", () => {
  const straight = { ...retry, flow: retry.flow.map(({ runs, ...step }) => ({ ...step, log: (runs ?? [{ log: step.log }])[0].log })) };

  assert.ok(sceneDuration(retry) >= sceneDuration(straight) + 2 * 1.6 - 0.5);
});

test("a check with no run left to retry fails the render", () => {
  const short = { ...retry, flow: [retry.flow[0], { ...retry.flow[1], runs: [{ log: ["+ a"] }] }, retry.flow[2]] };

  assert.throws(() => buildHtml({ ...plan, scenes: [short] }, { version: "5.14" }), /executor has no run left/);
});

const install = (together) => ({
  template: "terminal-demo",
  pill: "Install",
  title: "Setup",
  surfaces: [],
  window: window([{ table: { head: ["Tool", "Installed"], together, rows: Array.from({ length: 6 }, (_, i) => [`t${i}`, { checking: "ok" }]) } }]),
});

test("rows installed together start at once, and their time counts once", () => {
  const html = buildHtml({ ...plan, scenes: [install(true)] }, { version: "5.14" });
  const starts = new Set(workTimes(html).map(([, at]) => at));

  assert.equal(workTimes(html).length, 6);
  assert.equal(starts.size, 1);
  assert.ok(sceneDuration(install(true)) <= sceneDuration(install(false)) - 2);
});

test("rows installed together tick once and end at once, with one pop", () => {
  const html = buildHtml({ ...plan, scenes: [install(true)] }, { version: "5.14" });
  const cues = soundCues({ ...plan, scenes: [install(true)] }, { version: "5.14" });
  const [[, at]] = workTimes(html);
  const ends = [...html.matchAll(/work\("#s1", \d+, ([\d.]+), ([\d.]+)/g)].map((m) => Math.round((Number(m[1]) + Number(m[2])) * 100) / 100);

  assert.equal(cues.filter((c) => c.kind === "tick" && Math.abs(c.t - at) < 0.01).length, 1);
  assert.equal(new Set(ends).size, 1, "a row ends on its own");
  assert.equal(cues.filter((c) => c.kind === "pop" && Math.abs(c.t - ends[0]) < 0.01).length, 1);
});

const follow = {
  template: "two-panels",
  pill: "Antigravity",
  title: "Setup",
  surfaces: [],
  panels: [
    { label: "Terminal", rows: [{ table: { head: ["Path", "Holds"], rows: [["a", { checking: "ok" }], ["b", { checking: "ok" }]] } }] },
    { label: "Antigravity CLI", afterWork: true, rows: [{ prompt: "plan" }, { text: "Plan written" }] },
  ],
};

test("a panel that follows the work opens once that work is done, with its rows", () => {
  const html = buildHtml({ ...plan, scenes: [follow] }, { version: "5.14" });
  const cues = soundCues({ ...plan, scenes: [follow] }, { version: "5.14" });
  const end = Math.max(...[...html.matchAll(/work\("#s1", \d+, ([\d.]+), ([\d.]+)/g)].map((m) => Number(m[1]) + Number(m[2])));
  const opens = Number(html.match(/enter\("#s1 \.then", ([\d.]+)/)[1]);
  const rowsAt = Number(html.match(/enter\("#s1 \.then \.row", ([\d.]+)/)[1]);

  assert.match(html, /<div class="win then"><div class="bar">.*?Antigravity CLI/);
  assert.match(html, /enter\("#s1 \.win:not\(\.then\) \.row:not\(\.later\)", /);
  assert.ok(opens >= end, "the panel opens before the work is done");
  assert.ok(rowsAt > opens);
  assert.equal(cues.filter((c) => c.kind === "click" && c.t >= rowsAt - 0.01).length, 2);
  assert.ok(5 + sceneDuration(follow) >= rowsAt + 0.45 + 1.5, "the scene cuts before its last row is read");
});

test("a step that works again shows done once more, not only the first time", () => {
  const html = buildHtml({ ...plan, scenes: [retry] }, { version: "5.14" });

  assert.match(html, /\.wres \{ opacity: 0; \}/);
  assert.match(html, /if \(run > 0\) \{[^\n]*\n(?:    [^\n]*\n)*?    if \(all\(unit \+ " \.wres"\)\) tl\.to\(unit \+ " \.wres", \{ opacity: 0/);
  assert.match(html, /tl\.fromTo\(unit \+ " \.wres", \{ opacity: 0, y: 10 \}, \{ opacity: 1, y: 0, duration: 0\.3, ease, immediateRender: false \}, at \+ fill\)/);
});

const shownBy = (s) => {
  const html = buildHtml({ ...plan, scenes: [s] }, { version: "5.14" });
  return { html, cues: soundCues({ ...plan, scenes: [s] }, { version: "5.14" }) };
};

test("a scene ends a short beat after its last row, however many lines its table holds", () => {
  const table = (n) => ({ template: "terminal-demo", window: window([{ table: { head: ["a"], rows: Array.from({ length: n }, (_, i) => [`r${i}`]) } }]) });

  assert.equal(sceneDuration(table(6)), sceneDuration(table(1)));
  assert.equal(sceneDuration(table(1)), Math.ceil((1.3 + 0.5 + 2.5) * 2) / 2);
});

const verdict = {
  template: "terminal-demo",
  pill: "Quality",
  title: "Assert",
  surfaces: [],
  window: window([
    { prompt: "/aidd-dev:03-assert" },
    { table: { head: ["Check", "Result"], rows: [["pnpm lint", { checking: "pass" }], ["pnpm test", { checking: "fail" }]] } },
    { verdict: "FAIL", tone: "pnk", detail: "code untouched", afterWork: true },
  ]),
};

test("a verdict is drawn as a badge in its tone, with its detail beside it", () => {
  const { html } = shownBy(verdict);

  assert.match(html, /<div class="row verdict pnk later"><b>FAIL<\/b><span>code untouched<\/span><\/div>/);
});

test("a row that follows the work appears once the work is done, with its click", () => {
  const { html, cues } = shownBy(verdict);
  const end = Math.max(...[...html.matchAll(/work\("#s1", \d+, ([\d.]+), ([\d.]+)/g)].map((m) => Number(m[1]) + Number(m[2])));
  const at = Number(html.match(/enter\("#s1 \.row\.later", ([\d.]+)/)[1]);

  assert.match(html, /enter\("#s1 \.win:not\(\.then\) \.row:not\(\.later\)", /);
  assert.ok(at >= end, "the verdict shows before the checks are done");
  assert.ok(cues.some((c) => c.kind === "click" && Math.abs(c.t - at) < 0.01), "no click for the verdict");
  assert.ok(5 + sceneDuration(verdict) >= at + 2.5, "the scene cuts before the verdict is read");
});

test("a table may have no head", () => {
  const { html } = shownBy({ template: "terminal-demo", window: window([{ table: { rows: [["testing.md", { checking: "written" }]] } }]) });

  assert.match(html, /<table class="row"><tbody><tr data-w="0">/);
});

test("the arrow into a step that sends work back turns around while the work goes back", () => {
  const { html } = shownBy(retry);

  assert.match(html, /<span class="arrow it"><span class="fwd">→<\/span><span class="bk pnk">←<\/span><\/span><div class="step it" data-w="2">/);
  assert.match(html, /<span class="arrow it">→<\/span><div class="step it" data-w="1">/);
  assert.match(html, /if \(fail && back\) \{\n\s+tl\.to\(back\.querySelector\("\.fwd"\), \{ opacity: 0[^\n]*at \+ fill\);\n\s+tl\.to\(back\.querySelector\("\.bk"\), \{ opacity: 1/);
  assert.match(html, /if \(run > 0\) \{[^]*?if \(back\) tl\.to\(back\.querySelector\("\.bk"\), \{ opacity: 0[^\n]*\n[^\n]*\.fwd"\), \{ opacity: 1/);
});
