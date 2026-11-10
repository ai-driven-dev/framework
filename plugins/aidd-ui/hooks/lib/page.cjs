// The comparison page of a set of variants: one file, opened as a file, with no server and no request.
const { createHash } = require("node:crypto");

const STATE_ATTRIBUTE = /data-state="([^"]+)"/g;
const HTML_FILE = /\.html$/;
const STYLESHEET_LINK = '<link rel="stylesheet" href="../tokens.css">'; // how a render loads the tokens
const VERDICTS = [["keep", "Keep", "✓"], ["revise", "Revise", "↻"], ["discard", "Discard", "✕"]];
const SHORTCUTS = [["K", "Keep the variant"], ["R", "Revise the variant"], ["D", "Discard the variant"], ["←→", "Previous or next variant"], ["C", "Copy the feedback"], ["?", "Show or hide this sheet"], ["Esc", "Close this sheet"]];
const LEGEND = [["keep", "Keep"], ["revise", "Revise"], ["discard", "Discard"], ["", "Undecided"]];

/** The feedback a person gives, from the page's state: the format the page copies. The page
 * carries this source as it stands, so it uses nothing outside itself. */
function feedbackOf(state) {
  return {
    set: state.set,
    variants: state.variants.map((variant) => ({
      name: variant.name,
      verdict: variant.verdict || null,
      comment: String(variant.comment ?? "").trim(),
    })),
  };
}

/** What Copy hands over: the feedback as 2-space JSON in a json fence. Carried like `feedbackOf`. */
function copiedOf(state) {
  return "```json\n" + JSON.stringify(feedbackOf(state), null, 2) + "\n```\n";
}

/** `text` as HTML text or as an attribute value. */
const escaped = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const options = (values, empty) => [...(empty === undefined ? [] : [`<option value="">${empty}</option>`]), ...values.map((value) => `<option value="${escaped(String(value))}">${escaped(String(value))}</option>`)].join("");

