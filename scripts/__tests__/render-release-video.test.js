const assert = require("node:assert/strict");
const test = require("node:test");

const { buildHtml, musicSegments, musicSections, sceneDuration, soundCues, posterArgs, soundTrack, thumbnailHtml, totalDuration } = require("../../.claude/skills/release-video/assets/render-release-video.cjs");

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

test("the thumbnail is its own still composition showing the whole version and the themes", () => {
  const html = thumbnailHtml({ ...plan, youtube: { themes: ["Télémétrie", "Plan"], programme: [] } }, { version: "5.13" });

  assert.ok(html.includes("Télémétrie · Plan") && html.includes(">13<"));
  assert.match(html, /data-duration="1"/);
});

test("a product scene ends 2 seconds after its last beat, a little faster than a terminal scene", () => {
  const { html } = shownBy(gate);
  const last = Math.max(...beatsOf(html).map((x) => x.at)) - 5;

  assert.equal(sceneDuration(gate), Math.ceil((last + 2) * 2) / 2);
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

test("a scene's note appears after its last row, not with its window", () => {
  const html = buildHtml(plan, { version: "5.13" });
  const noteAt = Number(/enter\("#s1 \.fin", ([\d.]+)/.exec(html)?.[1]);
  const lastRowAt = 5 + 1.3 + 0.45 * (plan.scenes[0].window.rows.length - 1);

  assert.match(html, /<p class="note fin">Example figures\.<\/p>/);
  assert.ok(noteAt > lastRowAt, `note at ${noteAt}, last row at ${lastRowAt}`);
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

test("a lead gives the scene time to be read", () => {
  const bare = plan.scenes[0];

  assert.ok(sceneDuration({ ...bare, lead: "Ask what a task cost." }) > sceneDuration(bare));
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

test("a row that follows the work appears once the work is done, with its click", () => {
  const { html, cues } = shownBy(verdict);
  const end = Math.max(...[...html.matchAll(/work\("#s1", \d+, ([\d.]+), ([\d.]+)/g)].map((m) => Number(m[1]) + Number(m[2])));
  const at = Number(html.match(/enter\("#s1 \.row\.later", ([\d.]+)/)[1]);

  assert.match(html, /enter\("#s1 \.win:not\(\.then\) \.row:not\(\.later\)", /);
  assert.ok(at >= end, "the verdict shows before the checks are done");
  assert.ok(cues.some((c) => c.kind === "click" && Math.abs(c.t - at) < 0.01), "no click for the verdict");
  assert.ok(5 + sceneDuration(verdict) >= at + 2.5, "the scene cuts before the verdict is read");
});


test("the opening second and a half is encoded at a high quality of its own, the rest at the video's bitrate", () => {
  const args = posterArgs({ video: "v.mp4", poster: "t.png", out: "o.mp4", bitrate: 866446 });

  assert.equal(args[args.indexOf("-x264-params") + 1], "zones=0,45,q=12");
});

test("the poster is converted with the video's own colour matrix, and the output says which", () => {
  const args = posterArgs({ video: "v.mp4", poster: "t.png", out: "o.mp4", bitrate: 866446 });
  const joined = args.join(" ");

  assert.match(joined, /\[0:v\]scale=1920:1080:out_color_matrix=bt709:out_range=tv,/);
  assert.match(joined, /-colorspace bt709 -color_primaries bt709 -color_trc bt709/);
});

const pr = {
  template: "github-pr",
  pill: "Review",
  title: "PR review:",
  accent: "every comment answered.",
  lead: "Settled threads close themselves.",
  surfaces: [],
  captions: ["Each comment answered", "Settled threads resolved", "Summary posted"],
  pr: {
    repo: "acme/acme-app",
    number: 128,
    title: "Add a dark mode toggle",
    author: "alice",
    branch: "feat/dark-mode",
    base: "next",
    checks: [{ name: "ci / test", state: "pass" }],
  },
  threads: [
    { file: "src/theme.ts", line: 12, author: "bob", comment: "Rename this?", reply: "Renamed. (3f9c2a1b7)", resolve: true },
    { file: "src/toggle.tsx", line: 30, author: "carol", comment: "Default to the system theme?", reply: "Should the default follow the system theme?" },
  ],
  summary: { kicker: "Your review, summed up by AI", title: "Review comments", lines: ["Done: 1 (3f9c2a1b7). Answered: 0. Decided: 0."] },
};

const ide = {
  template: "ide-window",
  pill: "Tools",
  title: "Checks that run",
  accent: "on their own.",
  surfaces: [],
  ide: {
    label: "Claude Code · ~/acme-app",
    files: [
      { path: "CLAUDE.md", lines: ["# CLAUDE.md"] },
      { path: "aidd_docs/tasks/dark-mode/plan.md", lines: ["# Plan: Dark mode toggle"] },
    ],
  },
  steps: [
    { caption: "Memory loaded", notice: { label: "SessionStart", text: "AIDD Context: refresh project memory", tone: "dim" }, open: "CLAUDE.md" },
    { caption: "Broken plan fixed", user: "plan the dark mode toggle" },
    { agent: "Plan written.", open: "aidd_docs/tasks/dark-mode/plan.md", file: "aidd_docs/tasks/dark-mode/plan.md", state: "red" },
    { add: ["## Impact"], file: "aidd_docs/tasks/dark-mode/plan.md", state: "green" },
  ],
};

const grid = {
  template: "tool-grid",
  pill: "Tools",
  title: "One install,",
  accent: "every tool.",
  surfaces: [],
  captions: ["Skills loaded in each tool"],
  tools: [
    { name: "Claude Code", dir: ".claude/", count: "48 skills" },
    { name: "Codex", dir: ".codex/", count: "48 skills" },
    { name: "Cursor", dir: ".cursor/", count: "48 skills" },
  ],
};

const blocks = {
  template: "architecture-blocks",
  pill: "Context",
  title: "Everything around",
  accent: "one core.",
  surfaces: [],
  captions: ["Contexts in place", "Every test green"],
  core: "AIDD",
  blocks: [{ label: "Memory", detail: "aidd_docs/memory" }, { label: "Rules" }, { label: "Skills" }, { label: "Agents" }],
  counter: { to: 48, label: "skills" },
};

const BEAT = /b\(([\d.]+), "(\w+)", "([^"]+)"(?:, (.*))?\);/g;
const beatsOf = (html) => [...html.matchAll(BEAT)].map((m) => ({ at: Number(m[1]), act: m[2], sel: m[3], value: m[4] }));

const panels = {
  template: "panel-sequence",
  pill: "CLI",
  title: "CLI refactored",
  surfaces: [],
  captions: ["Clean layers.", "10 bounded contexts.", "Each test level proves one thing."],
  panels: [
    { kind: "layers", items: [{ label: "presentation", detail: "commands and output" }, { label: "contexts", detail: "the business" }, { label: "shared", detail: "pure types" }] },
    { kind: "grid", items: [{ label: "installation" }, { label: "tools" }, { label: "translate" }] },
    { kind: "levels", items: [{ label: "unit", detail: "a rule, no disk" }, { label: "e2e", detail: "the built binary" }] },
  ],
};

const logos = {
  template: "logo-row",
  pill: "Tools",
  title: "Now in 9 AI tools.",
  surfaces: [],
  captions: ["Kiro and Kimi join."],
  tools: [{ name: "Claude Code", logo: "claudecode-color" }, { name: "Cursor", logo: "cursor" }, { name: "Kiro", logo: "kiro-color", new: true }, { name: "Kimi", logo: "kimi", new: true }],
};

const gate = {
  template: "gate",
  pill: "Hooks",
  title: "Your AI checks itself as it works.",
  surfaces: [],
  captions: ["Blocked before a bad write.", "Told what it missed.", "Sent back until it is right."],
  actor: "AI",
  gate: "Hook",
  target: "Your project",
  files: ["spec.md", "button.css", "plan.md"],
  outcomes: [
    { kind: "block", label: "Blocked", action: "Edit spec.md", file: "spec.md", detail: "spec.md is locked" },
    { kind: "inform", label: "Noted", action: "Write button.css", file: "button.css", detail: "Memory refreshed", note: "Memory" },
    { kind: "require", label: "Fix required", action: "Write plan.md", file: "plan.md", detail: "Section Impact missing", fixed: "plan.md ✓" },
  ],
};

const models = {
  template: "model-switch",
  pill: "Models",
  title: "Pick your agents' models.",
  surfaces: [],
  captions: ["On Mistral.", "On OpenAI."],
  terminal: "Terminal · ~/acme-app",
  cards: [
    { role: "reviewer", faces: [{ model: "claude-opus-5-5", logo: "anthropic" }, { model: "mistral-large-4", logo: "mistral-color" }, { model: "gpt-6.1-sol", logo: "openai" }] },
    { role: "executor", faces: [{ model: "claude-haiku-5-5", logo: "anthropic" }, { model: "mistral-small-latest", logo: "mistral-color" }, { model: "gpt-6-luna", logo: "openai" }] },
  ],
  runs: [
    { command: "aidd setup --provider mistral", flip: true, lines: [{ text: "Models on mistral:" }, { text: "  opencode reviewer: mistral/mistral-large-4 (high)" }] },
    { command: "aidd setup --provider openai", flip: true, lines: [{ text: "Models on openai:" }, { text: "  opencode reviewer: openai/gpt-6.1-sol (high)" }] },
  ],
};

const lock = {
  template: "doc-lock",
  pill: "Spec",
  title: "Approved specs stay as approved.",
  surfaces: [],
  captions: ["A short spec.", "Approved, it locks.", "The AI's edit is refused."],
  file: "spec.md",
  status: ["status: draft", "status: locked"],
  sections: [{ heading: "Target", text: "Dark mode stays on reload." }, { heading: "Done-when", text: "The toggle survives a reload." }],
  attempt: { action: "Edit spec.md", refusal: "spec.md is locked: only the person who approves it sets its status back to draft. Write nothing to it." },
};

const challenge = {
  template: "challenge-report",
  pill: "Challenge",
  title: "Every spec challenged, with proof.",
  badge: "Rebuilt lean",
  surfaces: [],
  captions: ["The spec, line by line.", "Each finding, with its proof."],
  spec: {
    file: "spec.md",
    lines: [
      { text: "## Target" },
      { text: "The theme stays after a reload.", finding: { tone: "red", label: "Deal breaker", text: "Breaks when storage is blocked", evidence: "theme.ts:14" } },
      { text: "No flash of the wrong theme.", finding: { tone: "grn", label: "Holds", text: "Survives a reload" } },
    ],
  },
};

const chain = {
  template: "chain-cards",
  pill: "AIDD UI · Beta",
  title: "From brand to reviewed screens.",
  surfaces: [],
  captions: ["Each step builds on the last.", "Reviewed, then published."],
  steps: [
    { label: "Journeys", skill: "aidd-ui:01-journeys", keywords: ["persona", "steps", "wireframe"], visual: "wireframe" },
    { label: "Review", skill: "aidd-ui:06-review", keywords: ["OK / Revise", "publish"], visual: "verdict", caption: 1 },
  ],
};

const scan = {
  template: "scan-questions",
  pill: "Shadow areas",
  title: "Find what your story leaves unclear.",
  surfaces: [],
  captions: ["Unclear meaning, highlighted.", "Each becomes a plain question.", "Answered, the story is clear."],
  file: "story.md",
  story: [["As a visitor I ", { text: "quickly", fixed: "within 1 s", gap: 1 }, " switch theme."], ["Saved for ", { text: "a while", fixed: "a year", gap: 0 }, "."]],
  gaps: [{ category: "missing edge case", question: "How long is a while?", quote: "a while" }, { category: "ambiguous term", question: "How fast is quickly?", quote: "quickly" }],
  status: ["2 open questions", "Clear ✓"],
};

const wave = { template: "contributor-wave", pill: "Thanks", title: "Thank you.", surfaces: [], logins: ["alice", "bob", "carol"] };

const surfaces = [pr, ide, grid, blocks, panels, logos, gate, models, lock, challenge, scan, chain, wave];

for (const s of surfaces) {
  test(`every beat of a ${s.template} scene has a sound at its own time, and the scene holds for reading after the last`, () => {
    const { html, cues } = shownBy(s);
    const beats = beatsOf(html);
    const head = [5, 5.14, 5.28, 5.5];
    const sounded = cues.filter((c) => c.t >= 5 && c.t < 5 + sceneDuration(s) && !head.includes(c.t)).map((c) => c.t);

    assert.ok(beats.length > 2, "no beat");
    assert.deepEqual([...new Set(sounded)], [...new Set(beats.map((x) => x.at))]);
    assert.equal(sceneDuration(s), Math.ceil((Math.max(...beats.map((x) => x.at)) - 5 + 2 + (s.lead ? 0.5 : 0)) * 2) / 2);
  });

  test(`nothing on a ${s.template} scene moves or leaves the layout: elements fade or scale in place`, () => {
    const { html } = shownBy(s);

    assert.ok(!html.includes("data-show"), "an element is out of the layout until it appears");
    assert.ok(beatsOf(html).every((x) => ["in", "set", "fill", "count", "focus", "cap", "from", "to", "fromto", "type", "flip", "pulse", "shake"].includes(x.act)), "an unknown beat");
    assert.match(html, /if \(act === "in"\) return tl\.fromTo\(sel, \{ opacity: 0, scale: 0\.96 \}, \{ opacity: 1, scale: 1,/);
    assert.ok(!/rotate[XY]\(|skew/.test(html.match(/<style>([\s\S]*?)<\/style>/)[1]), "a tilted or skewed panel");
  });
}

test("a product scene keeps one fixed title, and says each beat's outcome in a light subtitle", () => {
  const { html } = shownBy(pr);
  const caps = beatsOf(html).filter((x) => x.act === "cap");

  assert.match(html, /<div class="band"><div class="band-top"><span class="pill"[^>]*>Review<\/span><h2 id="s1-h">PR review: <span class="g">every comment answered\.<\/span><\/h2><\/div><div class="sub-slot"><span class="cap" data-cap="0">Each comment answered<\/span>/);
  assert.deepEqual(caps.map((x) => x.value), ["0", "1", "2"]);
  assert.ok(caps.every((x, i) => i === 0 || x.at > caps[i - 1].at));
});

test("a scene with more than three captions fails the render", () => {
  const bad = { ...pr, captions: ["a", "b", "c", "d"] };

  assert.throws(() => buildHtml({ scenes: [bad], skipped: [] }, { version: "5.15" }), /github-pr: 4 captions, 3 at most/);
});

test("a pull request page shows its header, branches and checks", () => {
  const { html } = shownBy(pr);

  assert.match(html, /Add a dark mode toggle <span class="gh-num">#128<\/span>/);
  assert.match(html, /into <code>next<\/code> from <code>feat\/dark-mode<\/code>/);
  assert.match(html, /<span class="gh-check" data-s="pass">ci \/ test<\/span>/);
});

test("each review comment gets its answer in turn, then the settled threads resolve in place, then the summary is posted", () => {
  const beats = beatsOf(shownBy(pr).html);
  const replies = beats.filter((x) => x.act === "in" && x.sel.includes("data-reply")).map((x) => x.at);
  const resolves = beats.filter((x) => x.act === "set" && x.value === '"resolved"');
  const [summary] = beats.filter((x) => x.act === "in" && x.sel.includes("gh-hero"));

  assert.equal(replies.length, 2);
  assert.ok(replies[1] > replies[0], "the answers come together");
  assert.deepEqual(resolves.map((x) => x.sel), ["#s1 [data-thread='0']"]);
  assert.ok(resolves.every((x) => x.at > replies.at(-1)), "a thread resolves before every answer is posted");
  assert.ok(summary.at > resolves.at(-1).at);
});

test("a pull request page holds six threads at most, so they stay readable", () => {
  const bad = { ...pr, threads: [pr.threads, pr.threads, pr.threads, pr.threads[0]].flat() };

  assert.throws(() => buildHtml({ scenes: [bad], skipped: [] }, { version: "5.15" }), /github-pr: 7 threads, 6 at most/);
});

test("each answer carries the kind the skill gave it, and the summary lists its learnings as bullets", () => {
  const kinds = { ...pr, threads: [{ ...pr.threads[0], kind: "done" }, { ...pr.threads[1], kind: "user-call" }], summary: { ...pr.summary, sections: [{ heading: "Learnings", items: ["Read colors from the tokens"], list: "bullets" }] } };
  const { html } = shownBy(kinds);

  assert.match(html, /data-reply="0"[^>]*>.*?<span class="gh-kind" data-kind="done">done<\/span>/);
  assert.match(html, /<span class="gh-kind" data-kind="user-call">user-call<\/span>/);
  assert.match(html, /<h5>Learnings<\/h5><ul><li>Read colors from the tokens <span class="gh-link">\(thread\)<\/span><\/li><\/ul>/);
});

test("a review thread with no answer fails the render", () => {
  const bad = { ...pr, threads: [{ ...pr.threads[0], reply: undefined }] };

  assert.throws(() => buildHtml({ scenes: [bad], skipped: [] }, { version: "5.15" }), /github-pr thread 1 has no reply/);
});

test("a pull request page may show the command that works on it", () => {
  const { html } = shownBy({ ...pr, prompt: "/aidd-vcs:06-answer-comments 128" });

  assert.match(html, /<span class="gh-run">&gt; \/aidd-vcs:06-answer-comments 128<\/span>/);
});

test("an IDE window shows its file tree, and a step turns a file red, then green", () => {
  const { html } = shownBy(ide);
  const marks = beatsOf(html).filter((x) => x.act === "set" && x.sel.includes("data-file"));

  assert.match(html, /<li class="ide-file" data-file="1"[^>]*>.*?plan\.md<\/li>/);
  assert.deepEqual(marks.map((x) => x.value), ['"red"', '"green"']);
  assert.ok(marks[1].at > marks[0].at);
});

test("an IDE step shows its notice, its messages and the lines it adds in place in the open file", () => {
  const { html } = shownBy(ide);

  assert.match(html, /class="ide-notice dim"[^>]*><b>SessionStart<\/b><span>AIDD Context: refresh project memory<\/span>/);
  assert.match(html, /class="ide-msg user"[^>]*>plan the dark mode toggle</);
  assert.match(html, /<div class="ide-code" data-pane="1"[^>]*>.*?<span class="ide-line add" data-step="3"[^>]*>## Impact<\/span>/);
});

test("an IDE step with a caption starts a new beat", () => {
  const caps = beatsOf(shownBy(ide).html).filter((x) => x.act === "cap");

  assert.deepEqual(caps.map((x) => x.value), ["0", "1"]);
});

test("an IDE step that marks a file with an unknown state fails the render", () => {
  const bad = { ...ide, steps: [{ file: "CLAUDE.md", state: "blue" }] };

  assert.throws(() => buildHtml({ scenes: [bad], skipped: [] }, { version: "5.15" }), /ide-window step 1: state "blue", one of red, green/);
});

test("a tool grid draws one window per tool, and each lights up in turn", () => {
  const { html } = shownBy(grid);
  const lights = beatsOf(html).filter((x) => x.act === "set" && x.value === '"on"');

  assert.equal((html.match(/class="tg-win"/g) ?? []).length, 3);
  assert.match(html, /Claude Code<\/b><small>\.claude\/<\/small>/);
  assert.deepEqual(lights.map((x) => x.sel), ["#s1 [data-tool='0']", "#s1 [data-tool='1']", "#s1 [data-tool='2']"]);
  assert.ok(lights.every((x, i) => i === 0 || x.at > lights[i - 1].at));
});

test("context blocks gather around their core, then the counter counts up to its value", () => {
  const beats = beatsOf(shownBy(blocks).html);
  const placed = beats.filter((x) => x.sel.includes("data-block"));
  const [count] = beats.filter((x) => x.act === "count");

  assert.equal(placed.length, 4);
  assert.equal(count.value, "48");
  assert.ok(count.at > Math.max(...placed.map((x) => x.at)));
});

test("a new scene escapes its text", () => {
  const evil = { ...pr, threads: [{ ...pr.threads[0], comment: "<b>x</b>" }] };

  assert.ok(!buildHtml({ scenes: [evil], skipped: [] }, { version: "5.15" }).includes("<b>x</b>"));
});


const at = (beats, act, part) => beats.filter((x) => x.act === act && x.sel.includes(part));

test("answers land rapid-fire, the settled threads close together with nothing dimmed, and the summary comes forward as the payoff", () => {
  const six = { ...pr, threads: [pr.threads, pr.threads, pr.threads].flat() };
  const { html } = shownBy(six);
  const beats = beatsOf(html);
  const replies = at(beats, "in", "data-reply").map((x) => x.at);
  const resolves = beats.filter((x) => x.act === "set" && x.value === '"resolved"').map((x) => x.at);
  const [hero] = at(beats, "in", ".gh-hero");

  assert.ok(replies.every((t, i) => i === 0 || t - replies[i - 1] <= 0.45), "the answers drag");
  assert.ok(!beats.some((x) => x.act === "focus"), "the page is dimmed");
  assert.match(html, /<div class="gh-hero"><span class="gh-hero-k">Your review, summed up by AI<\/span>/);
  assert.equal(new Set(resolves).size, 1, "the settled threads close one by one");
  assert.ok(hero.at > resolves[0]);
  assert.match(html, /<div class="gh-hero">.*?<h4>Review comments<\/h4>/);
});

test("each panel of a sequence comes with its subtitle, shows its items in turn, and leaves when the next comes", () => {
  const beats = beatsOf(shownBy(panels).html);
  const shown = at(beats, "in", "data-panel=").map((x) => x.at);
  const left = at(beats, "to", "data-panel=").map((x) => x.at);
  const caps = beats.filter((x) => x.act === "cap").map((x) => x.at);
  const items = at(beats, "in", "data-item='1-");

  assert.deepEqual(shown, caps);
  assert.deepEqual(left, shown.slice(1));
  assert.ok(items.length === 3 && items.every((x, i) => x.at >= shown[1] && x.at < shown[2] && (i === 0 || x.at > items[i - 1].at)));
});

test("panels laid side by side show together and stay, each under its label", () => {
  const row = { ...panels, layout: "row", captions: [], hold: 6, panels: panels.panels.map((p, i) => ({ ...p, label: `Block ${i + 1}` })) };
  const { html } = shownBy(row);
  const beats = beatsOf(html);

  assert.match(html, /<div class="stage ps row">/);
  assert.match(html, /<div class="ps-panel layers" data-panel="0"><h4>Block 1<\/h4>/);
  assert.equal(at(beats, "to", "data-panel=").length, 0, "a panel leaves");
  assert.ok(Math.max(...at(beats, "in", "data-panel=").map((x) => x.at)) < 5 + 2);
  assert.ok(sceneDuration(row) >= sceneDuration({ ...row, hold: 0 }) + 6);
});

test("a badge sits beside the fixed title, and the pill lines up with it", () => {
  const { html } = shownBy(challenge);

  assert.match(html, /<h2 id="s1-h">Every spec challenged, with proof\.<\/h2><span class="badge">Rebuilt lean<\/span><\/div>/);
  assert.match(html, /\.band-top \.pill \{ align-self: center; flex: none; white-space: nowrap; \}/);
});

test("each beat leaves its subtitle on screen long enough to read", () => {
  for (const s of [pr, gate]) {
    const caps = beatsOf(shownBy(s).html).filter((x) => x.act === "cap").map((x) => x.at);
    caps.slice(1).forEach((t, i) => assert.ok(t - caps[i] >= 2.4, `${s.template}: ${t - caps[i]} s between subtitles`));
  }
});

test("a panel of an unknown kind fails the render", () => {
  const bad = { ...panels, panels: [{ kind: "pie", items: [] }] };

  assert.throws(() => buildHtml({ scenes: [bad], skipped: [] }, { version: "5.15" }), /panel-sequence panel 1: kind "pie", one of layers, grid, levels/);
});

test("new tools come in from the right one after another and snap onto the end of the row with a glow", () => {
  const { html } = shownBy(logos);
  const beats = beatsOf(html);
  const arrivals = at(beats, "fromto", "data-tool").filter((x) => JSON.parse(x.value).from.x >= 800);
  const glows = at(beats, "from", "data-burst");

  assert.deepEqual(arrivals.map((x) => x.sel), ["#s1 [data-tool='2']", "#s1 [data-tool='3']"]);
  assert.ok(arrivals[1].at > arrivals[0].at, "the new tools arrive together");
  assert.ok(glows.length === 2 && glows.every((g, i) => g.at > arrivals[i].at));
  assert.match(html, /<img class="lr-logo mono" src="assets\/logo-cursor\.svg"/);
  assert.match(html, /<img class="lr-logo" src="assets\/logo-kiro-color\.svg"/);
});

test("the checkpoint gives each outcome in turn, and the note leaves once its beat ends", () => {
  const beats = beatsOf(shownBy(gate).html);
  const verdicts = at(beats, "set", ".gt-gate").map((x) => x.value).filter((v) => v !== '"idle"');
  const resets = at(beats, "set", ".gt-gate").filter((x) => x.value === '"idle"').map((x) => x.at);
  const caps = beats.filter((x) => x.act === "cap").map((x) => x.at);

  assert.deepEqual(resets, caps.slice(1), "the checkpoint still shows the last verdict as the next beat starts");
  const [noteIn] = at(beats, "fromto", ".gt-note");
  const [noteOut] = at(beats, "to", ".gt-note");
  const [require] = beats.filter((x) => x.act === "cap" && x.value === "2");

  assert.deepEqual(verdicts, ['"block"', '"inform"', '"require"', '"pass"']);
  assert.ok(noteOut && noteOut.at > noteIn.at && noteOut.at <= require.at, "the note lingers into the next beat");
  assert.deepEqual(at(beats, "set", ".gt-actor").map((x) => x.value), ['"working"', '"fixed"']);
});

test("a gate outcome of an unknown kind fails the render", () => {
  const bad = { ...gate, outcomes: [{ kind: "warn", label: "Warn", action: "x" }] };

  assert.throws(() => buildHtml({ scenes: [bad], skipped: [] }, { version: "5.15" }), /gate outcome "warn", one of block, inform, require/);
});

test("each command is typed, its lines print, then every agent card flips together to its next model", () => {
  const beats = beatsOf(shownBy(models).html);
  const typed = at(beats, "type", "data-cmd").map((x) => x.at);
  const flips = at(beats, "flip", "data-card");
  const lines = at(beats, "in", "data-line='0-").map((x) => x.at);

  assert.equal(flips.length, 4);
  assert.deepEqual(beats.filter((x) => x.act === "cap").map((x) => x.at), [flips[0].at, flips[2].at], "a subtitle names a provider before the cards show it");
  assert.equal(new Set(flips.slice(0, 2).map((x) => x.at)).size, 1, "the cards of a run flip apart");
  assert.ok(flips[0].at > Math.max(...lines) && flips[2].at > typed[1]);
});

test("a run that flips a card past its last face fails the render", () => {
  const bad = { ...models, runs: [...models.runs, models.runs[0]] };

  assert.throws(() => buildHtml({ scenes: [bad], skipped: [] }, { version: "5.15" }), /model-switch card "reviewer" has no face 4/);
});

test("a short spec is written, its badge turns locked, then an edit is refused with the real message and nothing written", () => {
  const { html } = shownBy(lock);
  const beats = beatsOf(html);
  const sections = at(beats, "in", "data-section").map((x) => x.at);
  const [locked] = at(beats, "flip", ".dl-status");
  const bounced = at(beats, "to", ".dl-attempt");
  const [refusal] = at(beats, "in", ".dl-refusal");

  assert.ok(locked.at > Math.max(...sections));
  assert.ok(bounced.length === 2 && bounced[0].at > locked.at && refusal.at > bounced[0].at);
  assert.ok(!beats.some((x) => x.sel.includes("data-section") && x.at > locked.at), "the locked document changes");
  assert.ok(!html.includes("dl-lock"), "a padlock");
  assert.match(html, /<span class="dl-face" data-face="1">status: locked<\/span>/);
});

test("a scanner sweeps the spec, and each line it reaches lights and spawns its finding on the right, in its section colour", () => {
  const { html } = shownBy(challenge);
  const beats = beatsOf(html);
  const [sweep] = at(beats, "to", ".cr-beam");
  const lit = at(beats, "set", "data-line").filter((x) => x.value === '"lit"');
  const found = at(beats, "from", "data-finding");

  assert.ok(sweep && JSON.parse(sweep.value).yPercent === 100, "no sweep down the spec");
  assert.deepEqual(lit.map((x) => x.sel), ["#s1 [data-line='1']", "#s1 [data-line='2']"]);
  assert.deepEqual(found.map((x) => x.at), lit.map((x) => x.at), "a finding is not spawned by its line");
  assert.ok(lit[0].at > sweep.at && lit[1].at > lit[0].at);
  assert.match(html, /<div class="cr-row" data-line="1"[^>]*><p>The theme stays after a reload\.<\/p><div class="cr-finding red" data-finding="1"><b>Deal breaker<\/b><span>Breaks when storage is blocked<\/span><small>theme\.ts:14<\/small><\/div><\/div>/);
  assert.ok(!html.includes("cr-slide"), "a section slide");
  assert.ok(!/attack/i.test(html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ")), "the word attack on screen");
});

test("a design chain lights its stylised cards left to right, each with its skill, its keywords and an abstract visual", () => {
  const { html } = shownBy(chain);
  const beats = beatsOf(html);
  const lit = at(beats, "set", "data-card").filter((x) => x.value === '"on"').map((x) => x.at);

  assert.match(html, /<div class="ch-card" data-card="0" data-s="off"><code>aidd-ui:01-journeys<\/code><b>Journeys<\/b><div class="ch-vis wireframe">/);
  assert.match(html, /<ul class="ch-keys"><li>persona<\/li><li>steps<\/li><li>wireframe<\/li><\/ul>/);
  assert.ok(lit.length === 2 && lit[1] > lit[0]);
  assert.deepEqual(beats.filter((x) => x.act === "cap").map((x) => x.at), [beats.find((x) => x.act === "cap").at, lit[1]]);
  assert.ok(!/<img/.test(html.match(/<div class="stage ch"[\s\S]*?<\/section>/)[0]), "a screenshot in the chain");
});

test("a design card with an unknown visual fails the render", () => {
  const bad = { ...chain, steps: [{ ...chain.steps[0], visual: "photo" }] };

  assert.throws(() => buildHtml({ scenes: [bad], skipped: [] }, { version: "5.15" }), /chain-cards step 1: visual "photo", one of wireframe, direction, swatches, components, screens, verdict/);
});

test("an agent card can start empty, with no model and no logo, until a command fills it", () => {
  const empty = { ...models, cards: models.cards.map((c) => ({ ...c, faces: [{ model: "no model" }, ...c.faces.slice(1)] })) };
  const { html } = shownBy(empty);

  assert.match(html, /<div class="ms-face" data-face="0"><span class="ms-slot"><\/span><b>no model<\/b><\/div>/);
});

test("the story stays readable, its unclear phrases are highlighted, and each question sits on its phrase's line, in story order", () => {
  const { html } = shownBy(scan);
  const beats = beatsOf(html);
  const marked = at(beats, "fill", "data-mark").map((x) => x.at);
  const asked = at(beats, "from", "data-q");
  const closed = at(beats, "set", "data-q").filter((x) => x.value === '"closed"').map((x) => x.at);

  assert.ok(marked.length === 2 && marked[1] > marked[0]);
  assert.deepEqual(asked.map((x) => x.sel), ["#s1 [data-q='1']", "#s1 [data-q='0']"], "the questions come out of story order");
  assert.ok(asked[0].at > marked[0] && asked[0].at < marked[1] && asked[1].at > asked[0].at, "a question waits for every phrase to be highlighted");
  assert.ok(closed.length === 2 && closed[0] > asked[1].at);
  assert.ok(!beats.some((x) => x.act === "focus"), "the story is dimmed");
  assert.match(html, /<div class="sq-row" data-row="0"><p>.*?data-mark="1".*?<\/p><div class="sq-qs"><div class="sq-q" data-q="1"/);
  assert.match(html, /<span class="sq-cat">ambiguous term<\/span><p>How fast is quickly\?<\/p>/);
  assert.ok(!/severity|critical|major|minor/i.test(html.match(/<div class="stage sq"[\s\S]*?<\/section>/)?.[0] ?? ""), "a severity badge");
});

test("a scan passage that points at no question fails the render", () => {
  const bad = { ...scan, gaps: [scan.gaps[0]] };

  assert.throws(() => buildHtml({ scenes: [bad], skipped: [] }, { version: "5.15" }), /scan-questions passage "quickly": no question 2/);
});

test("a plan's logos are listed for the render to bring in", () => {
  const { mediaOf } = require("../../.claude/skills/release-video/assets/render-release-video.cjs");

  assert.deepEqual(mediaOf({ scenes: [logos, models] }), {
    logos: ["claudecode-color", "cursor", "kiro-color", "kimi", "anthropic", "mistral-color", "openai"],
  });
});

test("contributors arrive in a wave and the count is said under the thanks", () => {
  const { html } = shownBy(wave);
  const arrived = at(beatsOf(html), "from", "data-login").map((x) => x.at);

  assert.ok(arrived.length === 3 && arrived.every((t, i) => i === 0 || t > arrived[i - 1]));
  assert.match(html, /<div class="sub-slot"><p class="sub">3 contributors<\/p>/);
  assert.match(html, /<img src="assets\/av-alice\.png"/);
});

test("a tool still to arrive is hidden, not drawn over the row, until it slides in", () => {
  const { html } = shownBy(logos);

  assert.match(html, /if \(act === "fromto"\) return tl\.fromTo\(sel, value\.from, Object\.assign\(\{ duration: 0\.6, ease \}, value\.to\), at\);/);
});

test("the review summary comes forward over the page as a large card", () => {
  const { html } = shownBy(pr);

  assert.match(html, /\.gh-hero \{ position: absolute;[^}]*z-index: 5;/);
});

test("a write that passes lands on its file inside the project, and the action itself goes", () => {
  const { html } = shownBy(gate);
  const beats = beatsOf(html);
  const landed = at(beats, "set", "data-file").filter((x) => x.value === '"written"').map((x) => x.sel);
  const refused = at(beats, "set", "data-file").filter((x) => x.value === '"refused"').map((x) => x.sel);

  assert.match(html, /<div class="gt-target" data-s="idle"><b>Your project<\/b><ul class="gt-files"><li data-file="0" data-s="idle">spec\.md<\/li><li data-file="1"/);
  assert.deepEqual(landed, ["#s1 [data-file='1']", "#s1 [data-file='2']"]);
  assert.deepEqual(refused, ["#s1 [data-file='0']"]);
  assert.ok(!at(beats, "set", ".gt-target").length, "the whole project box lights instead of its file");
});

test("a gate outcome naming a file the project lacks fails the render", () => {
  const bad = { ...gate, outcomes: [{ ...gate.outcomes[0], file: "README.md" }] };

  assert.throws(() => buildHtml({ scenes: [bad], skipped: [] }, { version: "5.15" }), /gate outcome "Blocked": no file "README\.md" in the project/);
});

test("each agent card says it is an agent", () => {
  assert.match(shownBy(models).html, /<div class="ms-card" data-card="0" data-s="0"><span class="ms-kind">agent<\/span><span class="ms-role">reviewer<\/span>/);
});

test("the scan moves fast: each question appears right after its phrase is highlighted", () => {
  const beats = beatsOf(shownBy(scan).html);
  const marks = at(beats, "fill", "data-mark");
  for (const m of marks) {
    const k = m.sel.match(/'(\d+)'/)[1];
    const [q] = at(beats, "from", `data-q='${k}'`);
    assert.ok(q.at - m.at > 0 && q.at - m.at <= 0.6, `question ${k} comes ${q.at - m.at} s after its phrase`);
  }
});

test("the challenge beam reaches a line about every second", () => {
  const beats = beatsOf(shownBy(challenge).html);
  const [sweep] = at(beats, "to", ".cr-beam");
  assert.ok(JSON.parse(sweep.value).duration / challenge.spec.lines.length <= 1.05, "the beam drags");
});

test("a design card appears only when its step is reached, with no placeholder before", () => {
  const beats = beatsOf(shownBy(chain).html);
  const shown = at(beats, "in", "data-card").map((x) => x.at);
  const lit = at(beats, "set", "data-card").filter((x) => x.value === '"on"').map((x) => x.at);

  assert.deepEqual(shown, lit);
});
