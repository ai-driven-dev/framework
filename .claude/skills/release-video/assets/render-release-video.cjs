#!/usr/bin/env node
/**
 * Renders the release video from `aidd_docs/release-video/scenes.json`, locally, with no AI tool
 * involved: `node .claude/skills/release-video/assets/render-release-video.cjs --version 5.13 [--plan <file>] [--music <file>] [--out <file>]`.
 *
 * Needs `npx`, a network (fonts and avatars are local, GSAP and the avatars are fetched) and
 * ffmpeg + Chrome as Hyperframes does. The renderer is pinned: a new Hyperframes release
 * changes pixels, so it changes the video only when someone bumps it here.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../../..");
const PLAN = path.join(ROOT, "aidd_docs/release-video/scenes.json");
const HYPERFRAMES = "hyperframes@0.8.162";
const INTRO = 5;
const INTRO_WITH_HIGHLIGHTS = 6.5;
const OUTRO = 4;

const CSS = `
@font-face { font-family: "Inter"; font-weight: 700; src: url("assets/fonts/inter-latin-700-normal.woff2") format("woff2"); }
@font-face { font-family: "Inter"; font-weight: 800; src: url("assets/fonts/inter-latin-800-normal.woff2") format("woff2"); }
@font-face { font-family: "JetBrains Mono"; font-weight: 500; src: url("assets/fonts/jetbrains-mono-latin-500-normal.woff2") format("woff2"); }
@font-face { font-family: "JetBrains Mono"; font-weight: 700; src: url("assets/fonts/jetbrains-mono-latin-700-normal.woff2") format("woff2"); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1920px; height: 1080px; overflow: hidden; background: #070726; }
#root { position: relative; width: 1920px; height: 1080px; overflow: hidden; color: #eef0ff; font-family: "Inter", sans-serif;
  background: radial-gradient(900px 600px at 12% 10%, rgba(40, 90, 120, 0.35), transparent 70%),
    radial-gradient(900px 700px at 92% 95%, rgba(110, 60, 200, 0.30), transparent 70%),
    linear-gradient(160deg, #0a0a30 0%, #070726 55%, #0d0b34 100%); }
.scene { position: absolute; inset: 0; }
.inner { position: absolute; inset: 0; padding: 78px 120px; display: flex; flex-direction: column; gap: 26px; }
.pill { align-self: flex-start; font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 30px; padding: 8px 26px;
  border-radius: 40px; color: #07072b; background: linear-gradient(90deg, #5ee6a8, #8aa6ff 55%, #ff8fa8); }
h2 { font-size: 78px; line-height: 1.08; letter-spacing: -0.02em; font-weight: 800; }
.g { background: linear-gradient(90deg, #5ee6a8, #8aa6ff 55%, #c88bff 80%, #ff8fa8); -webkit-background-clip: text; background-clip: text; color: transparent; }
.win { background: #0b0b36; border: 2px solid #26265f; border-radius: 22px; overflow: hidden; box-shadow: 0 30px 80px rgba(0, 0, 20, 0.5); }
.bar { display: flex; align-items: center; gap: 12px; padding: 16px 22px; border-bottom: 2px solid #1c1c4d; font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 24px; color: #8a8fc0; }
.bar i { width: 18px; height: 18px; border-radius: 50%; display: block; }
.body { padding: 30px 36px; display: flex; flex-direction: column; gap: 18px; font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 32px; line-height: 1.4; }
.dim { color: #8a8fc0; } .grn { color: #5ee6a8; } .blu { color: #8aa6ff; } .pnk { color: #ff8fa8; } .amb { color: #ffd37a; }
.row.red { color: #ff9aa8; background: rgba(255,107,107,.14); border-left: 4px solid #ff6b6b; padding-left: 14px; }
.note { font-family: "JetBrains Mono", monospace; font-size: 22px; color: #8a8fc0; }
.chips { display: flex; flex-wrap: wrap; gap: 18px; }
.chip { font-size: 34px; padding: 12px 26px; border-radius: 12px; border: 2px solid; }
.c1 { color: #5ee6a8; border-color: #2f7a60; } .c2 { color: #8aa6ff; border-color: #3b4c99; }
.c3 { color: #c88bff; border-color: #5f3d8c; } .c4 { color: #ff8fa8; border-color: #8a4057; }
table { border-collapse: collapse; width: 100%; font-size: 28px; }
th { text-align: left; color: #8a8fc0; font-weight: 500; padding: 8px 14px; border-bottom: 2px solid #1c1c4d; }
td { padding: 14px 14px; border-bottom: 2px solid #15153f; vertical-align: top; }
.done { color: #07072b; background: #5ee6a8; padding: 3px 14px; border-radius: 8px; font-weight: 700; font-size: 24px; }
.code { white-space: pre; font-size: 30px; line-height: 1.5; }
.check { display: flex; gap: 20px; align-items: baseline; }
.flow { display: flex; align-items: stretch; gap: 16px; margin-top: 14px; }
.step { flex: 1; background: #0b0b36; border: 2px solid #26265f; border-radius: 22px; padding: 34px 32px; display: flex; flex-direction: column; gap: 14px; }
.step .n { font-family: "JetBrains Mono", monospace; font-size: 26px; color: #8a8fc0; }
.step .t { font-size: 56px; font-weight: 800; }
.step .p { font-family: "JetBrains Mono", monospace; font-size: 26px; padding: 8px 16px; border-radius: 10px; align-self: flex-start; background: rgba(255, 211, 122, 0.12); color: #ffd37a; border: 2px solid #7a6530; }
.arrow { align-self: center; font-size: 44px; color: #5b60a0; }
.pr { flex: none; width: 250px; background: rgba(94, 230, 168, 0.1); border-color: #2f7a60; }
.split { display: flex; gap: 34px; align-items: stretch; }
.split .win { min-width: 0; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 24px; margin-top: 18px; }
.cell { background: #0b0b36; border: 2px solid #26265f; border-radius: 16px; padding: 18px 24px; display: flex; flex-direction: column; gap: 4px; }
.cell.wide { grid-column: span 2; }
.cell b { font-size: 31px; font-weight: 700; }
.cell small { font-family: "JetBrains Mono", monospace; font-size: 22px; color: #8a8fc0; }
.avs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 34px 60px; margin-top: 20px; }
.av { display: flex; align-items: center; gap: 22px; }
.av img { width: 110px; height: 110px; border-radius: 50%; border: 3px solid #3a3a80; display: block; }
.av span { font-family: "JetBrains Mono", monospace; font-size: 32px; font-weight: 700; }
#intro .inner { flex-direction: row; align-items: center; justify-content: center; gap: 90px; }
#intro-logo { width: 420px; height: 420px; border-radius: 50%; border: 2px solid #2a2a66; }
.intro-text { display: flex; flex-direction: column; gap: 22px; min-width: 720px; }
.intro-top { display: flex; align-items: center; gap: 22px; }
.rel { font-family: "JetBrains Mono", monospace; font-size: 28px; letter-spacing: 0.12em; color: #8a8fc0; }
#ver { font-size: 250px; line-height: 1; font-weight: 800; letter-spacing: -0.03em; white-space: nowrap; }
#ver .dot { color: #5ee6a8; }
.tagline { font-family: "JetBrains Mono", monospace; font-size: 40px; color: #a6abe0; }
.tagline b { color: #fff; font-weight: 700; }
.hls { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; margin-top: 10px; }
.hl { font-family: "JetBrains Mono", monospace; font-size: 28px; padding: 10px 22px; border-radius: 12px; border: 2px solid #3b4c99; color: #8aa6ff; }
.lead { font-size: 36px; line-height: 1.3; color: #a6abe0; max-width: 1500px; }
#outro .inner { align-items: center; justify-content: center; gap: 26px; }
.logo { width: 280px; height: 280px; border-radius: 50%; }
#outro h2 { font-size: 150px; text-align: center; }
.cmd { font-family: "JetBrains Mono", monospace; font-size: 34px; padding: 16px 30px; border: 2px solid #26265f; border-radius: 14px; background: #0b0b36; }
.url { font-family: "JetBrains Mono", monospace; font-size: 28px; color: #8a8fc0; }
`;

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const half = (seconds) => Math.ceil(seconds * 2) / 2;

const cell = (value) => {
  if (value?.status) return `<td><span class="done">${esc(value.status)}</span></td>`;
  if (value?.dim) return `<td class="dim">${esc(value.dim)}</td>`;
  return `<td>${esc(value)}</td>`;
};

const row = {
  prompt: (r) => `<div class="row"><span class="grn">&gt;</span> ${esc(r.prompt)}</div>`,
  text: (r) => `<div class="row ${esc(r.tone ?? "")}">${esc(r.text)}</div>`,
  chips: (r) =>
    `<div class="row chips">${r.chips.map((c, i) => `<span class="chip c${(i % 4) + 1}">${esc(c)}</span>`).join("")}</div>`,
  table: (r) =>
    `<table class="row"><thead><tr>${r.table.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>` +
    r.table.rows.map((cells) => `<tr>${cells.map(cell).join("")}</tr>`).join("") +
    `</tbody></table>`,
  code: (r) => `<div class="row code">${esc(r.code)}</div>`,
  check: (r) =>
    `<div class="row check"><span class="${r.mark === "!" ? "amb" : "grn"}">${esc(r.mark ?? "✓")}</span><span>${esc(r.check)}</span></div>`,
};

function rowHtml(r) {
  const kind = Object.keys(row).find((k) => k in r);
  if (!kind) throw new Error(`Unknown row: ${JSON.stringify(r)}`);
  return row[kind](r);
}

const DOTS =
  '<i style="background:#ff6b6b"></i><i style="background:#ffd37a"></i><i style="background:#5ee6a8"></i>';

const windowHtml = ({ label, rows = [], flex }) =>
  `<div class="win it"${flex ? ` style="flex:${flex}"` : ""}><div class="bar">${DOTS}<span>${esc(label)}</span></div>` +
  `<div class="body">${rows.map(rowHtml).join("")}</div></div>`;

const flowHtml = (steps) =>
  `<div class="flow">` +
  steps
    .map((s, i) => {
      const arrow = i > 0 ? `<span class="arrow it">→</span>` : "";
      const box = s.final
        ? `<div class="step pr it"><span class="n">&nbsp;</span><span class="t grn">${esc(s.title)}</span></div>`
        : `<div class="step it"><span class="n">${esc(s.n)}</span><span class="t">${esc(s.title)}</span><span class="p">${esc(s.sub)}</span></div>`;
      return arrow + box;
    })
    .join("") +
  `</div>`;

const noteHtml = (s) => (s.note ? `<p class="note fin">${esc(s.note)}</p>` : "");

const rowsIn = (rows = []) => rows.reduce((n, r) => n + (r.table ? 1 + r.table.rows.length : 1), 0);

/** Rows are revealed one by one; the note comes after the last. */
const rowElements = (s) =>
  (s.window ? [s.window] : s.panels ?? []).reduce((n, w) => n + (w.rows ?? []).length, 0);

