// The comparison page of a set of variants: one file, opened as a file, with no server and no request.
const { createHash } = require("node:crypto");

const STATE_ATTRIBUTE = /data-state="([^"]+)"/g;
const HTML_FILE = /\.html$/;
const STYLESHEET_LINK = '<link rel="stylesheet" href="../tokens.css">'; // how a render loads the tokens
const VERDICTS = [["keep", "Keep", "✓"], ["revise", "Revise", "↻"], ["discard", "Discard", "✕"]];

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
:root { --bg: #ffffff; --text: #18181b; --muted: #5f5f68; --line: #e4e4e8; --canvas: #f0f0f3; --dot: #d9d9df; --hover: #f4f4f6; --press: #ebebef; --pill: #f1f1f4; --pill-text: #4b4b55; --accent: #1d4ed8; --on-accent: #ffffff; --accent-hover: #1e40af; --accent-text: #1d4ed8; --ring: #1d4ed8; --sel: #eaf0ff; --sel-line: #c7d6fb; --kbd-line: #d4d4d8; --shadow: 0 1px 2px rgba(0, 0, 0, 0.06), 0 4px 16px rgba(0, 0, 0, 0.06);
  --doc-bg: #ffffff; --doc-text: #1f2328; --doc-muted: #57606a; --doc-line: #d8dee4; --doc-chip: #f1f1f4; --doc-chip-text: #3f3f46;
  --keep-bg: #dcfce7; --keep-fg: #166534; --keep-dot: #16a34a; --revise-bg: #fef3c7; --revise-fg: #854d0e; --revise-dot: #d97706; --discard-bg: #fee2e2; --discard-fg: #991b1b; --discard-dot: #dc2626; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #111113; --text: #ececef; --muted: #a1a1aa; --line: #2a2a30; --canvas: #1c1c20; --dot: #2c2c33; --hover: #1b1b1f; --press: #232328; --pill: #232328; --pill-text: #c4c4cc; --accent: #2563eb; --accent-hover: #3b73f0; --accent-text: #93c5fd; --ring: #60a5fa; --sel: #1e2d52; --sel-line: #34498a; --kbd-line: #3a3a42; --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.35);
    --doc-bg: #141416; --doc-text: #ececef; --doc-muted: #a1a1aa; --doc-line: #2f2f36; --doc-chip: #232328; --doc-chip-text: #c4c4cc;
    --keep-bg: #12301c; --keep-fg: #86efac; --keep-dot: #4ade80; --revise-bg: #3a2a0a; --revise-fg: #fcd34d; --revise-dot: #fbbf24; --discard-bg: #3b1313; --discard-fg: #fca5a5; --discard-dot: #f87171; }
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { font: 13px/1.5 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; height: 100vh; display: grid; grid-template: 48px minmax(0, 1fr) / 15rem minmax(0, 1fr) 22rem; grid-template-areas: "top top top" "list canvas inspector"; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
header, nav, aside { color-scheme: light dark; background: var(--bg); color: var(--text); min-width: 0; }
header { grid-area: top; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid var(--line); }
nav { grid-area: list; border-right: 1px solid var(--line); overflow: auto; padding: 16px 8px; }
#canvas { grid-area: canvas; }
aside { grid-area: inspector; border-left: 1px solid var(--line); overflow: auto; display: flex; flex-direction: column; padding: 20px 16px 0; }
h1 { font-size: 13px; font-weight: 600; margin: 0; white-space: nowrap; }
.mark { width: 16px; height: 16px; border-radius: 4px; background: var(--accent); flex: none; }
.brand { display: flex; align-items: center; gap: 8px; min-width: 0; }
.pill { background: var(--pill); color: var(--pill-text); border-radius: 999px; padding: 0 8px; font-size: 12px; line-height: 20px; white-space: nowrap; }
.tools, .end { display: flex; align-items: center; gap: 12px; }
.tools { flex-wrap: wrap; }
.end { margin-left: auto; }
.sel { position: relative; display: flex; align-items: center; gap: 8px; color: var(--muted); white-space: nowrap; }
.sel::after { content: "▾"; position: absolute; right: 8px; bottom: 5px; font-size: 11px; color: var(--muted); pointer-events: none; }
select { appearance: none; -webkit-appearance: none; font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; min-height: 28px; padding: 0 24px 0 8px; cursor: pointer; }
select:hover { background: var(--hover); }
.progress { display: flex; align-items: center; gap: 8px; color: var(--muted); white-space: nowrap; }
.bar { width: 64px; height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
.bar i { display: block; height: 100%; width: 0; background: var(--accent); transition: width 120ms; }
button { font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; min-width: 24px; min-height: 28px; padding: 0 12px; cursor: pointer; transition: background-color 120ms, border-color 120ms, color 120ms; }
button:hover { background: var(--hover); }
button:active { background: var(--press); }
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
#copy { display: inline-flex; align-items: center; gap: 8px; background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 600; }
#copy:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
#copy kbd { color: var(--on-accent); background: rgba(0, 0, 0, 0.22); border-color: rgba(255, 255, 255, 0.45); }
kbd { font: 11px/16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; display: inline-block; min-width: 18px; padding: 0 4px; text-align: center; color: var(--pill-text); background: var(--bg); border: 1px solid var(--kbd-line); border-radius: 4px; }
.caption { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin: 0 8px 8px; }
.pick { display: flex; align-items: flex-start; gap: 8px; width: 100%; height: auto; min-height: 44px; padding: 6px 8px; margin-bottom: 2px; text-align: left; border-color: transparent; background: transparent; }
.pick:hover { background: var(--hover); }
.pick[aria-current="true"] { background: var(--sel); border-color: var(--sel-line); }
.dot { flex: none; width: 10px; height: 10px; margin-top: 5px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--muted); }
.pick[data-verdict="keep"] .dot { background: var(--keep-dot); box-shadow: none; }
.pick[data-verdict="revise"] .dot { background: var(--revise-dot); box-shadow: none; }
.pick[data-verdict="discard"] .dot { background: var(--discard-dot); box-shadow: none; }
.txt { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.line { display: flex; align-items: center; gap: 6px; }
.name { font-weight: 600; }
.word { margin-left: auto; font-size: 12px; color: var(--muted); }
.badge { font-size: 10px; font-weight: 600; line-height: 14px; min-width: 14px; text-align: center; border-radius: 4px; color: var(--accent-text); box-shadow: inset 0 0 0 1px var(--accent-text); }
.badge:empty { display: none; }
.intent { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pick.gone .name { color: var(--muted); font-weight: 400; text-decoration: line-through; }
.hint { margin: 16px 8px 0; color: var(--muted); font-size: 12px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
#canvas { background-color: var(--canvas); background-image: radial-gradient(var(--dot) 1px, transparent 1px); background-size: 16px 16px; color: var(--text); overflow: auto; padding: 24px; display: flex; gap: 24px; align-items: flex-start; }
.variant { flex: 1 1 0; min-width: 0; }
.tag { display: flex; align-items: baseline; gap: 8px; margin: 0 2px 8px; color: var(--muted); font-size: 12px; }
.tag b { font-weight: 600; color: var(--text); }
.variant.current .tag b { color: var(--accent-text); }
.file + .file { margin-top: 24px; }
.card { background: #ffffff; color: #1f2328; border-radius: 10px; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06), var(--shadow); overflow: hidden; }
iframe { width: 100%; height: 24rem; border: 0; background: #fff; display: block; }
.card.md { box-shadow: 0 0 0 1px var(--doc-line), var(--shadow); background: var(--doc-bg); color: var(--doc-text); max-width: calc(68ch + 64px); margin-inline: auto; padding: 28px 32px; font-size: 15px; line-height: 1.6; }
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
.seg { display: flex; margin: 0 0 20px; border: 1px solid var(--line); border-radius: 6px; padding: 2px; gap: 2px; }
.seg button { flex: 1; border: 0; background: transparent; min-height: 28px; padding: 0 8px; }
.seg button:hover { background: var(--hover); }
.seg button:active { background: var(--press); }
.seg button span { margin-right: 4px; }
.seg button[aria-pressed="true"] { font-weight: 600; }
.seg button[data-verdict="keep"][aria-pressed="true"] { background: var(--keep-bg); color: var(--keep-fg); }
.seg button[data-verdict="revise"][aria-pressed="true"] { background: var(--revise-bg); color: var(--revise-fg); }
.seg button[data-verdict="discard"][aria-pressed="true"] { background: var(--discard-bg); color: var(--discard-fg); }
label.field { display: block; }
label.field > span { display: block; margin-bottom: 6px; }
textarea { width: 100%; font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 8px; resize: vertical; }
textarea::placeholder { color: var(--muted); opacity: 1; }
.foot { margin-top: auto; position: sticky; bottom: 0; background: var(--bg); border-top: 1px solid var(--line); padding: 12px 0 16px; }
.keys { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 0 0 12px; color: var(--muted); }
summary { cursor: pointer; color: var(--muted); min-height: 24px; }
details textarea { font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin-top: 8px; }
@media (max-width: 900px) {
  body { height: auto; display: block; }
  header { flex-wrap: wrap; padding: 8px 16px; min-height: 48px; }
  .end { margin-left: 0; width: 100%; justify-content: space-between; }
  nav { border-right: 0; border-bottom: 1px solid var(--line); padding: 12px 16px; }
  nav .list { display: flex; gap: 8px; overflow-x: auto; }
  .pick { width: 12rem; flex: none; margin: 0; }
  .caption, .hint { margin-inline: 0; }
  #canvas { flex-direction: column; align-items: stretch; padding: 16px; }
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
const out = $("#feedback");
const state = $("#state");
const theme = $("#theme");
const copy = $("#copy");
const label = $("#copy .label");
const fill = $("#fill");
const progress = $("#progress");
const WORDS = { keep: "Keep", revise: "Revise", discard: "Discarded" };
const KEYS = { k: "keep", r: "revise", d: "discard" };
let current = 0;
let paired = -1;
const stateOf = () => ({
  set: SET,
  variants: panels.map((el) => ({ name: el.dataset.name, verdict: el.dataset.verdict, comment: $(".comment", el).value })),
});
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ verdicts: panels.map((el) => el.dataset.verdict), comments: panels.map((el) => $(".comment", el).value), current, paired }));
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
  } catch {}
};
const show = () => {
  picks.forEach((el, i) => (i === current ? el.setAttribute("aria-current", "true") : el.removeAttribute("aria-current")));
  sections.forEach((el, i) => {
    el.hidden = i !== current && i !== paired;
    el.classList.toggle("current", i === current);
  });
  picks.forEach((el, i) => ($(".badge", el).textContent = paired < 0 ? "" : i === current ? "A" : i === paired ? "B" : ""));
  panels.forEach((el, i) => (el.hidden = i !== current));
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
  });
  progress.textContent = decided + "/" + panels.length + " decided";
  fill.style.width = (decided * 100) / panels.length + "%";
  out.value = copiedOf(stateOf());
  label.textContent = "Copy feedback";
  save();
};
const decide = (panel, verdict) => {
  panel.dataset.verdict = panel.dataset.verdict === verdict ? "" : verdict;
  refresh();
};
const choose = (i) => {
  if (i === paired) paired = current;
  current = i;
  show();
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
  const section = event.target.closest("#canvas .variant");
  if (verdict) decide(verdict.closest(".panel"), verdict.dataset.verdict);
  else if (pick) {
    const i = picks.indexOf(pick);
    if (!event.shiftKey) {
      paired = -1;
      current = i;
    } else if (i !== current) paired = paired === i ? -1 : i;
    show();
  } else if (section) choose(sections.indexOf(section));
});
copy.addEventListener("click", copyOut);
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.target.closest("textarea, select")) return;
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

