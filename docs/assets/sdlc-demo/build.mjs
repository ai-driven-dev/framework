// Generates the HyperFrames project behind the README demo video from scenes.json.
// Regenerate the animation:
//   npx hyperframes init <dir> --example blank --non-interactive
//   node build.mjs <dir>
//   cd <dir> && npx hyperframes render --quality delivery --fps 30 -o demo.mp4
//   ffmpeg -i demo.mp4 -vf scale=1280:-2 -c:v libx264 -crf 29 -preset slow -pix_fmt yuv420p -movflags +faststart -an sdlc-demo.mp4
//   Then drag sdlc-demo.mp4 into a GitHub editor and paste the user-attachments URL it returns in README.md.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const data = JSON.parse(readFileSync(new URL("./scenes.json", import.meta.url), "utf8"));
// Pace: every line lands PACE times as fast as scenes.json writes it.
const PACE = 0.72;
for (const s of data.scenes) {
  if (s.redAt !== undefined) s.redAt = +(s.redAt * PACE).toFixed(2);
  if (s.loop) s.loop.at = +(s.loop.at * PACE).toFixed(2);
  for (const l of s.lines) {
    if (l.kind !== "type") l.at = +(l.at * PACE).toFixed(2);
    for (const r of l.rows ?? []) r.at = +(r.at * PACE).toFixed(2);
  }
}
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const W = 1920, H = 1080;

let cursor = 0;
// A scene lasts until its last line has been read: 1.8 s after the last one lands.
const lastAt = (s) => Math.max(...s.lines.flatMap((l) => [l.kind === "type" ? l.at + 2.2 : l.at, ...(l.rows ?? []).map((r) => r.at)]));
const scenes = data.scenes.map((s) => {
  const start = +cursor.toFixed(2);
  const duration = +(lastAt(s) + 1.5).toFixed(2);
  cursor += duration;
  return { ...s, start, duration };
});
const total = +(cursor + 2).toFixed(2); // hold the last frame for two seconds

const FONT = "'JetBrains Mono', monospace";
const UI = "'Inter', sans-serif";

const COLOR = { skill: "#d2a8ff", agent: "#79c0ff", ask: "#e6edf3", answer: "#ffa657", ok: "#3fb950", plain: "#c9d1d9", file: "#8b949e" };

function lineMarkup(l, i) {
  const id = `l${i}`;
  const cls = `ln ${l.kind}`;
  if (l.kind === "card") {
    const rows = l.rows.map((r, j) => `<div id="c${i}r${j}" class="row ${r.k}">${r.k === "ok" ? `<span class="tick">✔</span>` : r.k === "bad" ? `<span class="tick">✘</span>` : r.k === "warn" ? `<span class="tick">↺</span>` : ""}${esc(r.text)}</div>`).join("");
    return `<div id="${id}" class="card"><div class="head">${esc(l.title)}</div><div class="body">${rows}</div></div>`;
  }
  if (l.kind === "does") return `<div id="${id}" class="${cls}">${esc(l.text)}</div>`;
  if (l.kind === "artifact") return `<div id="${id}" class="${cls}"><span class="lab">Produces</span><span class="box">${esc(l.text)}</span></div>`;
  if (l.kind === "ok") return `<div id="${id}" class="${cls}"><span class="tick">✔</span>${esc(l.text)}</div>`;
  if (l.kind === "ask") return `<div id="${id}" class="${cls}"><span class="mark">?</span>${esc(l.text)}</div>`;
  if (l.kind === "answer") return `<div id="${id}" class="${cls}"><span class="mark">&gt;</span>${esc(l.text)}</div>`;
  if (l.kind === "type") return `<div id="${id}" class="${cls}"><span class="mark">&gt;</span><span id="typed"></span><span id="caret">▌</span></div>`;
  return `<div id="${id}" class="${cls}">${esc(l.text)}</div>`;
}