const scene = {
  "terminal-demo": {
    items: (s) => rowsIn(s.window?.rows) + (s.flow ? 2 : 0),
    body: (s) => windowHtml(s.window) + (s.flow ? flowHtml(s.flow) : "") + noteHtml(s),
  },
  "two-panels": {
    items: (s) => (s.panels ?? []).reduce((n, p) => n + rowsIn(p.rows), 0),
    body: (s) => `<div class="split">${s.panels.map(windowHtml).join("")}</div>${noteHtml(s)}`,
  },
  "bullet-grid": {
    items: (s) => (s.cells ?? []).length,
    body: (s) =>
      `<div class="grid">` +
      s.cells
        .map(
          (c) =>
            `<div class="cell it${c.wide ? " wide" : ""}"><b>${esc(c.title)}</b><small>${esc(c.detail ?? "")}</small></div>`
        )
        .join("") +
      `</div>`,
  },
  contributors: {
    items: (s) => Math.ceil((s.logins ?? []).length / 2),
    body: (s) =>
      `<div class="avs">` +
      s.logins
        .map((l) => `<div class="av it"><img src="assets/av-${esc(l)}.png" /><span>@${esc(l)}</span></div>`)
        .join("") +
      `</div>`,
  },
};

/** Head (2.5 s), a second to read the lead, a beat per item, and a closing pause. */
function sceneDuration(s) {
  if (!scene[s.template]) throw new Error(`Unknown template: ${s.template}`);
  return half(4.5 + (s.lead ? 1 : 0) + 0.7 * scene[s.template].items(s));
}