/** One variant on the canvas: its name over a card per file, a document for markdown and a frame for html. */
function frameOf({ name, files }, tokens, first) {
  const shown = files.map(({ path, text }) => {
    const tag = `<div class="tag"><b>${escaped(name)}</b><span>${escaped(path)}</span></div>`;
    if (!HTML_FILE.test(path)) return `<div class="file">${tag}<div class="card md">${documentOf(text)}</div></div>`;
    const doc = text.replaceAll(STYLESHEET_LINK, tokens === null ? "" : `<style>\n${tokens}</style>`);
    return `<div class="file">${tag}<div class="card"><iframe title="${escaped(`${name} ${path}`)}" srcdoc="${escaped(doc)}"></iframe></div></div>`;
  });
  return [`<section class="variant" data-name="${escaped(name)}"${first ? "" : " hidden"}>`, ...shown, "</section>"].join("\n");
}

/** One variant in the inspector: its intent and axis values, its verdict and its comment. */
function panelOf({ name, intent, axes }, first) {
  return [
    `<section class="panel" data-name="${escaped(name)}" data-verdict=""${first ? "" : " hidden"}>`,
    `<h2>${escaped(name)}</h2>`,
    `<p>${escaped(intent)}</p>`,
    `<dl>${axes.map(([axis, value]) => `<dt>${escaped(axis)}</dt><dd>${escaped(value)}</dd>`).join("")}</dl>`,
    '<p class="caption">Verdict</p>',
    `<div class="seg" role="group" aria-label="Verdict">${VERDICTS.map(([verdict, label, glyph]) => `<button type="button" class="verdict" data-verdict="${verdict}" aria-pressed="false"><span aria-hidden="true">${glyph}</span>${label}</button>`).join("")}</div>`,
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
    '<div class="tools">',
    ...(states.length ? [choice("Preview state", `<select id="state">${options(states, "all")}</select>`)] : []),
    ...(themes.length ? [choice("Preview theme", `<select id="theme">${options(themes)}</select>`)] : []),
    "</div>",
    '<div class="end">',
    `<div class="progress"><span class="bar" aria-hidden="true"><i id="fill"></i></span><span id="progress">0/${variants.length} decided</span></div>`,
    '<button type="button" id="copy"><span class="label">Copy feedback</span><kbd aria-hidden="true">C</kbd></button>',
    "</div>",
    "</header>",
    '<nav aria-label="Variants">',
    '<p class="caption">Variants</p>',
    '<div class="list">',
    ...variants.map(({ name, intent }, at) => `<button type="button" class="pick" data-name="${escaped(name)}"${at === 0 ? ' aria-current="true"' : ""}><span class="dot" aria-hidden="true"></span><span class="txt"><span class="line"><span class="name">${escaped(name)}</span><span class="badge" aria-hidden="true"></span><span class="word"></span></span><span class="intent">${escaped(intent)}</span></span></button>`),
    "</div>",
    '<p class="hint"><span class="sr">Shift-click to compare</span><span aria-hidden="true"><kbd>⇧</kbd> click to compare</span></p>',
    "</nav>",
    '<main id="canvas">',
    ...variants.map((variant, at) => frameOf(variant, tokens, at === 0)),
    "</main>",
    '<aside id="inspector">',
    ...variants.map((variant, at) => panelOf(variant, at === 0)),
    '<div class="foot">',
    '<div class="keys"><span><kbd>K</kbd> keep</span><span><kbd>R</kbd> revise</span><span><kbd>D</kbd> discard</span><span><kbd>←→</kbd> variant</span><span><kbd>C</kbd> copy</span></div>',
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
