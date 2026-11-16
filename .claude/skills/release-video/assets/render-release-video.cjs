#!/usr/bin/env node
/**
 * Renders the release video from `aidd_docs/release-video/scenes.json`, locally, with no AI tool
 * involved: `node .claude/skills/release-video/assets/render-release-video.cjs --version 5.13 [--plan <file>] [--music <file>] [--out <file>]`, which also writes the thumbnail next to the video as a `.png`.
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
const VERSION_TYPING_FROM = 0.8, VERSION_TYPING_SECONDS = 1.1;
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
.row.del { color: #ff9aa8; background: rgba(255,107,107,.14); border-left: 4px solid #ff6b6b; padding-left: 14px; }
.row.add { color: #5ee6a8; background: rgba(94,230,168,.12); border-left: 4px solid #5ee6a8; padding-left: 14px; }
.diff .row { font-size: 27px; line-height: 1.35; }
.figs { display: flex; gap: 24px; margin-top: 18px; }
.fig { flex: 1; background: #0b0b36; border: 2px solid #26265f; border-radius: 16px; padding: 18px 28px; display: flex; flex-direction: column; gap: 6px; }
.fig b { font-size: 72px; font-weight: 800; line-height: 1; }
.fig .from { color: #ff9aa8; } .fig .arr { color: #8a8fc0; padding: 0 14px; } .fig .to { color: #5ee6a8; }
.fig small { font-family: "JetBrains Mono", monospace; font-size: 26px; color: #8a8fc0; }
.verdict { display: flex; align-items: center; gap: 24px; }
.verdict b { font-size: 44px; font-weight: 800; padding: 6px 30px; border: 3px solid currentColor; border-radius: 14px; }
.verdict span { color: #a6abe0; }
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
.wbar { display: block; height: 8px; border-radius: 4px; background: #26265f; overflow: hidden; margin-top: 10px; }
.wbar i { display: block; height: 100%; background: #ffd37a; transform: scaleX(0); transform-origin: left; }
.wcell { display: grid; }
.wpend { display: flex; align-items: center; gap: 16px; }
.wpend .wbar { flex: none; width: 180px; margin: 0; }
.wlog { display: grid; font-family: "JetBrains Mono", monospace; font-size: 24px; color: #a6abe0; min-height: 106px; }
.wpend, .wres { grid-area: 1 / 1; }
.wrun { grid-area: 1 / 1; display: flex; flex-direction: column; gap: 6px; }
.wst { display: inline-grid; } .wst > span { grid-area: 1 / 1; } .wfail { opacity: 0; } .wres { opacity: 0; }
.step .t { display: flex; align-items: center; gap: 16px; }
.step .p { font-family: "JetBrains Mono", monospace; font-size: 26px; padding: 8px 16px; border-radius: 10px; align-self: flex-start; background: rgba(255, 211, 122, 0.12); color: #ffd37a; border: 2px solid #7a6530; }
.arrow { align-self: center; font-size: 44px; color: #5b60a0; display: inline-grid; }
.arrow > span { grid-area: 1 / 1; } .arrow .bk { opacity: 0; font-weight: 800; }
.pr { flex: none; width: 250px; background: rgba(94, 230, 168, 0.1); border-color: #2f7a60; }
.split { display: flex; gap: 34px; align-items: stretch; }
.split .win { min-width: 0; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 24px; margin-top: 18px; }
.cell { background: #0b0b36; border: 2px solid #26265f; border-radius: 16px; padding: 32px 36px; display: flex; flex-direction: column; gap: 4px; }
.cell.wide { grid-column: span 2; }
.cell b { font-size: 44px; font-weight: 700; display: flex; align-items: center; gap: 18px; }
.ico { width: 48px; height: 48px; flex: none; fill: none; stroke: #5ee6a8; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.cell small { font-family: "JetBrains Mono", monospace; font-size: 30px; color: #8a8fc0; }
.avs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 34px 60px; margin-top: 20px; }
.av { display: flex; align-items: center; gap: 22px; }
.av img { width: 110px; height: 110px; border-radius: 50%; border: 3px solid #3a3a80; display: block; }
.av span { font-family: "JetBrains Mono", monospace; font-size: 32px; font-weight: 700; }
#intro .inner { flex-direction: row; align-items: center; justify-content: center; gap: 90px; }
#intro-logo { width: 420px; height: 420px; border-radius: 50%; border: 2px solid #2a2a66; }
#thumb .inner { flex-direction: row; align-items: center; justify-content: center; gap: 110px; }
#thumb #intro-logo { width: 560px; height: 560px; }
#thumb #ver { font-size: 330px; }
#thumb .intro-text { min-width: 0; gap: 30px; }
.themes { font-family: "JetBrains Mono", monospace; font-size: 38px; font-weight: 700; color: #a6abe0; white-space: nowrap; }
.intro-text { display: flex; flex-direction: column; gap: 22px; min-width: 720px; }
.intro-top { display: flex; align-items: center; gap: 22px; }
.rel { font-family: "JetBrains Mono", monospace; font-size: 28px; letter-spacing: 0.12em; color: #8a8fc0; }
#ver { font-size: 250px; line-height: 1; font-weight: 800; letter-spacing: -0.03em; white-space: nowrap; }
#ver .dot { color: #5ee6a8; }
.tagline { font-family: "JetBrains Mono", monospace; font-size: 40px; color: #a6abe0; }
.tagline b { color: #fff; font-weight: 700; }
.hls { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; margin-top: 10px; }
.hl { font-family: "JetBrains Mono", monospace; font-size: 42px; padding: 12px 28px; border-radius: 12px; border: 2px solid #3b4c99; color: #8aa6ff; }
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

const cellBody = (value) => {
  if (value?.status) return { cls: "", html: `<span class="done">${esc(value.status)}</span>` };
  if (value?.dim) return { cls: "dim", html: esc(value.dim) };
  if (value?.tone) return { cls: value.tone, html: esc(value.text) };
  return { cls: "", html: esc(value) };
};

/** A bar that fills while its step or row works. */
const BAR = `<span class="wbar"><i></i></span>`;