const headHtml = (s, id) =>
  `<span class="pill" id="${id}-pill">${esc(s.pill)}</span>` +
  `<h2 id="${id}-h">${esc(s.title)}${s.accent ? ` <span class="g">${esc(s.accent)}</span>` : ""}</h2>` +
  (s.lead ? `<p class="lead" id="${id}-lead">${esc(s.lead)}</p>` : "");

/** The tags say what the release brings; the phrase above them is optional, and only an intro with
 * neither keeps a default one. */
const hasTagline = (intro = {}) => Boolean(intro.tagline) || !intro.highlights?.length;

/** The version is typed in by the timeline: until it starts, nothing of it is on screen. */
function introHtml(intro = {}) {
  const tagline = intro.tagline ? esc(intro.tagline) : "What's new, <b>end to end.</b>";
  const highlights = (intro.highlights ?? []).map((h) => `<span class="hl it">${esc(h)}</span>`).join("");
  return (
    `<img id="intro-logo" src="assets/logo.png" alt="" /><div class="intro-text">` +
    `<div class="intro-top"><span class="pill" id="intro-pill">AIDD Framework</span><span class="rel" id="intro-rel">NEW RELEASE</span></div>` +
    `<div id="ver"><span id="ver-t"></span><span class="dot"></span><span id="ver-n"></span></div>` +
    (hasTagline(intro) ? `<p class="tagline" id="intro-tag">${tagline}</p>` : "") +
    (highlights ? `<div class="hls">${highlights}</div>` : "") +
    `</div>`
  );
}