function sceneFile(s) {
  const tweens = s.lines
    .map((l, i) =>
      l.kind === "card"
        ? `tl.fromTo("#l${i}", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, ${l.at});
    ${l.rows.map((r, j) => `tl.fromTo("#c${i}r${j}", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }, ${r.at});`).join("\n    ")}`
        : l.kind === "type"
        ? `tl.fromTo("#l${i}", { opacity: 0 }, { opacity: 1, duration: 0.15 }, ${l.at});
    const text = ${JSON.stringify(l.text)}; const state = { n: 0 };
    tl.to(state, { n: text.length, duration: 1.8, ease: "none", onUpdate: () => { document.getElementById("typed").textContent = text.slice(0, Math.round(state.n)); } }, ${l.at + 0.2});`
        : `tl.fromTo("#l${i}", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.32, ease: "power3.out" }, ${l.at});`,
    )
    .join("\n    ");
  const cardAt = (s.lines.find((l) => l.kind === "card") ?? { at: 0 }).at;
  const collapse = (s.collapse ?? []).length
    ? `tl.to("${s.collapse.map((i) => `#l${i}`).join(", ")}", { opacity: 0, duration: 0.25 }, ${+(cardAt - 0.4).toFixed(2)});
    tl.set("${s.collapse.map((i) => `#l${i}`).join(", ")}", { display: "none" }, ${+(cardAt - 0.15).toFixed(2)});`
    : "";
  return `<template>
  <style>
    #root { position: absolute; inset: 0; font-family: ${FONT}; }
    #pane { position: absolute; left: 640px; top: 190px; width: 1130px; display: flex; flex-direction: column; gap: 22px; font-size: 46px; line-height: 1.35; }
    .ln { color: ${COLOR.plain}; }
    .skill { font-size: 36px; color: ${COLOR.skill}; } .agent { color: ${COLOR.agent}; } .ask { color: ${COLOR.ask}; font-weight: 700; font-size: 40px; }
    .does { color: #8b949e; font-family: ${UI}; font-size: 36px; margin-top: -14px; }
    .card { margin-top: 14px; border: 2px solid #2d3643; border-radius: 16px; background: #0d1117; overflow: hidden; }
    .head { padding: 16px 26px; background: #1a212b; border-bottom: 2px solid #2d3643; color: #8b949e; font-size: 30px; }
    .body { padding: 18px 26px; display: flex; flex-direction: column; gap: 7px; font-size: 30px; white-space: pre; }
    .row { color: #c9d1d9; }
    .row.bad, .row.red { color: #ff7b72; }
    .row.warn { color: #d29922; font-weight: 700; }
    .row.h { color: #fff; font-weight: 700; } .row.v { color: #3fb950; font-weight: 700; margin-top: 8px; }
    .answer { color: ${COLOR.answer}; font-size: 40px; } .file { color: ${COLOR.file}; } .ok { color: ${COLOR.ok}; font-weight: 700; }
    .tick, .mark { display: inline-block; width: 56px; }
    .type { font-size: 48px; color: #e6edf3; } #caret { color: #d97757; }
    .type .mark { color: #d97757; }
  </style>
  <div id="root" data-composition-id="${s.id}" data-width="${W}" data-height="${H}">
    <div id="pane">
      ${s.lines.map(lineMarkup).join("\n      ")}
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    ${tweens}
    ${collapse}
    ${s.id === scenes[scenes.length - 1].id ? "" : `tl.to("#pane", { opacity: 0, filter: "blur(8px)", duration: 0.22, ease: "power2.in" }, ${+(s.duration - 0.25).toFixed(2)});`}
    window.__timelines["${s.id}"] = tl;
  </script>
</template>
`;
}

function chromeFile() {
  const steps = data.steps;
  const rail = steps.map((st) => `<div id="s-${st.id}" class="step"><span class="dot"></span>${esc(st.label)}${st.approve ? '<span class="you">you approve</span>' : ""}</div>`);
  const events = [];
  const paint = (id, t, state) => events.push({ id, t: +t.toFixed(2), state });
  for (const st of steps) {
    const own = scenes.filter((s) => s.step === st.id);
    paint(st.id, own[0].start, "active");
    paint(st.id, own[own.length - 1].start + own[own.length - 1].duration - 0.2, "done");
  }
  scenes.forEach((s, i) => {
    if (s.redAt !== undefined) paint(s.step, s.start + s.redAt, "red");
    if (s.loop) {
      const [first, second] = s.loop.steps;
      const t = s.start + s.loop.at;
      paint(first, t, "active");
      paint(first, t + 0.5, "done");
      paint(second, t + 0.5, "active");
      paint(second, t + 1.0, "done");
      paint(s.step, t + 1.2, "active");
    }
  });
  const STATE = {
    active: { label: "#ffffff", dot: "#d97757", scale: 1.25 },
    red: { label: "#ff7b72", dot: "#f85149", scale: 1.25 },
    done: { label: "#3fb950", dot: "#3fb950", scale: 1 },
  };
  const timings = events
    .map((e) => `tl.set("#s-${e.id}", { color: "${STATE[e.state].label}" }, ${e.t});
    tl.set("#s-${e.id} .dot", { backgroundColor: "${STATE[e.state].dot}", scale: ${STATE[e.state].scale} }, ${e.t});`)
    .join("\n    ");
  return `<template>
  <style>
    #root { position: absolute; inset: 0; background: #0b0f14; font-family: ${UI}; }
    #win { position: absolute; left: 110px; top: 90px; width: 1700px; height: 850px; border-radius: 22px; background: #11161d; border: 2px solid #232b36; overflow: hidden; }
    #bar { height: 64px; background: #161c25; border-bottom: 2px solid #232b36; display: flex; align-items: center; gap: 14px; padding-left: 28px; color: #8b949e; font-size: 28px; }
    .light { width: 18px; height: 18px; border-radius: 50%; background: #30363d; }
    #bar span { margin-left: 18px; }
    #railhead { position: absolute; left: 162px; top: 196px; font-size: 30px; font-weight: 800; letter-spacing: 0.22em; color: #8b949e; }
    #rail { position: absolute; left: 110px; top: 259px; width: 460px; padding: 0 0 0 52px; }
    .step { display: flex; align-items: center; gap: 22px; font-size: 40px; font-weight: 600; color: #6e7681; height: 96px; position: relative; }
    .step::after { content: ""; position: absolute; left: 7px; top: 56px; width: 2px; height: 80px; background: #30363d; }
    .step:last-child::after { display: none; }
    .you { margin-left: 6px; padding: 4px 16px; border-radius: 999px; background: #fff8c5; color: #633c01; border: 2px solid #9a6700; font-size: 22px; font-weight: 700; }
    #legend { position: absolute; left: 110px; top: 1018px; width: 1700px; text-align: center; font-size: 28px; font-weight: 700; letter-spacing: 0.04em; }
    #legend .ai { color: #a371f7; }
    #legend .yo { color: #e3b341; margin-left: 40px; }
    .dot { width: 16px; height: 16px; flex: none; border-radius: 50%; background: #30363d; }
    #divider { position: absolute; left: 600px; top: 154px; width: 2px; height: 786px; background: #232b36; }
    #badge { position: absolute; left: 110px; top: 974px; width: 1700px; text-align: center; font-size: 28px; color: #8b949e; letter-spacing: 0.04em; }
  </style>
  <div id="root" data-composition-id="chrome" data-width="${W}" data-height="${H}">
    <div id="win"><div id="bar"><i class="light"></i><i class="light"></i><i class="light"></i><span>your AI coding tool</span></div></div>
    <div id="divider"></div>
    <div id="railhead">SDLC</div>
    <div id="rail">${rail.join("")}</div>
    <div id="badge">${esc(data.badge)}</div>
    <div id="legend"><span class="ai">■ the AI works</span><span class="yo">■ you approve</span></div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    ${timings}
    window.__timelines["chrome"] = tl;
  </script>
</template>
`;
}

const hosts = scenes
  .map((s) => `<div id="${s.id}" class="clip" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.start}" data-duration="${s.id === scenes[scenes.length - 1].id ? s.duration + 2 : s.duration}" data-track-index="2" data-track-kind="graphics" data-width="${W}" data-height="${H}"></div>`)
  .join("\n      ");

const index = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #0b0f14; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}">
      <div id="chrome" class="clip" data-composition-id="chrome" data-composition-src="compositions/chrome.html" data-start="0" data-duration="${total}" data-track-index="1" data-track-kind="graphics" data-width="${W}" data-height="${H}"></div>
      ${hosts}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`;

mkdirSync(join(dir, "compositions"), { recursive: true });
writeFileSync(join(dir, "index.html"), index);
writeFileSync(join(dir, "compositions/chrome.html"), chromeFile());
for (const s of scenes) writeFileSync(join(dir, `compositions/${s.id}.html`), sceneFile(s));
console.log(`${scenes.length} scenes, ${total}s`);