const isWork = (value) => value?.checking !== undefined || value?.result !== undefined;

/** A checked cell shows "checking…", or its own `pending` text, until its row is done; a result cell
 * shows nothing until then. */
const cell = (value) => {
  if (isWork(value)) {
    const checking = value.checking !== undefined;
    const { cls, html } = cellBody(checking ? value.checking : value.result);
    return (
      `<td><div class="wcell"><span class="wpend${checking ? " dim" : ""}">${checking ? `${esc(value.pending ?? "checking…")}${BAR}` : ""}</span>` +
      `<span class="wres${cls ? ` ${esc(cls)}` : ""}">${html}</span></div></td>`
    );
  }
  const { cls, html } = cellBody(value);
  return `<td${cls ? ` class="${esc(cls)}"` : ""}>${html}</td>`;
};

const row = {
  prompt: (r) => `<div class="row"><span class="grn">&gt;</span> ${esc(r.prompt)}</div>`,
  text: (r) => `<div class="row ${esc(r.tone ?? "")}">${esc(r.text)}</div>`,
  chips: (r) =>
    `<div class="row chips">${r.chips.map((c, i) => `<span class="chip c${(i % 4) + 1}">${esc(c)}</span>`).join("")}</div>`,
  table: (r) =>
    `<table class="row">${r.table.head ? `<thead><tr>${r.table.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` : ""}<tbody>` +
    r.table.rows.map((cells) => `<tr${cells.some(isWork) ? " data-w" : ""}>${cells.map(cell).join("")}</tr>`).join("") +
    `</tbody></table>`,
  del: (r) => `<div class="row del">- ${esc(r.del)}</div>`,
  add: (r) => `<div class="row add">+ ${esc(r.add)}</div>`,
  code: (r) => `<div class="row code">${esc(r.code)}</div>`,
  verdict: (r) => `<div class="row verdict ${esc(r.tone ?? "grn")}"><b>${esc(r.verdict)}</b><span>${esc(r.detail ?? "")}</span></div>`,
  check: (r) =>
    `<div class="row check"><span class="${r.mark === "!" ? "amb" : "grn"}">${esc(r.mark ?? "✓")}</span><span>${esc(r.check)}</span></div>`,
};

function rowHtml(r) {
  const kind = Object.keys(row).find((k) => k in r);
  if (!kind) throw new Error(`Unknown row: ${JSON.stringify(r)}`);
  const html = row[kind](r);
  return r.afterWork ? html.replace(/class="row([^"]*)"/, 'class="row$1 later"') : html;
}

const DOTS =
  '<i style="background:#ff6b6b"></i><i style="background:#ffd37a"></i><i style="background:#5ee6a8"></i>';

const windowHtml = ({ label, rows = [], flex, afterWork }) =>
  `<div class="win ${afterWork ? "then" : "it"}"${flex ? ` style="flex:${flex}"` : ""}><div class="bar">${DOTS}<span>${esc(label)}</span></div>` +
  `<div class="body">${rows.map(rowHtml).join("")}</div></div>`;