/** The fade lane sets the level itself: it is absolute, so it carries the music level too. */
const MUSIC_LEVEL = 0.5;

const musicHtml = (src, total) => {
  const lane = {
    version: 1,
    lanes: [
      {
        target: "volume",
        points: [
          { t: 0, v: 0 },
          { t: 0.3, v: MUSIC_LEVEL },
          { t: total - 1, v: MUSIC_LEVEL },
          { t: total, v: 0 },
        ],
      },
    ],
  };
  return `<audio id="music" src="${esc(src)}" data-start="0" data-duration="${total}" data-track-index="10" data-automation="${esc(JSON.stringify(lane))}"></audio>`;
};

/** The interface sounds sit well under the picture and the music. */
const SFX_LEVEL = 0.2;

const sfxHtml = (src, total) =>
  `<audio id="sfx" src="${esc(src)}" data-start="0" data-duration="${total}" data-track-index="11" data-volume="${SFX_LEVEL}"></audio>`;

const introSeconds = (plan) => (plan.intro?.highlights?.length ? INTRO_WITH_HIGHLIGHTS : INTRO);

const round2 = (x) => Math.round(x * 100) / 100;
const itemsIn = (html) => (html.match(/class="[^"]*\bit\b/g) ?? []).length;

/** One sound per thing that appears, at the time the timeline shows it: a whoosh as a scene
 * opens, a pop as a window or item slides in, a click per row, a key tick per typed character. */
function soundCues(plan, { version }) {
  const cues = [];
  const cue = (kind, t) => cues.push({ kind, t: round2(t) });
  const chars = String(version).length + 1;
  cue("pop", 0.1);
  for (let k = 0; k < chars; k++) cue("key", 0.8 + (1.1 * k) / chars);
  if (hasTagline(plan.intro)) cue("pop", 2.0);
  (plan.intro?.highlights ?? []).forEach((_, k) => cue("pop", (hasTagline(plan.intro) ? 2.6 : 2) + 0.3 * k));

  let t = introSeconds(plan);
  for (const s of plan.scenes) {
    cue("whoosh", t);
    for (let k = 0; k < itemsIn(scene[s.template].body(s)); k++) cue("pop", t + 0.63 + 0.3 * k);
    for (let k = 0; k < rowElements(s); k++) cue("click", t + 1.3 + 0.45 * k);
    t += sceneDuration(s);
  }
  for (let k = 0; k < 2; k++) cue("pop", t + 0.63 + 0.2 * k);
  return cues.sort((a, b) => a.t - b.t);
}

const SFX_RATE = 44100;
const square = (phase, duty = 0.5) => (phase % 1 < duty ? 1 : -1);

/** Each sound is a short 8-bit blip: a square wave with a fast decay, no noise. */
const SOUNDS = {
  key: { seconds: 0.025, wave: (x) => square(1400 * x) * Math.exp(-x * 120) },
  click: { seconds: 0.05, wave: (x) => square(2000 * x) * Math.exp(-x * 80) },
  pop: { seconds: 0.12, wave: (x) => square((480 + 2000 * x) * x) * Math.exp(-x * 25) },
  whoosh: { seconds: 0.26, wave: (x) => square((150 + 2400 * x) * x, 0.25) * Math.sin((Math.PI * x) / 0.26) * 0.6 },
};

