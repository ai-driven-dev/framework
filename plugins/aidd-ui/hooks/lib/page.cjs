// The comparison page of a set of variants: one file, opened as a file, with no server and no request.

const STATE_ATTRIBUTE = /data-state="([^"]+)"/g;
const HTML_FILE = /\.html$/;
const STYLESHEET_LINK = '<link rel="stylesheet" href="../tokens.css">'; // how a render loads the tokens
const RATINGS = [1, 2, 3, 4, 5];

/** The feedback a person gives, from the page's state: the one format of `feedback.json`. The page
 * carries this source as it stands, so it uses nothing outside itself. */
function feedbackOf(state) {
  return {
    draft: state.draft,
    variants: state.variants.map((variant) => ({
      name: variant.name,
      rating: Number(variant.rating) || null,
      discarded: Boolean(variant.discarded),
      comment: String(variant.comment ?? ""),
    })),
  };
}

/** `text` as HTML text or as an attribute value. */
const escaped = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const options = (values, empty) => [...(empty === undefined ? [] : [`<option value="">${empty}</option>`]), ...values.map((value) => `<option value="${escaped(String(value))}">${escaped(String(value))}</option>`)].join("");

const STYLE = `
body { font: 16px/1.4 system-ui, sans-serif; margin: 1rem; }
header, footer { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; margin-bottom: 1rem; }
main { display: flex; flex-wrap: wrap; gap: 1rem; }
.variant { flex: 1 1 24rem; min-width: 0; border: 1px solid; padding: 0.75rem; }
.variant[hidden], select[hidden], button[hidden] { display: none; }
iframe { width: 100%; height: 24rem; border: 1px solid; }
pre { white-space: pre-wrap; }
textarea { width: 100%; box-sizing: border-box; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 0 0.75rem; }
`;

// Runs in the page. The names it reads are the ones `pageOf` writes.
const SCRIPT = `
const $ = (selector, root = document) => root.querySelector(selector);
const variants = [...document.querySelectorAll(".variant")];
const frames = [...document.querySelectorAll("iframe")];
const out = $("#feedback");
const state = $("#state");
const theme = $("#theme");
const left = $("#left");
const right = $("#right");
const side = $("#side");
const stateOf = () => ({
  draft: DRAFT,
  variants: variants.map((el) => ({ name: el.dataset.name, rating: $(".rating", el).value, discarded: $(".discard", el).checked, comment: $(".comment", el).value })),
});
const show = () => {
  $("#with").hidden = !side.checked;
  const wanted = side.checked ? [left.value, right.value] : [left.value];
  for (const el of variants) el.hidden = !wanted.includes(el.dataset.name);
  out.value = JSON.stringify(feedbackOf(stateOf()), null, 2);
};
const apply = (frame) => {
  const doc = frame.contentDocument;
  if (!doc) return;
  if (theme) doc.documentElement.dataset.theme = theme.value;
  if (state) for (const el of doc.querySelectorAll("[data-state]")) el.style.display = state.value && el.dataset.state !== state.value ? "none" : "";
};
for (const frame of frames) frame.addEventListener("load", () => apply(frame));
for (const control of [state, theme]) if (control) control.addEventListener("change", () => frames.forEach(apply));
document.addEventListener("input", show);
$("#copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(out.value);
  } catch {
    out.select();
  }
});
if (typeof window.showSaveFilePicker === "function") {
  const save = $("#save");
  save.hidden = false;
  save.addEventListener("click", async () => {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: "feedback.json", types: [{ accept: { "application/json": [".json"] } }] });
      const stream = await handle.createWritable();
      await stream.write(out.value);
      await stream.close();
    } catch {
      out.select();
    }
  });
}
if (right.options.length > 1) right.selectedIndex = 1;
show();
`;

/** One variant: its name, intent and axis values, each file of it as text or in a frame, and its verdict. */
function variantOf({ name, intent, axes, files }, tokens) {
  const shown = files.map(({ path, text }) => {
    if (!HTML_FILE.test(path)) return `<h3>${escaped(path)}</h3><pre>${escaped(text)}</pre>`;
    const doc = text.replaceAll(STYLESHEET_LINK, tokens === null ? "" : `<style>\n${tokens}</style>`);
    return `<h3>${escaped(path)}</h3><iframe title="${escaped(`${name} ${path}`)}" srcdoc="${escaped(doc)}"></iframe>`;
  });
  return [
    `<section class="variant" data-name="${escaped(name)}">`,
    `<h2>${escaped(name)}</h2>`,
    `<p>${escaped(intent)}</p>`,
    `<dl>${axes.map(([axis, value]) => `<dt>${escaped(axis)}</dt><dd>${escaped(value)}</dd>`).join("")}</dl>`,
    ...shown,
    `<label>Rating <select class="rating">${options(RATINGS, "-")}</select></label>`,
    '<label><input type="checkbox" class="discard"> Discard</label>',
    '<label>Comment <textarea class="comment" rows="3"></textarea></label>',
    "</section>",
  ].join("\n");
}

/** The page of a set: `variants` each `{name, intent, axes: [[axis, value]], files: [{path, text}]}`, the
 * `tokens` stylesheet or null, and the `themes` the design system names. */
function pageOf({ id, variants, tokens, themes }) {
  const states = [...new Set(variants.flatMap(({ files }) => files.filter(({ path }) => HTML_FILE.test(path)).flatMap(({ text }) => [...text.matchAll(STATE_ATTRIBUTE)].map((match) => match[1]))))].sort();
  const names = variants.map(({ name }) => name);
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
    choice("Show", `<select id="left">${options(names)}</select>`),
    '<label><input type="checkbox" id="side"> Side by side</label>',
    `<label id="with" hidden>with <select id="right">${options(names)}</select></label>`,
    ...(states.length ? [choice("State", `<select id="state">${options(states, "all")}</select>`)] : []),
    ...(themes.length ? [choice("Theme", `<select id="theme">${options(themes)}</select>`)] : []),
    "</header>",
    "<main>",
    ...variants.map((variant) => variantOf(variant, tokens)),
    "</main>",
    "<footer>",
    '<button id="save" hidden>Save feedback.json</button>',
    '<button id="copy">Copy feedback</button>',
    '<textarea id="feedback" readonly rows="10" aria-label="Feedback"></textarea>',
    "</footer>",
    `<script>\nconst DRAFT = ${JSON.stringify(id)};\n${feedbackOf.toString()}${SCRIPT}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

module.exports = { pageOf, feedbackOf };