/** What a step does each time it works: its own runs, or its one log. */
const runsOf = (step) => step.runs ?? [{ log: step.log ?? [] }];
const runHtml = (run, j, back) =>
  `<span class="wrun" data-run="${j}">${run.log.map((l) => `<span class="wl">${esc(l)}</span>`).join("")}` +
  (run.fail ? `<span class="wl pnk">↩ back to ${esc(back.title)}</span>` : "") +
  `</span>`;

const flowHtml = (steps) =>
  `<div class="flow">` +
  steps
    .map((s, i) => {
      const runs = runsOf(s);
      const goesBack = runs.some((r) => r.fail);
      const arrow = i === 0 ? "" : goesBack ? `<span class="arrow it"><span class="fwd">→</span><span class="bk pnk">←</span></span>` : `<span class="arrow it">→</span>`;
      const status = goesBack
        ? `<span class="wst"><span class="wfail pnk">✗ sent back</span><span class="wres grn">✓ done</span></span>`
        : `<span class="wres grn">✓ done</span>`;
      const box = s.final
        ? `<div class="step pr it"><span class="n">&nbsp;</span><span class="t grn">${esc(s.title)}</span></div>`
        : `<div class="step it" data-w><span class="n">${esc(s.n)} ${status}</span>` +
          `<span class="t">${iconHtml(s.icon)}${esc(s.title)}</span><span class="p">${esc(s.sub)}</span>` +
          (s.log || s.runs ? `<span class="wlog">${runs.map((r, j) => runHtml(r, j, steps[i - 1])).join("")}</span>` : "") +
          `${BAR}</div>`;
      return arrow + box;
    })
    .join("") +
  `</div>`;

const noteHtml = (s) => (s.note ? `<p class="note fin">${esc(s.note)}</p>` : "");

/** A checked table row is timed by its work, not as a row. */
const rowsIn = (rows = []) => rows.reduce((n, r) => n + (r.table ? 1 + r.table.rows.filter((c) => !c.some(isWork)).length : 1), 0);

/** Rows are revealed one by one; the note comes after the last. */
const windowsOf = (s) => (s.window ? [s.window] : s.panels ?? [s.before, s.after].filter(Boolean));
const rowElements = (s) => windowsOf(s).filter((w) => !w.afterWork).reduce((n, w) => n + (w.rows ?? []).filter((r) => !r.afterWork).length, 0);
/** The rows of the panels that open once the work is done, then the rows that follow it. */
const thenRows = (s) => windowsOf(s).filter((w) => w.afterWork).reduce((n, w) => n + (w.rows ?? []).length, 0);
const laterRows = (s) => thenRows(s) + windowsOf(s).filter((w) => !w.afterWork).reduce((n, w) => n + (w.rows ?? []).filter((r) => r.afterWork).length, 0);
const hasThen = (s) => windowsOf(s).some((w) => w.afterWork);