/** The sounds of the cues, laid on a silent mono 16-bit wav as long as the video. */
function soundTrack(plan, { version }) {
  const total = Math.round(totalDuration(plan) * SFX_RATE);
  const mix = new Float64Array(total);
  for (const { kind, t } of soundCues(plan, { version })) {
    const { seconds, wave } = SOUNDS[kind];
    const from = Math.round(t * SFX_RATE);
    for (let i = 0; i < Math.round(seconds * SFX_RATE) && from + i < total; i++) mix[from + i] += wave(i / SFX_RATE);
  }
  const wav = Buffer.alloc(44 + 2 * total);
  wav.write("RIFF", 0, "latin1");
  wav.writeUInt32LE(36 + 2 * total, 4);
  wav.write("WAVEfmt ", 8, "latin1");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SFX_RATE, 24);
  wav.writeUInt32LE(SFX_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36, "latin1");
  wav.writeUInt32LE(2 * total, 40);
  for (let i = 0; i < total; i++) {
    const steps = Math.round(Math.max(-1, Math.min(1, mix[i] * 0.8)) * 31) / 31; // 5-bit grain
    wav.writeInt16LE(Math.round(steps * 32767), 44 + 2 * i);
  }
  return wav;
}

/** What the root declares: the length a music track is cut to. */
const totalDuration = (plan) => introSeconds(plan) + plan.scenes.reduce((n, s) => n + sceneDuration(s), 0) + OUTRO;

