// The page of a set of variants in the showcase: one column per variant, its axes, its records as text
// and its renders in two fixed frames. Pure: it is handed the set the drafts read.
const { escaped, documentOf, inlined } = require("./html.cjs");
const { LINE_BREAK } = require("./markdown.cjs");

const SET_PREFIX = "_set-"; // so a set named like a record never takes its page's name
const SIZES = [["desktop", 1280, 800], ["mobile", 390, 844]];
const SECTION_LINE = /^## +(.+?)\s*$/;
const MARKDOWN_FILE = /\.md$/;
const RENDER_FILE = /\.html$/;
const JOINER = ", ";

/** The file a set's page is written to. */
const setFileOf = (id) => `${SET_PREFIX}${id}.html`;

const filled = (label, values) => label.replace(/\{(\w+)\}/g, (_, key) => values[key]);

/** A markdown text cut at its `## ` headings: what comes before the first one has no heading. */
function sectionsOf(text) {
  const sections = [{ heading: null, lines: [] }];
  for (const line of text.replaceAll("\r", "").split(LINE_BREAK)) {
    const heading = SECTION_LINE.exec(line);
    if (heading) sections.push({ heading: heading[1], lines: [line] });
    else sections.at(-1).lines.push(line);
  }
  return sections.map(({ heading, lines }) => ({ heading, text: lines.join(LINE_BREAK).trim() })).filter((section) => section.text);
}

/** For each markdown path every variant holds: the headings whose section reads the same in all of them,
 * and what each variant shows of the path, the other sections. */
function sharedOf(variants) {
  const shared = new Map();
  if (variants.length < 2) return shared;
  const [first] = variants;
  for (const { path } of first.files.filter((file) => MARKDOWN_FILE.test(file.path))) {
    const own = variants.map((variant) => variant.files.find((file) => file.path === path));
    if (own.some((file) => !file)) continue;
    const cut = own.map((file) => sectionsOf(file.text));
    const same = cut[0].filter((section) => section.heading !== null && cut.every((sections) => sections.some((each) => each.heading === section.heading && each.text === section.text))).map((section) => section.heading);
    shared.set(path, { same, texts: cut.map((sections) => sections.filter((section) => !same.includes(section.heading)).map((section) => section.text).join(`${LINE_BREAK}${LINE_BREAK}`)) });
  }
  return shared;
}