const scene = {
  "terminal-demo": {
    items: (s) => rowsIn(s.window?.rows) + (s.flow ? 2 : 0),
    body: (s) => windowHtml(s.window) + (s.flow ? flowHtml(s.flow) : "") + noteHtml(s),
  },
  "before-after": {
    items: (s) => (s.figures ?? []).length + rowsIn(s.before?.rows) + rowsIn(s.after?.rows),
    body: (s) =>
      `<div class="figs">` +
      (s.figures ?? [])
        .map(
          (f) =>
            `<div class="fig it"><b><span class="from">${esc(f.from)}</span><span class="arr">→</span><span class="to">${esc(f.to)}</span></b><small>${esc(f.label)}</small></div>`
        )
        .join("") +
      `</div>` +
      `<div class="split diff">${windowHtml({ ...s.before, flex: 1 })}${windowHtml({ ...s.after, flex: 1 })}</div>` +
      noteHtml(s),
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
            `<div class="cell it${c.wide ? " wide" : ""}"><b>${iconHtml(c.icon)}${esc(c.title)}</b><small>${esc(c.detail ?? "")}</small></div>`
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
/** Each flow step and each checked row works in turn, once the scene is on screen: its bar fills,
 * then its result shows. */
const WORK = { step: { length: 1.6, fill: 1.2 }, row: { length: 0.75, fill: 0.55 }, together: 1.2 };
const WORK_MARK = / data-w(?=[ >])/g;

/** Each run in the order it plays, `k` the element it works on, numbered as the page draws them:
 * checked rows first, then flow steps. A failed run sends the work back to the step before it,
 * which runs again before the check retries. */
function workRuns(s) {
  const runs = [];
  let k = 0;
  for (const w of windowsOf(s))
    for (const r of w.rows ?? [])
      for (const cells of r.table?.rows ?? []) if (cells.some(isWork)) runs.push({ ...WORK.row, k: k++, together: Boolean(r.table.together) });
  const steps = (s.flow ?? []).filter((step) => !step.final).map((step) => ({ step, k: k++, next: 0 }));
  const go = (i) => {
    const { step, k: el } = steps[i];
    const run = steps[i].next++;
    const fail = Boolean(runsOf(step)[run]?.fail);
    if (!runsOf(step)[run]) throw new Error(`${step.title} has no run left`);
    runs.push({ ...WORK.step, k: el, run, fail });
    return fail;
  };
  for (let i = 0; i < steps.length; i++) while (go(i)) go(i - 1);
  return runs;
}

/** Each run with the time it starts at, one after the other. Rows installed together start at
 * once and end at once. */
const workPlan = (s, t) => {
  let at = workStart(s, t);
  let group = [];
  const plan = [];
  const close = () => {
    if (!group.length) return;
    group.forEach((run) => plan.push({ ...run, at: round2(at), fill: WORK.together }));
    at += WORK.together + 0.3;
    group = [];
  };
  for (const run of workRuns(s)) {
    if (run.together) {
      group.push(run);
      continue;
    }
    close();
    plan.push({ ...run, at: round2(at) });
    at += run.length;
  }
  close();
  return plan;
};
/** When the last run ends, or when the work would start if there is none. */
const workEnd = (s, t) => round2(Math.max(workStart(s, t), ...workPlan(s, t).map((r) => r.at + r.fill)));
const numberWork = (html) => {
  let k = 0;
  return html.replace(WORK_MARK, () => ` data-w="${k++}"`);
};

/** When the scene's work starts: after its last item and its last row are on screen. */
const workStart = (s, t) =>
  round2(t + Math.max(0.63 + 0.3 * itemsIn(scene[s.template].body(s)) + 0.4, 1.3 + 0.45 * rowElements(s) + 0.3));
/** A panel that follows the work opens once it is done, then its rows come one by one, then the
 * rows that follow the work. */
const laterAt = (s, t) => round2(workEnd(s, t) + 0.3);
const laterRowsAt = (s, t) => round2(laterAt(s, t) + (hasThen(s) ? 0.6 : 0));

/** A scene holds for a reading beat once its last item, row, note, run or later row is on screen. */
const READ = 2.5;
function sceneDuration(s) {
  if (!scene[s.template]) throw new Error(`Unknown template: ${s.template}`);
  const items = itemsIn(scene[s.template].body(s));
  const rows = rowElements(s);
  const shown = Math.max(
    items ? 0.63 + 0.3 * (items - 1) + 0.7 : 0,
    rows ? 1.3 + 0.45 * (rows - 1) + 0.5 : 0,
    s.note ? 1.3 + 0.45 * rows + 0.3 + 0.6 : 0,
    workPlan(s, 0).length ? workEnd(s, 0) : 0,
    laterRows(s) ? laterRowsAt(s, 0) + 0.45 * (laterRows(s) - 1) + 0.5 : 0
  );
  return half(shown + READ + (s.lead ? 0.5 : 0));
}

/** The icons a grid cell can show to say its intent, drawn on a 24-unit grid. */
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
  build: '<path d="M8 6l-6 6 6 6M16 6l6 6-6 6"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  review: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};

const iconHtml = (name) => {
  if (!name) return "";
  if (!ICONS[name]) throw new Error(`Unknown icon "${name}", one of ${Object.keys(ICONS).join(", ")}`);
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
};

const headHtml = (s, id) =>
  `<span class="pill" id="${id}-pill">${esc(s.pill)}</span>` +
  `<h2 id="${id}-h">${esc(s.title)}${s.accent ? ` <span class="g">${esc(s.accent)}</span>` : ""}</h2>` +
  (s.lead ? `<p class="lead" id="${id}-lead">${esc(s.lead)}</p>` : "");

/** An intro without tags or phrase opens on the thumbnail's themes, so the video starts as it is announced. */
const introThemes = (plan) => (plan.intro?.tagline || plan.intro?.highlights?.length ? [] : plan.youtube?.themes ?? []);

/** The tags say what the release brings; the phrase above them is optional, and only an intro with
 * neither tags nor themes keeps a default one. */
const hasTagline = (plan) => Boolean(plan.intro?.tagline) || (!plan.intro?.highlights?.length && !introThemes(plan).length);

/** The version is typed in by the timeline: until it starts, nothing of it is on screen. */
function introHtml(plan) {
  const intro = plan.intro ?? {};
  const themes = introThemes(plan);
  const tagline = intro.tagline ? esc(intro.tagline) : "What's new, <b>end to end.</b>";
  const highlights = (intro.highlights ?? []).map((h) => `<span class="hl it">${esc(h)}</span>`).join("");
  return (
    `<img id="intro-logo" src="assets/logo.png" alt="" /><div class="intro-text">` +
    `<div class="intro-top"><span class="pill" id="intro-pill">AIDD Framework</span><span class="rel" id="intro-rel">NEW RELEASE</span></div>` +
    `<div id="ver"><span id="ver-t"></span><span class="dot"></span><span id="ver-n"></span></div>` +
    (hasTagline(plan) ? `<p class="tagline" id="intro-tag">${tagline}</p>` : "") +
    (themes.length ? `<p class="themes" id="intro-themes">${themes.map(esc).join(" · ")}</p>` : "") +
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
 * opens, a tick for its pill and lead, a pop for its title, window, items and note, a click per row,
 * a key tick per typed character. */
function soundCues(plan, { version }) {
  const cues = [];
  const cue = (kind, t) => cues.push({ kind, t: round2(t) });
  const chars = String(version).length + 1;
  cue("pop", 0.1);
  cue("tick", 0.4);
  cue("tick", 0.55);
  for (let k = 0; k < chars; k++) cue("key", 0.8 + (1.1 * k) / chars);
  if (hasTagline(plan) || introThemes(plan).length) cue("pop", 2.0);
  (plan.intro?.highlights ?? []).forEach((_, k) => cue("pop", (hasTagline(plan) ? 2.6 : 2) + 0.3 * k));

  let t = introSeconds(plan);
  for (const s of plan.scenes) {
    cue("whoosh", t);
    cue("tick", t + 0.14);
    cue("pop", t + 0.28);
    if (s.lead) cue("tick", t + 0.5);
    for (let k = 0; k < itemsIn(scene[s.template].body(s)); k++) cue("pop", t + 0.63 + 0.3 * k);
    for (let k = 0; k < rowElements(s); k++) cue("click", t + 1.3 + 0.45 * k);
    if (s.note) cue("pop", t + 1.3 + 0.45 * rowElements(s) + 0.3);
    const plan = workPlan(s, t);
    plan.forEach((unit, i) => {
      if (i === 0 || plan[i - 1].at !== unit.at) cue("tick", unit.at);
      if (i === 0 || plan[i - 1].at + plan[i - 1].fill !== unit.at + unit.fill) cue("pop", unit.at + unit.fill);
    });
    if (laterRows(s)) {
      if (hasThen(s)) cue("pop", laterAt(s, t));
      for (let k = 0; k < laterRows(s); k++) cue("click", laterRowsAt(s, t) + 0.45 * k);
    }
    t += sceneDuration(s);
  }
  cue("pop", t + 0.07);
  cue("pop", t + 0.28);
  for (let k = 0; k < 2; k++) cue("pop", t + 0.63 + 0.2 * k);
  return cues.sort((a, b) => a.t - b.t);
}

const SFX_RATE = 44100;
const frames = (seconds) => Math.round(seconds * SFX_RATE);

/** Deterministic noise, so two renders of one plan sound the same. */
const noise = (seed) => {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2147483648 - 1;
  };
};

const onePole = (samples, hz) => {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / SFX_RATE);
  let y = 0;
  return samples.map((v) => (y += a * (v - y)));
};

/** A soft struck tone: a sine and a short inharmonic partial, like glass. */
const ping = (hz, seconds, decay) =>
  Float64Array.from({ length: frames(seconds) }, (_, i) => {
    const x = i / SFX_RATE;
    const tone = Math.sin(2 * Math.PI * hz * x) + 0.35 * Math.sin(2 * Math.PI * hz * 2.76 * x) * Math.exp(-x * 30);
    return 0.5 * tone * Math.exp(-x * decay) * Math.min(1, x * 1000, (seconds - x) * 100);
  });

/** Air that turns from dark to bright while it swells and fades. */
const whoosh = () => {
  const seconds = 0.45;
  const random = noise(7);
  const air = Array.from({ length: frames(seconds) }, random);
  const dark = onePole(air, 900);
  const low = onePole(air, 1500);
  const bright = onePole(air.map((v, i) => v - low[i]), 7000);
  return Float64Array.from(air, (_, i) => {
    const u = i / air.length;
    return 0.9 * (dark[i] * (1 - u) + bright[i] * u) * Math.sin(Math.PI * u) ** 2;
  });
};

/** Each sound is a short soft tone or a breath of air, never a chip-tune blip. */
const SOUNDS = {
  key: () => ping(2600, 0.06, 60),
  tick: () => ping(2000, 0.09, 60),
  click: () => ping(1500, 0.08, 40),
  pop: () => ping(880, 0.3, 11),
  whoosh,
};

/** The sounds of the cues, laid on a silent mono 16-bit wav as long as the video. */
function soundTrack(plan, { version }) {
  const total = Math.round(totalDuration(plan) * SFX_RATE);
  const mix = new Float64Array(total);
  const made = {};
  for (const { kind, t } of soundCues(plan, { version })) {
    const sound = (made[kind] ??= SOUNDS[kind]());
    const from = Math.round(t * SFX_RATE);
    for (let i = 0; i < sound.length && from + i < total; i++) mix[from + i] += sound[i];
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
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i] * 0.8)) * 32767), 44 + 2 * i);
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

  open("intro", introSeconds(plan), introHtml(plan));
  script.push(
    `enter("#intro-logo", 0.1, { y: 0, scale: 0.85, duration: 0.9 });`,
    `enter("#intro-pill", 0.4, { y: 20 });`,
    `enter("#intro-rel", 0.55, { y: 20 });`,
    `const typed = { n: 0 }; const full = ${JSON.stringify(String(version))};`,
    `tl.to(typed, { n: 1, duration: ${VERSION_TYPING_SECONDS}, ease: "none", onUpdate: () => { const len = Math.round(typed.n * (full.length + 1));` +
      ` const [a, b = ""] = full.split(".");` +
      ` document.getElementById("ver-t").textContent = ("v" + a).slice(0, Math.min(len, a.length + 1));` +
      ` document.querySelector("#ver .dot").textContent = len > a.length + 1 ? "." : "";` +
      ` document.getElementById("ver-n").textContent = len > a.length + 1 ? b.slice(0, len - a.length - 1) : ""; } }, ${VERSION_TYPING_FROM});`,
    ...(hasTagline(plan) ? [`enter("#intro-tag", 2.0, { y: 20 });`] : []),
    ...(introThemes(plan).length ? [`enter("#intro-themes", 2.0, { y: 20 });`] : []),
    `enter("#intro .hl", ${hasTagline(plan) ? 2.6 : 2}, { y: 16, duration: 0.5, stagger: 0.3 });`,
    `cut("intro", ${introSeconds(plan)});`
  );
  t += introSeconds(plan);

  plan.scenes.forEach((s, i) => {
    const id = `s${i + 1}`;
    const duration = sceneDuration(s);
    open(id, duration, headHtml(s, id) + numberWork(scene[s.template].body(s)));
    script.push(
      `enter("#${id}-pill", ${t} + 0.14, { y: 20 });`,
      `enter("#${id}-h", ${t} + 0.28);`,
      ...(s.lead ? [`enter("#${id}-lead", ${t} + 0.5, { y: 20 });`] : []),
      `enter("#${id} .it", ${t} + 0.63, { y: 30, duration: 0.7, stagger: 0.3 });`,
      `enter("#${id} .win:not(.then) .row:not(.later)", ${t} + 1.3, { y: 14, duration: 0.5, stagger: 0.45 });`,
      ...(s.note ? [`enter("#${id} .fin", ${Math.round((t + 1.3 + 0.45 * rowElements(s) + 0.3) * 100) / 100}, { y: 10 });`] : []),
      ...workPlan(s, t).map((unit) => `work("#${id}", ${unit.k}, ${unit.at}, ${unit.fill}, ${unit.run ?? 0}, ${Boolean(unit.fail)});`),
      ...(hasThen(s)
        ? [`enter("#${id} .then", ${laterAt(s, t)}, { y: 30, duration: 0.7 });`, `enter("#${id} .then .row", ${laterRowsAt(s, t)}, { y: 14, duration: 0.5, stagger: 0.45 });`]
        : []),
      ...(laterRows(s) > thenRows(s)
        ? [`enter("#${id} .row.later", ${round2(laterRowsAt(s, t) + 0.45 * thenRows(s))}, { y: 14, duration: 0.5, stagger: 0.45 });`]
        : []),
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
const work = (scene, k, at, fill, run, fail) => {
  const unit = scene + ' [data-w="' + k + '"]';
  const all = (sel) => document.querySelectorAll(sel).length > 0;
  const before = document.querySelector(scene + ' .step[data-w="' + k + '"]')?.previousElementSibling;
  const back = before && before.querySelector(".bk") ? before : null;
  if (run > 0) {
    tl.set(unit + " .wbar i", { scaleX: 0, backgroundColor: "#ffd37a" }, at);
    tl.to(unit + ' .wrun[data-run="' + (run - 1) + '"]', { opacity: 0, duration: 0.2 }, at);
    if (all(unit + " .wfail")) tl.to(unit + " .wfail", { opacity: 0, duration: 0.2 }, at);
    if (all(unit + " .wres")) tl.to(unit + " .wres", { opacity: 0, duration: 0.2 }, at);
    if (back) tl.to(back.querySelector(".bk"), { opacity: 0, duration: 0.2 }, at);
    if (back) tl.to(back.querySelector(".fwd"), { opacity: 1, duration: 0.2 }, at);
  }
  if (all(unit + " .wbar i")) tl.to(unit + " .wbar i", { scaleX: 1, duration: fill, ease: "none" }, at);
  const lines = unit + ' .wrun[data-run="' + run + '"] .wl';
  const count = document.querySelectorAll(lines).length;
  if (count) tl.from(lines, { opacity: 0, x: -14, duration: 0.25, ease, stagger: fill / count }, at);
  if (all(unit + " .ico")) tl.to(unit + " .ico", { scale: 1.25, duration: fill / 4, yoyo: true, repeat: 3, ease: "sine.inOut" }, at);
  if (all(scene + ' .step[data-w="' + k + '"]')) {
    const color = fail ? "#ff8fa8" : "#5ee6a8";
    tl.to(scene + ' .step[data-w="' + k + '"]', { borderColor: "#ffd37a", duration: 0.2 }, at);
    tl.to(scene + ' .step[data-w="' + k + '"]', { borderColor: color, duration: 0.2 }, at + fill);
    tl.to(unit + " .wbar i", { backgroundColor: color, duration: 0.2 }, at + fill);
  }
  if (all(unit + " .wpend")) tl.to(unit + " .wpend", { opacity: 0, duration: 0.2 }, at + fill);
  if (fail && back) {
    tl.to(back.querySelector(".fwd"), { opacity: 0, duration: 0.2 }, at + fill);
    tl.to(back.querySelector(".bk"), { opacity: 1, duration: 0.2 }, at + fill);
    tl.fromTo(back.querySelector(".bk"), { x: 12 }, { x: -12, duration: 0.4, repeat: 3, yoyo: true, ease: "sine.inOut", immediateRender: false }, at + fill);
  }
  if (fail) tl.to(unit + " .wfail", { opacity: 1, duration: 0.3 }, at + fill);
  else if (all(unit + " .wres")) tl.fromTo(unit + " .wres", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease, immediateRender: false }, at + fill);
};
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
const LOUD_ABOVE_MEDIAN = 3;

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

/** The hook whole from the start, so no phrase is cut where a short intro ends; the bed under the
 * scenes and the outro, the small ending last. */
function musicSegments(sections, { total }) {
  const head = { part: "head", from: sections.headStart, length: sections.headEnd - sections.headStart, at: 0 };
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
  const [head, body, tail] = musicSegments(sections, { total });
  const bed = sections.tailStart - sections.headEnd;
  const cut = (seg, label, fades) =>
    `[0:a]aresample=48000,atrim=start=${seg.from}:duration=${seg.length},asetpts=PTS-STARTPTS${fades}[${label}]`;
  const loopedBed =
    `[0:a]aresample=48000,atrim=start=${body.from}:duration=${Math.min(bed, body.length)},asetpts=PTS-STARTPTS,` +
    `aloop=loop=-1:size=${Math.ceil(bed * 48000)},atrim=duration=${body.length},asetpts=PTS-STARTPTS[b]`;
  const filter = [
    cut(head, "h", `,afade=t=in:d=0.05`),
    loopedBed,
    cut(tail, "t", `,afade=t=in:d=0.05`),
    `[h][b][t]concat=n=3:v=0:a=1,apad=whole_dur=${total},atrim=duration=${total}[a]`,
  ].join(";");
  ffmpeg(["-i", source, "-filter_complex", filter, "-map", "[a]", "-c:a", "libmp3lame", "-q:a", "2", target]);
}

/** What a Hyperframes project needs around its page: the fonts, the logo and the project files. */
function writeShell(dir) {
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  fs.cpSync(path.join(__dirname, "fonts"), path.join(dir, "assets/fonts"), { recursive: true });
  fs.copyFileSync(path.join(__dirname, "logo.png"), path.join(dir, "assets/logo.png"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "release-video", private: true, type: "module" })
  );
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ id: "release-video", name: "release-video" }));
  fs.writeFileSync(path.join(dir, "hyperframes.json"), JSON.stringify({ paths: { assets: "assets" } }));
}