function buildHtml(plan, { version, music, sfx }) {
  const sections = [];
  const script = [];
  let t = 0;
  const open = (id, duration, inner) =>
    sections.push(
      `<section id="${id}" class="scene clip" data-start="${t}" data-duration="${duration}" data-track-index="0"><div class="inner">${inner}</div></section>`
    );

  open("intro", introSeconds(plan), introHtml(plan.intro));
  script.push(
    `enter("#intro-logo", 0.1, { y: 0, scale: 0.85, duration: 0.9 });`,
    `enter("#intro-pill", 0.4, { y: 20 });`,
    `enter("#intro-rel", 0.55, { y: 20 });`,
    `const typed = { n: 0 }; const full = ${JSON.stringify(String(version))};`,
    `tl.to(typed, { n: 1, duration: 1.1, ease: "none", onUpdate: () => { const len = Math.round(typed.n * (full.length + 1));` +
      ` const [a, b = ""] = full.split(".");` +
      ` document.getElementById("ver-t").textContent = ("v" + a).slice(0, Math.min(len, a.length + 1));` +
      ` document.querySelector("#ver .dot").textContent = len > a.length + 1 ? "." : "";` +
      ` document.getElementById("ver-n").textContent = len > a.length + 1 ? b.slice(0, len - a.length - 1) : ""; } }, 0.8);`,
    ...(hasTagline(plan.intro) ? [`enter("#intro-tag", 2.0, { y: 20 });`] : []),
    `enter("#intro .hl", ${hasTagline(plan.intro) ? 2.6 : 2}, { y: 16, duration: 0.5, stagger: 0.3 });`,
    `cut("intro", ${introSeconds(plan)});`
  );
  t += introSeconds(plan);

  plan.scenes.forEach((s, i) => {
    const id = `s${i + 1}`;
    const duration = sceneDuration(s);
    open(id, duration, headHtml(s, id) + scene[s.template].body(s));
    script.push(
      `enter("#${id}-pill", ${t} + 0.14, { y: 20 });`,
      `enter("#${id}-h", ${t} + 0.28);`,
      ...(s.lead ? [`enter("#${id}-lead", ${t} + 0.5, { y: 20 });`] : []),
      `enter("#${id} .it", ${t} + 0.63, { y: 30, duration: 0.7, stagger: 0.3 });`,
      `enter("#${id} .row", ${t} + 1.3, { y: 14, duration: 0.5, stagger: 0.45 });`,
      ...(s.note ? [`enter("#${id} .fin", ${Math.round((t + 1.3 + 0.45 * rowElements(s) + 0.3) * 100) / 100}, { y: 10 });`] : []),
      `cut("${id}", ${t + duration});`
    );
    t += duration;
  });

  open(
    "outro",
    OUTRO,
    `<img class="logo" id="outro-logo" src="assets/logo.png" alt="" />` +
      `<h2 id="outro-h">AIDD <span class="g">v${esc(version)}</span></h2>` +
      `<div class="cmd it">$ npx @ai-driven-dev/cli@latest setup</div>` +
      `<p class="url it">github.com/ai-driven-dev/framework</p>`
  );
  script.push(
    `enter("#outro-logo", ${t} + 0.07, { y: 0, scale: 0.85, duration: 0.8 });`,
    `enter("#outro-h", ${t} + 0.28);`,
    `enter("#outro .it", ${t} + 0.63, { y: 14, stagger: 0.2 });`
  );
  t += OUTRO;
  script.push(`tl.to("#outro .inner", { opacity: 0, duration: 0.4, ease: "power1.in" }, ${t} - 0.4);`);

  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=1920, height=1080" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>${CSS}</style></head>
<body><div id="root" data-composition-id="main" data-start="0" data-duration="${t}" data-width="1920" data-height="1080">
${sections.join("\n")}
${music ? musicHtml(music, t) : ""}
${sfx ? sfxHtml(sfx, t) : ""}
</div>
<script>
const tl = gsap.timeline({ paused: true });
const ease = "power3.out";
const cut = (id, end) => tl.to("#" + id + " .inner", { opacity: 0, duration: 0.4, ease: "power1.in" }, end - 0.4);
const enter = (sel, at, extra = {}) => tl.from(sel, Object.assign({ opacity: 0, y: 40, duration: 0.6, ease }, extra), at);
${script.join("\n")}
window.__timelines = window.__timelines || {};
window.__timelines["main"] = tl;
tl.seek(0);
</script></body></html>
`;
}

const STEP = 0.5;
const HOOK_STARTS_WITHIN = 2;
const LOUD_ABOVE_MEDIAN = 8;

/** The ending is the last stretch of a track before it falls silent, as long as the outro it opens: small, never louder than a hook. */
const ENDING_SECONDS = 4;
const SILENT_BELOW = -55;

/** Where a track is loud at its start (a hook, after at most two quiet seconds) and where its small
 * ending is, from its energy in dB per half second. Null when it has no hook: such a track is only
 * looped. */
function musicSections(rms) {
  const sorted = [...rms].sort((a, b) => a - b);
  const loud = (v) => v > sorted[Math.floor(sorted.length / 2)] + LOUD_ABOVE_MEDIAN;
  const first = rms.findIndex(loud);
  let end = first;
  while (end < rms.length && loud(rms[end])) end += 1;
  const tailEnd = (rms.map((v) => v > SILENT_BELOW).lastIndexOf(true) + 1) * STEP;
  const tailStart = tailEnd - ENDING_SECONDS;
  if (first < 0 || first * STEP > HOOK_STARTS_WITHIN || tailStart <= end * STEP) return null;
  return { headStart: first * STEP, headEnd: end * STEP, tailStart, tailEnd };
}

/** The hook under the intro, the bed under the scenes and the outro, the small ending last. */
function musicSegments(sections, { intro, total }) {
  const head = { part: "head", from: sections.headStart, length: Math.min(intro, sections.headEnd - sections.headStart), at: 0 };
  const tail = { part: "tail", from: sections.tailStart, length: sections.tailEnd - sections.tailStart };
  tail.at = total - tail.length;
  const body = { part: "body", from: sections.headEnd, length: tail.at - head.length, at: head.length };
  return [head, body, tail];
}

function measureRms(source) {
  const run = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-i", source, "-af",
      "aresample=48000,asetnsamples=n=24000:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
      "-f", "null", "-"],
    { encoding: "utf8" }
  );
  return [...run.stdout.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map((m) => (m[1] === "-inf" ? -100 : Number(m[1])));
}

const ffmpeg = (args) => {
  const run = spawnSync("ffmpeg", ["-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  if (run.status !== 0) throw new Error(`ffmpeg failed (${run.status})`);
};

/** The track shaped to the video: its hook under the intro, its bed looped under the scenes and the
 * outro, its small ending closing the video. A track with no such structure is only looped to the video's length. */
function fitMusic(source, target, plan) {
  const total = totalDuration(plan);
  const sections = musicSections(measureRms(source));
  if (!sections) {
    ffmpeg(["-stream_loop", "-1", "-i", source, "-t", String(total), "-c:a", "libmp3lame", "-q:a", "2", target]);
    return;
  }
  const [head, body, tail] = musicSegments(sections, { intro: introSeconds(plan), total });
  const bed = sections.tailStart - sections.headEnd;
  const cut = (seg, label, fades) =>
    `[0:a]aresample=48000,atrim=start=${seg.from}:duration=${seg.length},asetpts=PTS-STARTPTS${fades}[${label}]`;
  const loopedBed =
    `[0:a]aresample=48000,atrim=start=${body.from}:duration=${Math.min(bed, body.length)},asetpts=PTS-STARTPTS,` +
    `aloop=loop=-1:size=${Math.ceil(bed * 48000)},atrim=duration=${body.length},asetpts=PTS-STARTPTS[b]`;
  const fadeOut = (seg) => `,afade=t=out:st=${Math.max(0, seg.length - 0.15)}:d=0.15`;
  const filter = [
    cut(head, "h", `,afade=t=in:d=0.05${fadeOut(head)}`),
    loopedBed,
    cut(tail, "t", `,afade=t=in:d=0.05`),
    `[h][b][t]concat=n=3:v=0:a=1,apad=whole_dur=${total},atrim=duration=${total}[a]`,
  ].join(";");
  ffmpeg(["-i", source, "-filter_complex", filter, "-map", "[a]", "-c:a", "libmp3lame", "-q:a", "2", target]);
}

function writeProject(dir, plan, version, musicSource) {
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  fs.cpSync(path.join(__dirname, "fonts"), path.join(dir, "assets/fonts"), { recursive: true });
  fs.copyFileSync(path.join(__dirname, "logo.png"), path.join(dir, "assets/logo.png"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "release-video", private: true, type: "module" })
  );
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ id: "release-video", name: "release-video" }));
  fs.writeFileSync(path.join(dir, "hyperframes.json"), JSON.stringify({ paths: { assets: "assets" } }));
  let music;
  if (musicSource) {
    music = "assets/music-fit.mp3";
    fitMusic(musicSource, path.join(dir, music), plan);
  }
  const sfx = "assets/sfx.wav";
  fs.writeFileSync(path.join(dir, sfx), soundTrack(plan, { version }));
  fs.writeFileSync(path.join(dir, "index.html"), buildHtml(plan, { version, music, sfx }));
}

async function fetchAvatars(dir, plan) {
  const logins = plan.scenes.flatMap((s) => s.logins ?? []);
  for (const login of new Set(logins)) {
    const target = path.join(dir, "assets", `av-${login}.png`);
    const response = await fetch(`https://github.com/${encodeURIComponent(login)}.png?size=240`);
    if (response.ok) {
      fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
    } else {
      console.warn(`⚠️ Avatar of ${login}: HTTP ${response.status}, logo used`);
      fs.copyFileSync(path.join(dir, "assets", "logo.png"), target);
    }
  }
}

