// The comparison page of a set of variants: one file, opened as a file, with no server and no request.
const { createHash } = require("node:crypto");

const STATE_ATTRIBUTE = /data-state="([^"]+)"/g;
const HTML_FILE = /\.html$/;
const STYLESHEET_LINK = '<link rel="stylesheet" href="../tokens.css">'; // how a render loads the tokens
const VERDICTS = [["keep", "Keep"], ["revise", "Revise"], ["discard", "Discard"]];

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
:root { --bg: #f6f6f7; --text: #1a1a1a; --muted: #595959; --line: #a1a1a8; --canvas: #d6d6db; --pick: #e3e3e8; --accent: #1d4ed8; --on-accent: #ffffff; --focus: #1d4ed8; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #1e1e20; --text: #ececec; --muted: #a8a8ad; --line: #6b6b72; --canvas: #34343a; --pick: #2d2d33; --accent: #60a5fa; --on-accent: #0b1220; --focus: #93c5fd; }
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { font: 14px/1.4 system-ui, sans-serif; margin: 0; height: 100vh; display: grid; grid-template: auto 1fr auto / 13rem 1fr 20rem; background: var(--bg); color: var(--text); }
header, nav, aside, footer { color-scheme: light dark; background: var(--bg); color: var(--text); }
header, footer { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; padding: 0.5rem 1rem; }
header { border-bottom: 1px solid var(--line); }
footer { border-top: 1px solid var(--line); }
h1 { font-size: 1rem; margin: 0; }
.count, nav p, dt, footer span { color: var(--muted); }
nav p { margin: 0.75rem 0 0; }
#progress { margin-left: auto; }
nav, aside { overflow: auto; padding: 0.75rem; }
nav { border-right: 1px solid var(--line); }
aside { border-left: 1px solid var(--line); }
button { font: inherit; color: var(--text); background: transparent; border: 1px solid var(--line); border-radius: 4px; min-width: 24px; min-height: 24px; padding: 0.25rem 0.5rem; cursor: pointer; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.pick { display: flex; justify-content: space-between; gap: 0.5rem; width: 100%; margin-bottom: 0.25rem; text-align: left; border-color: transparent; }
.pick[aria-current="true"] { background: var(--pick); border-color: var(--line); }
.pick .word, .pick.gone { color: var(--muted); }
.pick.gone .name { text-decoration: line-through; }
.verdict[aria-pressed="true"], #copy { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
#copy { font-weight: 600; }
#canvas { background: var(--canvas); color: var(--text); overflow: auto; padding: 1rem; display: flex; gap: 1rem; align-items: flex-start; }
.variant { flex: 1 1 0; min-width: 0; }
.variant h2 { font-size: 0.8rem; margin: 0 0 0.25rem; }
.variant h3 { font-size: 0.75rem; margin: 0.5rem 0 0.25rem; }
iframe { width: 100%; height: 24rem; border: 1px solid var(--line); background: #fff; display: block; }
pre { white-space: pre-wrap; background: #fff; color: #1a1a1a; padding: 0.5rem; margin: 0; }
.panel h2 { margin-top: 0; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 0 0.75rem; }
dd { margin: 0; }
[role="group"] { display: flex; gap: 0.25rem; margin: 0.75rem 0; }
label { display: block; margin: 0.5rem 0; }
header label { display: flex; gap: 0.375rem; align-items: center; margin: 0; }
select { font: inherit; min-height: 24px; }
textarea { width: 100%; font: inherit; }
details textarea { font: 12px/1.4 ui-monospace, monospace; }
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
  sections.forEach((el, i) => (el.hidden = i !== current && i !== paired));
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
    $(".word", picks[i]).textContent = WORDS[verdict] || "";
  });
  progress.textContent = decided + "/" + panels.length + " decided";
  out.value = copiedOf(stateOf());
  copy.textContent = "Copy feedback";
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
    copy.textContent = "Copied";
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

/** One variant on the canvas: its name over its text files and its frames, one per html file. */
function frameOf({ name, files }, tokens, first) {
  const shown = files.map(({ path, text }) => {
    if (!HTML_FILE.test(path)) return `<h3>${escaped(path)}</h3><pre>${escaped(text)}</pre>`;
    const doc = text.replaceAll(STYLESHEET_LINK, tokens === null ? "" : `<style>\n${tokens}</style>`);
    return `<h3>${escaped(path)}</h3><iframe title="${escaped(`${name} ${path}`)}" srcdoc="${escaped(doc)}"></iframe>`;
  });
  return [`<section class="variant" data-name="${escaped(name)}"${first ? "" : " hidden"}>`, `<h2>${escaped(name)}</h2>`, ...shown, "</section>"].join("\n");
}

/** One variant in the inspector: its intent and axis values, its verdict and its comment. */
function panelOf({ name, intent, axes }, first) {
  return [
    `<section class="panel" data-name="${escaped(name)}" data-verdict=""${first ? "" : " hidden"}>`,
    `<h2>${escaped(name)}</h2>`,
    `<p>${escaped(intent)}</p>`,
    `<dl>${axes.map(([axis, value]) => `<dt>${escaped(axis)}</dt><dd>${escaped(value)}</dd>`).join("")}</dl>`,
    `<div role="group" aria-label="Verdict">${VERDICTS.map(([verdict, label]) => `<button type="button" class="verdict" data-verdict="${verdict}" aria-pressed="false">${label}</button>`).join("")}</div>`,
    '<label>Comment <textarea class="comment" autocomplete="off" rows="4"></textarea></label>',
    "</section>",
  ].join("\n");
}

/** What the page shows, hashed: each variant's name and each file's path and text, in order. A review is kept only for the same fingerprint. */
const fingerprintOf = (variants) => createHash("sha256").update(JSON.stringify(variants.map(({ name, files }) => [name, files.map(({ path, text }) => [path, text])]))).digest("hex");

/** The page of a set: `variants` each `{name, intent, axes: [[axis, value]], files: [{path, text}]}`, the
 * `tokens` stylesheet or null, and the `themes` the design system names. */
function pageOf({ id, variants, tokens, themes }) {
  const states = [...new Set(variants.flatMap(({ files }) => files.filter(({ path }) => HTML_FILE.test(path)).flatMap(({ text }) => [...text.matchAll(STATE_ATTRIBUTE)].map((match) => match[1]))))].sort();
  const choice = (label, control) => `<label>${label} ${control}</label>`;
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<title>Compare ${escaped(id)}</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    "<header>",
    `<h1>${escaped(id)}</h1>`,
    `<span class="count">${variants.length} variants</span>`,
    ...(states.length ? [choice("State", `<select id="state">${options(states, "all")}</select>`)] : []),
    ...(themes.length ? [choice("Theme", `<select id="theme">${options(themes)}</select>`)] : []),
    `<span id="progress">0/${variants.length} decided</span>`,
    '<button type="button" id="copy">Copy feedback</button>',
    "</header>",
    '<nav aria-label="Variants">',
    ...variants.map(({ name }, at) => `<button type="button" class="pick" data-name="${escaped(name)}"${at === 0 ? ' aria-current="true"' : ""}><span class="name">${escaped(name)}</span><span class="word"></span></button>`),
    "<p>Shift-click to compare</p>",
    "</nav>",
    '<main id="canvas">',
    ...variants.map((variant, at) => frameOf(variant, tokens, at === 0)),
    "</main>",
    '<aside id="inspector">',
    ...variants.map((variant, at) => panelOf(variant, at === 0)),
    "</aside>",
    "<footer>",
    "<span>K keep · R revise · D discard · ←→ variant · C copy</span>",
    "<details>",
    "<summary>Show JSON</summary>",
    '<textarea id="feedback" readonly rows="8" aria-label="Feedback"></textarea>',
    "</details>",
    "</footer>",
    `<script>\nconst SET = ${JSON.stringify(id)};\nconst KEY = ${JSON.stringify(`aidd-ui:${id}:${fingerprintOf(variants)}`)};\n${feedbackOf.toString()}\n${copiedOf.toString()}\n${SCRIPT}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

module.exports = { pageOf, feedbackOf, copiedOf };