function writeProject(dir, plan, version, musicSource) {
  writeShell(dir);
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

  const still = fs.mkdtempSync(path.join(os.tmpdir(), "release-thumbnail-"));
  writeShell(still);
  fs.writeFileSync(path.join(still, "index.html"), thumbnailHtml(plan, { version }));
  // A lossless frame at full size: an encoded and downscaled one blurs the logo and the type.
  const stillRender = spawnSync("npx", ["--yes", HYPERFRAMES, "render", "--format", "png-sequence", "--output", "frames"], { cwd: still, stdio: "inherit" });
  if (stillRender.status !== 0) throw new Error(`Hyperframes render of the thumbnail failed (${stillRender.status})`);
  const [first] = fs.readdirSync(path.join(still, "frames")).filter((f) => f.endsWith(".png")).sort();
  if (!first) throw new Error("The thumbnail render wrote no frame");
  const thumbnail = out.replace(/\.mp4$/, ".png");
  fs.copyFileSync(path.join(still, "frames", first), thumbnail);
  console.log(`✅ ${thumbnail}`);

  const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=bit_rate", "-of", "csv=p=0", out], { encoding: "utf8" });
  const bitrate = Number(probe.stdout.trim());
  if (!bitrate) throw new Error("The bitrate of the video could not be read");
  const posted = out.replace(/\.mp4$/, ".poster.mp4");
  const withPoster = spawnSync("ffmpeg", posterArgs({ video: out, poster: thumbnail, out: posted, bitrate }), { stdio: "inherit" });
  if (withPoster.status !== 0) throw new Error(`The thumbnail could not be put first (${withPoster.status})`);
  fs.renameSync(posted, out);
}