function argument(name) {
  const at = process.argv.indexOf(`--${name}`);
  return at > -1 ? process.argv[at + 1] : undefined;
}

async function main() {
  const version = argument("version");
  if (!version) throw new Error("Usage: render-release-video.cjs --version <x.y> [--plan <file>] [--music <file>] [--out <file>]");
  const plan = JSON.parse(fs.readFileSync(path.resolve(argument("plan") ?? PLAN), "utf8"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-video-"));

  const kitMusic = path.join(__dirname, "music.mp3");
  const musicSource = argument("music") ?? (fs.existsSync(kitMusic) ? kitMusic : undefined);
  writeProject(dir, plan, version, musicSource);
  await fetchAvatars(dir, plan);

  const render = spawnSync("npx", ["--yes", HYPERFRAMES, "render", "--output", "release-video.mp4"], {
    cwd: dir,
    stdio: "inherit",
  });
  if (render.status !== 0) throw new Error(`Hyperframes render failed (${render.status})`);

  const out = path.resolve(argument("out") ?? "release-video.mp4");
  fs.copyFileSync(path.join(dir, "release-video.mp4"), out);
  console.log(`✅ ${out}`);
}

module.exports = { buildHtml, musicSections, musicSegments, sceneDuration, soundCues, soundTrack, totalDuration };

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  });
}