const COLOUR = /(#[0-9a-f]{6})\b/gi;

/** What an axis cell says: each `#rrggbb` as a swatch beside its code, the rest as escaped text. */
const cellOf = (value) =>
  String(value ?? "")
    .split(COLOUR)
    .map((part, at) => (at % 2 ? `<i class="swatch" style="background: ${part}"></i><code>${part}</code>` : escaped(part)))
    .join("");

/** A render in the frames of each size, each scaled by the script to the width of its column. */
function framesOf({ variant, file, tokens, labels }) {
  const frame = ([size, width, height]) => `<figure class="frame"><figcaption>${labels[size]}</figcaption><div class="fit" data-size="${size}" data-width="${width}" data-height="${height}" style="height: ${height}px"><iframe title="${escaped(`${variant.name} ${file.path} ${size}`)}" style="width: ${width}px; height: ${height}px" srcdoc="${escaped(inlined(file.text, tokens))}"></iframe></div></figure>`;
  return `<div class="file" data-path="${escaped(file.path)}"><h3><code>${escaped(file.path)}</code></h3><div class="frames">${SIZES.map(frame).join("")}</div></div>`;
}

/** One variant as a column: its name, its intent, its axes, then each of its files. */
function columnOf({ variant, at, shared, tokens, labels }) {
  const axes = variant.axes.map(([axis, value]) => `<tr><th>${escaped(axis)}</th><td>${cellOf(value)}</td></tr>`).join("");
  const files = variant.files.flatMap((file) => {
    if (RENDER_FILE.test(file.path)) return [framesOf({ variant, file, tokens, labels })];
    if (!MARKDOWN_FILE.test(file.path)) return [];
    const text = shared.has(file.path) ? shared.get(file.path).texts[at] : file.text;
    return text ? [`<div class="file" data-path="${escaped(file.path)}"><h3><code>${escaped(file.path)}</code></h3>${documentOf(text)}</div>`] : [];
  });
  return `<section class="variant" data-variant="${escaped(variant.name)}"><h2>${escaped(variant.name)}</h2><p class="intent">${escaped(variant.intent ?? "")}</p><table class="axes"><tbody>${axes}</tbody></table>${files.join("")}</section>`;
}

/** The body of a set's page: its name, then the problems that keep it from being shown, else the paths the
 * variants share and one column per variant. */
function setBodyOf({ set, tokens, labels }) {
  const head = `<header class="head"><p class="crumb">${labels.choose}</p><h1>${escaped(set.id)}</h1></header>`;
  if (set.problems.length) {
    const items = set.problems.map((each) => `<li data-rule="${escaped(each.rule)}"><b>${escaped(each.rule)}</b> ${escaped(each.message)} <span class="fix">${escaped(each.fix)}</span></li>`);
    return `${head}\n<section class="checks"><h2>${labels.checks}</h2><ul>${items.join("")}</ul></section>`;
  }
  const shared = sharedOf(set.variants);
  const same = [...shared].filter(([, own]) => own.same.length).map(([path, own]) => `<p class="same" data-path="${escaped(path)}"><code>${escaped(path)}</code> ${escaped(filled(labels.same, { sections: own.same.join(JOINER) }))}</p>`);
  const columns = set.variants.map((variant, at) => columnOf({ variant, at, shared, tokens, labels }));
  return [head, same.join("\n"), `<div class="variants" style="--count: ${columns.length}">${columns.join("")}</div>`].filter(Boolean).join("\n");
}

/** The look of a set's page, added to the shell's. */
const STYLE = `
.variants { display: grid; grid-template-columns: repeat(var(--count), minmax(0, 1fr)); gap: var(--s5); align-items: start; }
.variant { display: flex; flex-direction: column; gap: var(--s3); min-width: 0; padding: var(--s4); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r3); box-shadow: var(--shadow-1); }
.variant h2 { margin: 0; font-size: var(--t-xl); }
.variant h3 { margin: 0; font-size: var(--t-sm); font-weight: 500; color: var(--muted); }
.variant .intent { margin: 0; color: var(--muted); }
.axes { border-collapse: collapse; width: 100%; font-size: 13px; }
.axes th { text-align: left; font-weight: 500; color: var(--muted); padding: 4px var(--s2) 4px 0; white-space: nowrap; vertical-align: top; }
.axes td { padding: 4px 0; overflow-wrap: anywhere; }
.axes .swatch { display: inline-block; inline-size: 14px; block-size: 14px; margin-inline-end: 4px; vertical-align: -2px; }
.axes td code { margin-inline-end: 6px; }
.same { margin: 0; color: var(--muted); font-size: var(--t-sm); }
.file { display: flex; flex-direction: column; gap: var(--s2); min-width: 0; }
.variant .doc { padding: var(--s3) var(--s4); max-width: none; box-shadow: none; }
.frames { display: flex; flex-direction: column; gap: var(--s3); }
.frame { margin: 0; display: flex; flex-direction: column; gap: var(--s1); }
.frame figcaption { font-size: var(--t-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--faint); }
.fit { position: relative; overflow: hidden; inline-size: 100%; border: 1px solid var(--line-strong); border-radius: var(--r2); background: #fff; }
.fit iframe { position: absolute; top: 0; left: 0; border: 0; transform-origin: 0 0; background: #fff; }
@media (max-width: 900px) { .variants { grid-template-columns: minmax(0, 1fr); } }
`;

/** The script of a set's page: each frame scaled to the width of its column, again when the page resizes. */
const SCRIPT = `
function fitFrames() {
  for (const box of document.querySelectorAll(".fit")) {
    const width = Number(box.dataset.width);
    const height = Number(box.dataset.height);
    const scale = Math.min(1, (box.clientWidth || width) / width);
    box.firstElementChild.style.transform = "scale(" + scale + ")";
    box.style.height = Math.ceil(height * scale) + "px";
  }
}
fitFrames();
window.addEventListener("resize", fitFrames);
if (typeof ResizeObserver === "function") new ResizeObserver(fitFrames).observe(document.querySelector("main"));
`;

module.exports = { setBodyOf, setFileOf, sectionsOf, STYLE, SCRIPT };
