#!/usr/bin/env node
/**
 * Renders the release video from `aidd_docs/release-video/scenes.json`, locally, with no AI tool
 * involved: `node scripts/render-release-video.cjs --version 5.13 [--plan <file>] [--out <file>]`.
 *
 * Needs `npx`, a network (fonts and avatars are local, GSAP and the avatars are fetched) and
 * ffmpeg + Chrome as Hyperframes does. The renderer is pinned: a new Hyperframes release
 * changes pixels, so it changes the video only when someone bumps it here.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const KIT = path.join(ROOT, "aidd_docs/release-video");
const HYPERFRAMES = "hyperframes@0.8.162";
const INTRO = 5;
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
.note { font-family: "JetBrains Mono", monospace; font-size: 22px; color: #8a8fc0; }
.chips { display: flex; flex-wrap: wrap; gap: 18px; }
.chip { font-size: 28px; padding: 10px 22px; border-radius: 12px; border: 2px solid; }
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

/** Head (2.5 s), a beat per item, and a closing pause so the last thing shown can be read. */
function sceneDuration(s) {
  if (!scene[s.template]) throw new Error(`Unknown template: ${s.template}`);
  return half(4.5 + 0.7 * scene[s.template].items(s));
}

const headHtml = (s, id) =>
  `<span class="pill" id="${id}-pill">${esc(s.pill)}</span>` +
  `<h2 id="${id}-h">${esc(s.title)}${s.accent ? ` <span class="g">${esc(s.accent)}</span>` : ""}</h2>`;

/** The version is typed in by the timeline: until it starts, nothing of it is on screen. */
function introHtml() {
  return (
    `<img id="intro-logo" src="assets/logo.png" alt="" /><div class="intro-text">` +
    `<div class="intro-top"><span class="pill" id="intro-pill">AIDD Framework</span><span class="rel" id="intro-rel">NEW RELEASE</span></div>` +
    `<div id="ver"><span id="ver-t"></span><span class="dot"></span><span id="ver-n"></span></div>` +
    `<p class="tagline" id="intro-tag">What's new, <b>end to end.</b></p></div>`
  );
}

function buildHtml(plan, { version }) {
  const sections = [];
  const script = [];
  let t = 0;
  const open = (id, duration, inner) =>
    sections.push(
      `<section id="${id}" class="scene clip" data-start="${t}" data-duration="${duration}" data-track-index="0"><div class="inner">${inner}</div></section>`
    );

  open("intro", INTRO, introHtml());
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
    `enter("#intro-tag", 2.0, { y: 20 });`,
    `cut("intro", ${INTRO});`
  );
  t += INTRO;

  plan.scenes.forEach((s, i) => {
    const id = `s${i + 1}`;
    const duration = sceneDuration(s);
    open(id, duration, headHtml(s, id) + scene[s.template].body(s));
    script.push(
      `enter("#${id}-pill", ${t} + 0.14, { y: 20 });`,
      `enter("#${id}-h", ${t} + 0.28);`,
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

function writeProject(dir, plan, version) {
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  fs.cpSync(path.join(KIT, "assets"), path.join(dir, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "release-video", private: true, type: "module" })
  );
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ id: "release-video", name: "release-video" }));
  fs.writeFileSync(path.join(dir, "hyperframes.json"), JSON.stringify({ paths: { assets: "assets" } }));
  fs.writeFileSync(path.join(dir, "index.html"), buildHtml(plan, { version }));
}

/** An account renamed or deleted since the release notes were written has no avatar: the logo
 * stands in, and the video still renders. */
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
  if (!version) throw new Error("Usage: render-release-video.cjs --version <x.y> [--plan <file>] [--out <file>]");
  const plan = JSON.parse(fs.readFileSync(path.resolve(argument("plan") ?? path.join(KIT, "scenes.json")), "utf8"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-video-"));

  writeProject(dir, plan, version);
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

module.exports = { buildHtml, sceneDuration };

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  });
}