/** The picture a video is announced with, drawn as its own still composition rather than taken from a frame
 * of the video: the logo, the release and the whole version, then the themes. */
function thumbnailHtml(plan, { version }) {
  const [major, minor = ""] = String(version).split(".");
  const themes = plan.youtube?.themes ?? [];
  const inner =
    `<img id="intro-logo" src="assets/logo.png" alt="" /><div class="intro-text">` +
    `<div class="intro-top"><span class="pill">AIDD Framework</span><span class="rel">NEW RELEASE</span></div>` +
    `<div id="ver"><span id="ver-t">v${esc(major)}</span><span class="dot">${minor ? "." : ""}</span><span id="ver-n">${esc(minor)}</span></div>` +
    (themes.length ? `<p class="themes">${themes.map(esc).join(" · ")}</p>` : "") +
    `</div>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=1920, height=1080" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>${CSS}</style></head>
<body><div id="root" data-composition-id="main" data-start="0" data-duration="1" data-width="1920" data-height="1080">
<section id="thumb" class="scene clip" data-start="0" data-duration="1" data-track-index="0"><div class="inner">${inner}</div></section>
</div>
<script>
window.__timelines = window.__timelines || {};
window.__timelines["main"] = gsap.timeline({ paused: true });
</script></body></html>
`;
}

/** The video opens on its thumbnail for one frame: a chat shows a video's first frame as its preview, and the
 * intro starts on the bare background. The video is encoded again at its own bitrate, and its sound is delayed
 * by that frame. */
function posterArgs({ video, poster, out, bitrate }) {
  const kbps = Math.round(bitrate / 1000);
  return [
    "-y", "-v", "error",
    "-loop", "1", "-framerate", "30", "-t", "0.0334", "-i", poster,
    "-i", video,
    "-filter_complex",
    "[0:v]scale=1920:1080,setsar=1,fps=30,format=yuv420p[p];[1:v]setsar=1,fps=30,format=yuv420p[v];[p][v]concat=n=2:v=1:a=0[vo];[1:a]adelay=34|34[ao]",
    "-map", "[vo]", "-map", "[ao]",
    "-c:v", "libx264", "-profile:v", "high", "-b:v", `${kbps}k`, "-maxrate", `${Math.round(kbps * 1.25)}k`, "-bufsize", `${kbps * 2}k`, "-preset", "slow",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
    out,
  ];
}

module.exports = { buildHtml, measureRms, musicSections, musicSegments, sceneDuration, soundCues, posterArgs, soundTrack, thumbnailHtml, totalDuration };

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  });
}