const STYLE = `
:root { --bg: #ffffff; --text: #171717; --muted: #595959; --line: #e5e5e5; --canvas: #ededed; --dot: #d0d0d0; --hover: #f5f5f5; --press: #ebebeb; --pill: #f0f0f0; --pill-text: #404040; --kbd-line: #d0d0d0; --title: #f6f6f6; --win: #ffffff; --win-line: #d4d4d4; --track: #ececec;
  --accent: #1d4ed8; --on-accent: #ffffff; --accent-hover: #1e40af; --accent-text: #1d4ed8; --ring: #1d4ed8; --sel: #eaf0ff; --sel-line: #c7d6fb;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.08), 0 10px 28px rgba(0, 0, 0, 0.1);
  --doc-bg: #ffffff; --doc-text: #1f1f1f; --doc-muted: #595959; --doc-line: #e0e0e0; --doc-chip: #f0f0f0; --doc-chip-text: #404040;
  --keep-bg: #dcfce7; --keep-fg: #166534; --keep-dot: #16a34a; --revise-bg: #fef3c7; --revise-fg: #854d0e; --revise-dot: #d97706; --discard-bg: #fee2e2; --discard-fg: #991b1b; --discard-dot: #dc2626; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #0f0f0f; --text: #ededed; --muted: #a3a3a3; --line: #2a2a2a; --canvas: #1b1b1b; --dot: #2c2c2c; --hover: #1a1a1a; --press: #242424; --pill: #232323; --pill-text: #cfcfcf; --kbd-line: #3d3d3d; --title: #272727; --win: #141414; --win-line: #3d3d3d; --track: #1f1f1f;
    --accent: #2563eb; --accent-hover: #3b73f0; --accent-text: #93c5fd; --ring: #60a5fa; --sel: #1e2d52; --sel-line: #34498a;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 12px 32px rgba(0, 0, 0, 0.55);
    --doc-bg: #141414; --doc-text: #ededed; --doc-muted: #a3a3a3; --doc-line: #333333; --doc-chip: #232323; --doc-chip-text: #cfcfcf;
    --keep-bg: #12301c; --keep-fg: #86efac; --keep-dot: #4ade80; --revise-bg: #3a2a0a; --revise-fg: #fcd34d; --revise-dot: #fbbf24; --discard-bg: #3b1313; --discard-fg: #fca5a5; --discard-dot: #f87171; }
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { font: 13px/1.5 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; height: 100vh; display: grid; grid-template: 48px minmax(0, 1fr) / 15rem minmax(0, 1fr) 18rem; grid-template-areas: "top top top" "list canvas inspector"; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
header, nav, aside, .toolbar { color-scheme: light dark; background: var(--bg); color: var(--text); min-width: 0; }
header { grid-area: top; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid var(--line); }
nav { grid-area: list; border-right: 1px solid var(--line); overflow: auto; padding: 16px 8px; }
aside { grid-area: inspector; border-left: 1px solid var(--line); overflow: auto; display: flex; flex-direction: column; padding: 20px 12px 0; }
h1 { font-size: 13px; font-weight: 600; margin: 0; white-space: nowrap; }
.mark { width: 16px; height: 16px; border-radius: 4px; background: var(--accent); flex: none; }
.brand { display: flex; align-items: center; gap: 8px; min-width: 0; }
.pill { background: var(--pill); color: var(--pill-text); border-radius: 999px; padding: 0 8px; font-size: 12px; line-height: 20px; white-space: nowrap; }
.end { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.progress { display: flex; align-items: center; gap: 8px; color: var(--muted); white-space: nowrap; }
.bar { width: 64px; height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
.bar i { display: block; height: 100%; width: 0; background: var(--accent); transition: width 120ms, background-color 120ms; }
.progress.complete .bar i { background: var(--keep-dot); }
#done { color: var(--keep-fg); font-weight: 600; }
button { font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; min-width: 24px; min-height: 28px; padding: 0 12px; cursor: pointer; transition: background-color 120ms, border-color 120ms, color 120ms; }
button:hover { background: var(--hover); }
button:active { background: var(--press); }
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
#help { width: 28px; padding: 0; font-weight: 600; color: var(--muted); }
#copy { display: inline-flex; align-items: center; gap: 8px; background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 600; }
#copy:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
#copy kbd { color: var(--on-accent); background: rgba(0, 0, 0, 0.22); border-color: rgba(255, 255, 255, 0.45); }
kbd { font: 11px/16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; display: inline-block; min-width: 18px; padding: 0 4px; text-align: center; color: var(--pill-text); background: var(--bg); border: 1px solid var(--kbd-line); border-radius: 4px; }
#sheet { position: fixed; top: 52px; right: 16px; left: auto; margin: 0; width: 18rem; padding: 16px; color: var(--text); background: var(--bg); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow); }
#sheet:focus-visible { outline: none; }
#sheet .caption { margin: 0 0 12px; }
.keys { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.keys li { display: flex; align-items: center; gap: 12px; }
.keys kbd { flex: none; min-width: 36px; }
#sheet .note { margin: 12px 0 0; padding-top: 12px; border-top: 1px solid var(--line); color: var(--muted); }
.caption { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin: 0 8px 8px; }
.pick { display: flex; align-items: flex-start; gap: 8px; width: 100%; height: auto; min-height: 44px; padding: 6px 8px; margin-bottom: 2px; text-align: left; border-color: transparent; background: transparent; }
.pick:hover { background: var(--hover); }
.pick[aria-current="true"] { background: var(--sel); border-color: var(--sel-line); }
.dot { flex: none; width: 10px; height: 10px; margin-top: 5px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--muted); }
.pick[data-verdict="keep"] .dot, .dot[data-verdict="keep"] { background: var(--keep-dot); box-shadow: none; }
.pick[data-verdict="revise"] .dot, .dot[data-verdict="revise"] { background: var(--revise-dot); box-shadow: none; }
.pick[data-verdict="discard"] .dot, .dot[data-verdict="discard"] { background: var(--discard-dot); box-shadow: none; }
.txt { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.line { display: flex; align-items: center; gap: 6px; }
.name { font-weight: 600; }
.word { margin-left: auto; font-size: 12px; color: var(--muted); }
.badge, .slot { font-size: 10px; font-weight: 600; line-height: 14px; min-width: 14px; text-align: center; border-radius: 4px; color: var(--accent-text); box-shadow: inset 0 0 0 1px var(--accent-text); }
.badge:empty, .slot:empty { display: none; }
.intent { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pick.gone .name { color: var(--muted); font-weight: 400; text-decoration: line-through; }
.legend { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; margin: 16px 8px 0; padding: 12px 0 0; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }
.legend li { display: flex; align-items: center; gap: 8px; }
.legend .dot { margin: 0; width: 8px; height: 8px; }
.hint { margin: 12px 8px 0; color: var(--muted); font-size: 12px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
#canvas { grid-area: canvas; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: var(--canvas); color: var(--text); }
.toolbar { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 8px 16px; border-bottom: 1px solid var(--line); }
.tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-left: auto; }
.seg { display: flex; border-radius: 8px; padding: 2px; gap: 2px; background: var(--track); }
.seg button { flex: 1; border: 0; background: transparent; color: var(--muted); min-height: 28px; padding: 0 12px; border-radius: 6px; white-space: nowrap; }
.seg button:hover { background: var(--hover); color: var(--text); }
.seg button:active { background: var(--press); }
.seg button[aria-pressed="true"] { background: var(--bg); color: var(--text); box-shadow: 0 0 0 1px var(--line), 0 1px 2px rgba(0, 0, 0, 0.12); }
.sel { position: relative; display: flex; align-items: center; gap: 8px; color: var(--muted); white-space: nowrap; }
.sel::after { content: "▾"; position: absolute; right: 8px; bottom: 5px; font-size: 11px; color: var(--muted); pointer-events: none; }
select { appearance: none; -webkit-appearance: none; font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; min-height: 28px; padding: 0 24px 0 8px; cursor: pointer; }
select:hover { background: var(--hover); }
.stage { flex: 1; min-height: 0; overflow: auto; padding: 24px; display: flex; gap: 24px; align-items: flex-start; background-image: radial-gradient(var(--dot) 1px, transparent 1px); background-size: 16px 16px; }
.variant { flex: 1 1 0; min-width: 0; }
.win { background: var(--win); border-radius: 10px; box-shadow: 0 0 0 1px var(--win-line), var(--shadow); overflow: hidden; }
#canvas[data-up="2"] .variant.current .win { box-shadow: 0 0 0 2px var(--accent), var(--shadow); }
.title { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; background: var(--title); border-bottom: 1px solid var(--win-line); color: var(--muted); font-size: 12px; }
.title::before { content: ""; flex: none; width: 8px; height: 8px; margin-right: 28px; border-radius: 50%; background: var(--win-line); box-shadow: 14px 0 0 var(--win-line), 28px 0 0 var(--win-line); }
.title b { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vpill { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; padding: 0 8px; border-radius: 999px; font-size: 12px; line-height: 20px; white-space: nowrap; background: var(--pill); color: var(--pill-text); }
.vpill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--muted); }
.vpill[data-verdict="keep"] { background: var(--keep-bg); color: var(--keep-fg); }
.vpill[data-verdict="revise"] { background: var(--revise-bg); color: var(--revise-fg); }
.vpill[data-verdict="discard"] { background: var(--discard-bg); color: var(--discard-fg); }
.vpill[data-verdict="keep"]::before { background: var(--keep-dot); box-shadow: none; }
.vpill[data-verdict="revise"]::before { background: var(--revise-dot); box-shadow: none; }
.vpill[data-verdict="discard"]::before { background: var(--discard-dot); box-shadow: none; }
.file + .file { border-top: 1px solid var(--win-line); }
.path { margin: 0; padding: 4px 12px; background: var(--title); border-bottom: 1px solid var(--win-line); color: var(--muted); font: 11px/16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.none { margin: 0; padding: 48px 16px; text-align: center; color: var(--muted); }
.shot { display: flex; justify-content: center; overflow: hidden; background: var(--win); }
iframe { flex: none; width: 1280px; height: 800px; border: 0; background: #fff; display: block; transform-origin: 50% 0; }
.zoom { margin-left: auto; font-variant-numeric: tabular-nums; }
.zoom:not([hidden]) + .vpill { margin-left: 0; }
.page { background: var(--doc-bg); color: var(--doc-text); padding: 28px 32px; font-size: 15px; line-height: 1.6; }
.doc { max-width: 68ch; margin-inline: auto; }
.doc h1 { font-size: 24px; line-height: 1.25; margin: 0 0 12px; font-weight: 600; }
.doc h2 { font-size: 18px; line-height: 1.3; margin: 24px 0 8px; font-weight: 600; }
.doc h3 { font-size: 15px; margin: 20px 0 6px; font-weight: 600; }
.doc p, .doc ul { margin: 0 0 12px; }
.doc ul { padding-left: 20px; }
.doc code { font: 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--doc-chip); border-radius: 4px; padding: 1px 5px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 16px; }
.chip { font-size: 12px; line-height: 20px; padding: 0 8px; border-radius: 999px; background: var(--doc-chip); color: var(--doc-chip-text); }
.chip .key { color: var(--doc-muted); margin-right: 6px; }
.scroll { overflow-x: auto; margin: 0 0 12px; }
.doc table { border-collapse: collapse; width: 100%; font-size: 13px; }
.doc th, .doc td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--doc-line); vertical-align: top; }
.doc th { font-weight: 600; color: var(--doc-muted); font-size: 12px; }
.panel .caption { margin: 0 0 8px; }
.panel h2 { font-size: 16px; font-weight: 600; margin: 0 0 4px; }
.panel > p:not(.caption) { margin: 0 0 12px; color: var(--muted); }
dl { display: grid; grid-template-columns: max-content 1fr; margin: 0 0 20px; border-top: 1px solid var(--line); }
dt, dd { margin: 0; padding: 6px 0; border-bottom: 1px solid var(--line); }
dt { color: var(--muted); padding-right: 16px; }
.panel .seg { margin: 0 0 20px; }
.panel .seg button { display: inline-flex; align-items: center; justify-content: center; gap: 3px; padding: 0; min-width: 0; color: var(--text); }
.panel .seg button:hover { background: var(--hover); }
.panel .seg button span { margin-right: 0; }
.panel .seg button kbd { margin-left: 2px; min-width: 16px; padding: 0 3px; }
.panel .seg button[aria-pressed="true"] { font-weight: 600; box-shadow: none; }
.seg button[data-verdict="keep"][aria-pressed="true"] { background: var(--keep-bg); color: var(--keep-fg); }
.seg button[data-verdict="revise"][aria-pressed="true"] { background: var(--revise-bg); color: var(--revise-fg); }
.seg button[data-verdict="discard"][aria-pressed="true"] { background: var(--discard-bg); color: var(--discard-fg); }
label.field { display: block; }
label.field > span { display: block; margin-bottom: 6px; }
textarea { width: 100%; font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 8px; resize: vertical; }
textarea::placeholder { color: var(--muted); opacity: 1; }
.foot { margin-top: auto; position: sticky; bottom: 0; background: var(--bg); border-top: 1px solid var(--line); padding: 12px 0 16px; }
summary { cursor: pointer; color: var(--muted); min-height: 24px; }
details textarea { font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin-top: 8px; }
@media (max-width: 900px) {
  body { height: auto; display: block; }
  header { flex-wrap: wrap; padding: 8px 16px; min-height: 48px; }
  .end { margin-left: 0; width: 100%; flex-wrap: wrap; }
  .progress { flex-wrap: wrap; }
  #copy { margin-left: auto; }
  #sheet { left: 16px; width: auto; }
  nav { border-right: 0; border-bottom: 1px solid var(--line); padding: 12px 16px; }
  nav .list { display: flex; gap: 8px; overflow-x: auto; }
  .pick { width: 12rem; flex: none; margin: 0; }
  .caption, .hint, .legend { margin-inline: 0; }
  .tools { margin-left: 0; }
  #canvas { display: block; }
  .stage { flex-direction: column; align-items: stretch; padding: 16px; }
  aside { border-left: 0; border-top: 1px solid var(--line); }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

// Runs in the page. The names it reads are the ones `pageOf` writes.
const SCRIPT = `
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const picks = $$(".pick");
const sections = $$("#canvas .variant");
const panels = $$(".panel");
const frames = $$("iframe");
const modes = $$(".mode");
const canvas = $("#canvas");
const out = $("#feedback");
const state = $("#state");
const theme = $("#theme");
const copy = $("#copy");
const label = $("#copy .label");
const fill = $("#fill");
const progress = $("#progress");
const done = $("#done");
const help = $("#help");
const sheet = $("#sheet");
const WORDS = { keep: "Keep", revise: "Revise", discard: "Discarded" };
const KEYS = { k: "keep", r: "revise", d: "discard" };
let current = 0;
let paired = -1;
let view = $(".mode[data-view][aria-pressed='true']").dataset.view;
let up = 1;
let device = "desktop";
const VIEWPORTS = { desktop: [1280, 800], mobile: [390, 844] };
const pairOf = () => (up < 2 || panels.length < 2 ? -1 : paired >= 0 && paired !== current ? paired : current + 1 < panels.length ? current + 1 : current - 1);
const slotOf = (i, pair) => (pair < 0 ? "" : i === current ? "A" : i === pair ? "B" : "");
const stateOf = () => ({
  set: SET,
  variants: panels.map((el) => ({ name: el.dataset.name, verdict: el.dataset.verdict, comment: $(".comment", el).value })),
});
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ verdicts: panels.map((el) => el.dataset.verdict), comments: panels.map((el) => $(".comment", el).value), current, paired, view, up, device }));
  } catch {}
};
const restore = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (!saved) return;
    panels.forEach((el, i) => {
      el.dataset.verdict = saved.verdicts[i];
      $(".comment", el).value = saved.comments[i];
    });
    current = saved.current;
    paired = saved.paired;
    if (saved.view === "screen" || saved.view === "spec") view = saved.view;
    if (saved.up === 1 || saved.up === 2) up = saved.up;
    if (saved.device in VIEWPORTS) device = saved.device;
  } catch {}
};
const fit = () => {
  const [width, height] = VIEWPORTS[device];
  $$(".shot").forEach((box) => {
    const frame = $("iframe", box);
    const room = box.clientWidth;
    if (!room) return;
    const scale = Math.min(1, room / width);
    frame.style.width = width + "px";
    frame.style.height = height + "px";
    frame.style.transform = "scale(" + scale + ")";
    box.style.height = Math.round(height * scale) + "px";
    $(".zoom", box.closest(".variant")).textContent = Math.round(scale * 100) + "%";
  });
};
const show = () => {
  const pair = pairOf();
  picks.forEach((el, i) => {
    if (i === current) el.setAttribute("aria-current", "true");
    else el.removeAttribute("aria-current");
    $(".badge", el).textContent = slotOf(i, pair);
  });
  sections.forEach((el, i) => {
    el.hidden = i !== current && i !== pair;
    el.classList.toggle("current", i === current);
    $(".slot", el).textContent = slotOf(i, pair);
  });
  $$(".file").forEach((el) => (el.hidden = el.dataset.kind !== view));
  modes.forEach((el) => el.setAttribute("aria-pressed", String(el.dataset.view ? el.dataset.view === view : el.dataset.device ? el.dataset.device === device : Number(el.dataset.up) === up)));
  $$(".zoom").forEach((el) => (el.hidden = view !== "screen"));
  canvas.dataset.up = up;
  panels.forEach((el, i) => (el.hidden = i !== current));
  fit();
  save();
};
const refresh = () => {
  let decided = 0;
  panels.forEach((el, i) => {
    const verdict = el.dataset.verdict;
    if (verdict) decided++;
    for (const button of $$(".verdict", el)) button.setAttribute("aria-pressed", String(button.dataset.verdict === verdict));
    picks[i].classList.toggle("gone", verdict === "discard");
    picks[i].dataset.verdict = verdict;
    $(".word", picks[i]).textContent = WORDS[verdict] || "";
    const pill = $(".vpill", sections[i]);
    pill.dataset.verdict = verdict;
    pill.textContent = WORDS[verdict] || "Undecided";
  });
  progress.textContent = decided + "/" + panels.length + " decided";
  fill.style.width = (decided * 100) / panels.length + "%";
  $(".progress").classList.toggle("complete", decided === panels.length);
  done.hidden = decided !== panels.length;
  out.value = copiedOf(stateOf());
  label.textContent = "Copy feedback";
  save();
};
const decide = (panel, verdict) => {
  panel.dataset.verdict = panel.dataset.verdict === verdict ? "" : verdict;
  refresh();
};
const choose = (i) => {
  if (i === current) return;
  if (i === pairOf()) paired = current;
  current = i;
  show();
};
const setSheet = (open) => {
  if (open) {
    sheet.show();
    help.setAttribute("aria-expanded", "true");
    sheet.focus();
  } else {
    const inside = sheet.contains(document.activeElement);
    sheet.close();
    if (inside) help.focus();
  }
};
const copyOut = async () => {
  try {
    await navigator.clipboard.writeText(out.value);
    label.textContent = "Copied";
  } catch {
    $("details").open = true;
    out.focus();
    out.select();
  }
};
const apply = (frame) => {
  const doc = frame.contentDocument;
  if (!doc) return;
  if (theme) doc.documentElement.dataset.theme = theme.value;
  if (state) for (const el of doc.querySelectorAll("[data-state]")) el.style.display = state.value && el.dataset.state !== state.value ? "none" : "";
};
frames.forEach((frame) => {
  frame.addEventListener("load", () => {
    apply(frame);
    frame.contentDocument.addEventListener("click", () => choose(sections.indexOf(frame.closest(".variant"))));
  });
});
for (const control of [state, theme]) if (control) control.addEventListener("change", () => frames.forEach(apply));
document.addEventListener("input", refresh);
document.addEventListener("click", (event) => {
  const pick = event.target.closest(".pick");
  const verdict = event.target.closest(".verdict");
  const mode = event.target.closest(".mode");
  const section = event.target.closest("#canvas .variant");
  if (sheet.open && !event.target.closest("#sheet, #help")) setSheet(false);
  if (verdict) decide(verdict.closest(".panel"), verdict.dataset.verdict);
  else if (mode) {
    if (mode.dataset.view) view = mode.dataset.view;
    else if (mode.dataset.device) device = mode.dataset.device;
    else up = Number(mode.dataset.up);
    show();
  } else if (pick) {
    const i = picks.indexOf(pick);
    if (!event.shiftKey) {
      paired = -1;
      current = i;
    } else if (i !== current) {
      paired = paired === i ? -1 : i;
      up = paired < 0 ? 1 : 2;
    }
    show();
  } else if (section) choose(sections.indexOf(section));
});
copy.addEventListener("click", copyOut);
help.addEventListener("click", () => setSheet(!sheet.open));
sheet.addEventListener("close", () => help.setAttribute("aria-expanded", "false"));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && sheet.open) return setSheet(false);
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest("textarea, select")) return;
  if (event.key === "?") return setSheet(!sheet.open);
  if (event.shiftKey) return;
  const key = event.key.toLowerCase();
  if (KEYS[key]) decide(panels[current], KEYS[key]);
  else if (key === "c") copyOut();
  else if ((key === "arrowleft" && current > 0) || (key === "arrowright" && current < panels.length - 1)) {
    paired = -1;
    current += key === "arrowleft" ? -1 : 1;
    show();
  }
});
restore();
refresh();
show();
const watch = new ResizeObserver(() => requestAnimationFrame(fit));
$$(".shot").forEach((box) => watch.observe(box));
`;

const inline = (text) => escaped(text).replace(/`([^`]+)`/g, "<code>$1</code>");

const cellsOf = (line) => line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((cell) => cell.trim());
const isRule = (line) => /^\s*\|(\s*:?-+:?\s*\|)+\s*$/.test(line ?? "");

/** A markdown file as a document: front matter as chips, then headings, paragraphs, lists, tables and inline code.
 * Every other line is an escaped paragraph. */
function documentOf(text) {
  const lines = text.replaceAll("\r", "").split("\n");
  const html = [];
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) {
      const chips = lines.slice(1, end).filter((line) => line.trim()).map((line) => {
        const at = line.indexOf(":");
        return at < 0 ? `<span class="chip">${escaped(line.trim())}</span>` : `<span class="chip"><span class="key">${escaped(line.slice(0, at).trim())}</span>${escaped(line.slice(at + 1).trim())}</span>`;
      });
      html.push(`<div class="chips">${chips.join("")}</div>`);
      lines.splice(0, end + 1);
    }
  }
  for (let at = 0; at < lines.length; ) {
    const line = lines[at];
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (!line.trim()) at++;
    else if (heading) {
      html.push(`<h${heading[1].length}>${inline(heading[2].trim())}</h${heading[1].length}>`);
      at++;
    } else if (/^- /.test(line)) {
      const items = [];
      for (; at < lines.length && /^- /.test(lines[at]); at++) items.push(`<li>${inline(lines[at].slice(2))}</li>`);
      html.push(`<ul>${items.join("")}</ul>`);
    } else if (/^\s*\|/.test(line) && isRule(lines[at + 1])) {
      const rows = [];
      for (at += 2; at < lines.length && /^\s*\|/.test(lines[at]); at++) rows.push(`<tr>${cellsOf(lines[at]).map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`);
      html.push(`<div class="scroll"><table><thead><tr>${cellsOf(line).map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`);
    } else {
      const rows = [];
      for (; at < lines.length && lines[at].trim() && !/^(#{1,3} |- )/.test(lines[at]); at++) rows.push(lines[at].trim());
      html.push(`<p>${inline(rows.join(" "))}</p>`);
    }
  }
  return `<article class="doc">${html.join("\n")}</article>`;
}

/** One variant on the canvas: a window holding its name and verdict, then what it ships for each view. A
 * markdown file is a document, an html file a frame; a view with nothing says so. */
function frameOf({ name, files }, tokens, first, view) {
  const views = [["screen", true], ["spec", false]].map(([kind, isScreen]) => {
    const own = files.filter(({ path }) => HTML_FILE.test(path) === isScreen);
    const mark = `<div class="file" data-kind="${kind}"${kind === view ? "" : " hidden"}>`;
    if (!own.length) return `${mark}<p class="none">No ${kind} in this variant.</p></div>`;
    return own.map(({ path, text }) => {
      const caption = own.length > 1 ? `<p class="path">${escaped(path)}</p>` : "";
      if (!isScreen) return `${mark}${caption}<div class="page">${documentOf(text)}</div></div>`;
      const doc = text.replaceAll(STYLESHEET_LINK, tokens === null ? "" : `<style>\n${tokens}</style>`);
      return `${mark}${caption}<div class="shot"><iframe title="${escaped(`${name} ${path}`)}" srcdoc="${escaped(doc)}"></iframe></div></div>`;
    }).join("\n");
  });
  const title = `<div class="title"><b>${escaped(name)}</b><span class="slot" aria-hidden="true"></span><span class="zoom"></span><span class="vpill" data-verdict="">Undecided</span></div>`;
  return [`<section class="variant" data-name="${escaped(name)}"${first ? "" : " hidden"}>`, '<div class="win">', title, ...views, "</div>", "</section>"].join("\n");
}

/** One variant in the inspector: its intent and axis values, its verdict and its comment. */
function panelOf({ name, intent, axes }, first) {
  return [
    `<section class="panel" data-name="${escaped(name)}" data-verdict=""${first ? "" : " hidden"}>`,
    `<h2>${escaped(name)}</h2>`,
    `<p>${escaped(intent)}</p>`,
    `<dl>${axes.map(([axis, value]) => `<dt>${escaped(axis)}</dt><dd>${escaped(value)}</dd>`).join("")}</dl>`,
    '<p class="caption">Verdict</p>',
    `<div class="seg" role="group" aria-label="Verdict">${VERDICTS.map(([verdict, label, glyph]) => `<button type="button" class="verdict" data-verdict="${verdict}" aria-pressed="false" title="${label} (${label[0]})"><span aria-hidden="true">${glyph}</span>${label}<kbd aria-hidden="true">${label[0]}</kbd></button>`).join("")}</div>`,
    '<label class="field"><span>Comment</span><textarea class="comment" autocomplete="off" rows="4" placeholder="What should change?"></textarea></label>',
    "</section>",
  ].join("\n");
}

/** What the page shows, hashed: each variant's name and each file's path and text, in order. A review is kept only for the same fingerprint. */
const fingerprintOf = (variants) => createHash("sha256").update(JSON.stringify(variants.map(({ name, files }) => [name, files.map(({ path, text }) => [path, text])]))).digest("hex");

/** The page of a set: `variants` each `{name, intent, axes: [[axis, value]], files: [{path, text}]}`, the
 * `tokens` stylesheet or null, and the `themes` the design system names. */
function pageOf({ id, variants, tokens, themes }) {
  const states = [...new Set(variants.flatMap(({ files }) => files.filter(({ path }) => HTML_FILE.test(path)).flatMap(({ text }) => [...text.matchAll(STATE_ATTRIBUTE)].map((match) => match[1]))))].sort();
  const choice = (label, control) => `<label class="sel">${label} ${control}</label>`;
  const view = variants.some(({ files }) => files.some(({ path }) => HTML_FILE.test(path))) ? "screen" : "spec";
  const mode = (attribute, value, text, pressed) => `<button type="button" class="mode" data-${attribute}="${value}" aria-pressed="${pressed}">${text}</button>`;
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>Compare ${escaped(id)}</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    "<header>",
    `<div class="brand"><span class="mark" aria-hidden="true"></span><h1>${escaped(id)}</h1><span class="pill">${variants.length} variants</span></div>`,
    '<div class="end">',
    `<div class="progress"><span class="bar" aria-hidden="true"><i id="fill"></i></span><span id="progress">0/${variants.length} decided</span><span id="done" hidden>Copy the feedback into the chat.</span></div>`,
    '<button type="button" id="help" aria-label="Keyboard shortcuts" aria-haspopup="dialog" aria-expanded="false" aria-controls="sheet" title="Shortcuts (?)">?</button>',
    '<button type="button" id="copy" title="Copy feedback (C)"><span class="label">Copy feedback</span><kbd aria-hidden="true">C</kbd></button>',
    "</div>",
    '<dialog id="sheet" aria-labelledby="sheet-title" tabindex="-1">',
    '<p class="caption" id="sheet-title">Keyboard shortcuts</p>',
    `<ul class="keys">${SHORTCUTS.map(([key, what]) => `<li><kbd>${key}</kbd>${what}</li>`).join("")}</ul>`,
    '<p class="note">Shift-click a variant in the list to compare it.</p>',
    "</dialog>",
    "</header>",
    '<nav aria-label="Variants">',
    '<p class="caption">Variants</p>',
    '<div class="list">',
    ...variants.map(({ name, intent }, at) => `<button type="button" class="pick" data-name="${escaped(name)}"${at === 0 ? ' aria-current="true"' : ""}><span class="dot" aria-hidden="true"></span><span class="txt"><span class="line"><span class="name">${escaped(name)}</span><span class="badge" aria-hidden="true"></span><span class="word"></span></span><span class="intent">${escaped(intent)}</span></span></button>`),
    "</div>",
    `<ul class="legend" aria-label="Verdicts">${LEGEND.map(([verdict, what]) => `<li><span class="dot" data-verdict="${verdict}" aria-hidden="true"></span>${what}</li>`).join("")}</ul>`,
    '<p class="hint"><span class="sr">Shift-click to compare</span><span aria-hidden="true"><kbd>⇧</kbd> click to compare</span></p>',
    "</nav>",
    '<main id="canvas">',
    '<div class="toolbar">',
    `<div class="seg" role="group" aria-label="View">${mode("view", "screen", "Screen", view === "screen")}${mode("view", "spec", "Spec", view === "spec")}</div>`,
    `<div class="seg" role="group" aria-label="Layout">${mode("up", "1", "1 up", true)}${mode("up", "2", "2 up", false)}</div>`,
    `<div class="seg" role="group" aria-label="Screen size">${mode("device", "desktop", "Desktop", true)}${mode("device", "mobile", "Mobile", false)}</div>`,
    '<div class="tools">',
    ...(states.length ? [choice("Preview state", `<select id="state">${options(states, "all")}</select>`)] : []),
    ...(themes.length ? [choice("Preview theme", `<select id="theme">${options(themes)}</select>`)] : []),
    "</div>",
    "</div>",
    '<div class="stage">',
    ...variants.map((variant, at) => frameOf(variant, tokens, at === 0, view)),
    "</div>",
    "</main>",
    '<aside id="inspector">',
    ...variants.map((variant, at) => panelOf(variant, at === 0)),
    '<div class="foot">',
    "<details>",
    "<summary>Show JSON</summary>",
    '<textarea id="feedback" readonly rows="8" aria-label="Feedback"></textarea>',
    "</details>",
    "</div>",
    "</aside>",
    `<script>\nconst SET = ${JSON.stringify(id)};\nconst KEY = ${JSON.stringify(`aidd-ui:${id}:${fingerprintOf(variants)}`)};\n${feedbackOf.toString()}\n${copiedOf.toString()}\n${SCRIPT}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

module.exports = { pageOf, feedbackOf, copiedOf };
