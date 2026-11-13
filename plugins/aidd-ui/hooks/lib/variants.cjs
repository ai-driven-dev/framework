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

/** The variants of the latest round of a set: the only ones a choice is made on. */
const latestOf = (variants) => {
  const latest = Math.max(...variants.map((variant) => variant.round ?? 1));
  return variants.filter((variant) => (variant.round ?? 1) === latest);
};

/** The file a set's page is written to. */
const setFileOf = (id) => `${SET_PREFIX}${id}.html`;

/** A variant's slug as a title: its hyphens as spaces, its first letter capital. */
const titleOf = (name) => {
  const words = String(name).replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

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

const PALETTE_AXIS = /palette|colou?r|couleur/i;
const FAMILY = /\b(sans-serif|serif|monospace)\b/i;
const PIXELS = /(\d+(?:\.\d+)?)\s*px\b/gi;
const FAMILIES = { "sans-serif": "system-ui, sans-serif", serif: "Georgia, serif", monospace: "ui-monospace, monospace" };

/** What a variant says of its look in a form to read: the hex colours of its palette axis (background, text, then
 * accent), the generic font family any other axis names, and the sizes a cell gives in `px` (text, headings, then
 * buttons) found by its values, never by its axis name. Null when it gives fewer than two colours. */
function lookOf(variant) {
  const colours = variant.axes.filter(([axis]) => PALETTE_AXIS.test(axis)).flatMap(([, value]) => String(value ?? "").match(COLOUR) ?? []);
  if (colours.length < 2) return null;
  const family = variant.axes.filter(([axis]) => !PALETTE_AXIS.test(axis)).map(([, value]) => FAMILY.exec(String(value ?? ""))?.[1]?.toLowerCase()).find(Boolean);
  const sizes = variant.axes.map(([, value]) => [...String(value ?? "").matchAll(PIXELS)].map((match) => match[1])).find((found) => found.length >= 2);
  return { background: colours[0], text: colours[1], accent: colours[2] ?? colours[1], font: family ? FAMILIES[family] : null, sizes: sizes ?? null };
}

/** A wireframe dressed in a look by element styles alone: its structure stays as written. */
function dressedOf(html, { background, text, accent, font, sizes }) {
  const [body, heading, button] = sizes ?? [];
  const bodySize = body ? ` font-size: ${body}px;` : "";
  const headingSize = heading ? ` h1, h2 { font-size: ${heading}px; }` : "";
  const buttonSize = button ? ` min-height: ${button}px;` : "";
  const style = `<style>body { background: ${background}; color: ${text};${font ? ` font-family: ${font};` : ""}${bodySize} }${headingSize} button { background: ${accent}; color: ${background}; border: 0; padding: 8px 16px; border-radius: 8px; font: inherit;${buttonSize} } textarea, input { background: transparent; color: inherit; border: 1px solid ${accent}; }</style>`;
  return html.includes("</head>") ? html.replace("</head>", () => `${style}</head>`) : style + html;
}

/** A render in the frames of each size, each scaled by the script to the width of its column. */
function framesOf({ variant, file, tokens, labels }) {
  const frame = ([size, width, height]) => `<figure class="frame"><figcaption>${labels[size]}</figcaption><div class="fit" data-size="${size}" data-width="${width}" data-height="${height}" style="height: ${height}px"><iframe title="${escaped(`${variant.name} ${file.path} ${size}`)}" style="width: ${width}px; height: ${height}px" srcdoc="${escaped(inlined(file.text, tokens))}"></iframe></div></figure>`;
  return `<div class="file" data-path="${escaped(file.path)}"><h3><code>${escaped(file.path)}</code></h3><div class="frames">${SIZES.map(frame).join("")}</div></div>`;
}

/** One variant as a column: its name, its intent, its axes, then each of its files. */
function columnOf({ variant, at, shared, tokens, labels, wireframes, parent }) {
  const look = lookOf(variant);
  const screens = look && wireframes.length ? wireframes.map((wireframe) => framesOf({ variant, file: { path: wireframe.path, text: dressedOf(wireframe.text, look) }, tokens, labels })) : null;
  const before = new Map(parent?.axes ?? []);
  const changed = (axis, value) => (parent && String(before.get(axis) ?? "").trim() !== String(value ?? "").trim() ? ` data-changed="${escaped(parent.name)}" title="${escaped(filled(labels.changed, { parent: parent.name }))}"` : "");
  const axes = variant.axes.map(([axis, value]) => `<tr><th>${escaped(axis)}</th><td${changed(axis, value)}><button type="button" class="take" data-axis="${escaped(axis)}" data-variant="${escaped(variant.name)}" aria-pressed="false">${cellOf(value)}</button></td></tr>`).join("");
  const files = variant.files.flatMap((file) => {
    if (RENDER_FILE.test(file.path)) return screens ? [] : [framesOf({ variant, file, tokens, labels })];
    if (!MARKDOWN_FILE.test(file.path)) return [];
    const text = shared.has(file.path) ? shared.get(file.path).texts[at] : file.text;
    return text ? [`<div class="file" data-path="${escaped(file.path)}"><h3><code>${escaped(file.path)}</code></h3>${documentOf(text)}</div>`] : [];
  });
  return `<section class="variant" data-variant="${escaped(variant.name)}"><h2>${escaped(titleOf(variant.name))}</h2><p class="intent">${escaped(variant.intent ?? "")}</p><table class="axes"><tbody>${axes}</tbody></table>${files.concat(screens ?? []).join("")}</section>`;
}

/** The body of a set's page: its name, then the problems that keep it from being shown, else the paths the
 * variants share and one column per variant. */
function setBodyOf({ set, tokens, labels, wireframes = [] }) {
  const head = `<header class="head"><p class="crumb">${labels.choose}</p><h1>${escaped(set.id)}</h1></header>`;
  if (set.problems.length) {
    const items = set.problems.map((each) => `<li data-rule="${escaped(each.rule)}"><b>${escaped(each.rule)}</b> ${escaped(each.message)} <span class="fix">${escaped(each.fix)}</span></li>`);
    return `${head}\n<section class="checks"><h2>${labels.checks}</h2><ul>${items.join("")}</ul></section>`;
  }
  const rounds = [...new Set(set.variants.map((variant) => variant.round ?? 1))].sort((a, b) => a - b);
  const note = wireframes.length && set.variants.some(lookOf) ? `<p class="preview-note">${escaped(labels.preview)}</p>` : "";
  const roundBody = (round) => {
    const own = set.variants.filter((variant) => (variant.round ?? 1) === round);
    const shared = sharedOf(own);
    const same = [...shared].filter(([, each]) => each.same.length).map(([path, each]) => `<p class="same" data-path="${escaped(path)}"><code>${escaped(path)}</code> ${escaped(filled(labels.same, { sections: each.same.join(JOINER) }))}</p>`);
    const columns = own.map((variant, at) => columnOf({ variant, at, shared, tokens, labels, wireframes, parent: set.variants.find((each) => each.name === variant.parent && (each.round ?? 1) < round) }));
    const body = [same.join("\n"), `<div class="variants" style="--count: ${columns.length}" data-set="${escaped(set.id)}" data-fingerprint="${escaped(set.fingerprint)}">${columns.join("")}</div>`].filter(Boolean).join("\n");
    return rounds.length > 1 ? `<details class="round" data-round="${round}"${round === rounds.at(-1) ? " open" : ""}><summary>${escaped(filled(labels.round, { round }))}</summary>${body}</details>` : body;
  };
  return [head, note, ...rounds.map(roundBody)].filter(Boolean).join("\n");
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
.round > summary { cursor: pointer; font-weight: 600; margin: var(--s3) 0; }
.axes td[data-changed] { box-shadow: inset 3px 0 0 var(--revise); }
.take { display: block; inline-size: 100%; padding: 2px var(--s2); border: 1px solid transparent; border-radius: var(--r1); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.take:hover { border-color: var(--line-strong); }
.take[aria-pressed="true"] { border-color: var(--ok); background: var(--surface); }
.choices h3 { margin: var(--s3) var(--s5) var(--s1); font-size: var(--t-xs); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.choice { border-bottom: 1px solid var(--line); }
.choice summary { display: flex; align-items: center; gap: var(--s2); padding: var(--s3) var(--s5); cursor: pointer; font-size: 13px; font-weight: 600; }
.choice .done { margin-left: auto; color: var(--faint); font-weight: 500; font-size: var(--t-xs); font-variant-numeric: tabular-nums; }
.choice ol { padding: 0 var(--s3) var(--s3); }
.pvariant { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); padding: 6px var(--s2); border-radius: var(--r1); }
.pvariant .pick { min-width: 0; flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pvariant .comment { flex-basis: 100%; }
.choose .vote { height: 24px; padding: 0 var(--s2); border: 0; background: transparent; color: var(--muted); font-size: var(--t-xs); }
.vote[aria-pressed="true"] { background: var(--surface); box-shadow: var(--shadow-1); color: var(--text); }
.vote[data-verdict="keep"][aria-pressed="true"] { color: var(--ok); }
.vote[data-verdict="revise"][aria-pressed="true"] { color: var(--revise); }
.axes .swatch { display: inline-block; inline-size: 14px; block-size: 14px; margin-inline-end: 4px; vertical-align: -2px; }
.axes td code { margin-inline-end: 6px; }
.preview-note { margin: 0; color: var(--muted); font-size: var(--t-sm); }
.same { margin: 0; color: var(--muted); font-size: var(--t-sm); }
.file { display: flex; flex-direction: column; gap: var(--s2); min-width: 0; }
.variant .doc { padding: var(--s3) var(--s4); max-width: none; box-shadow: none; }
.frames { display: flex; flex-direction: column; gap: var(--s3); }
.frame { margin: 0; display: flex; flex-direction: column; gap: var(--s1); }
.frame figcaption { font-size: var(--t-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--faint); }
.fit { position: relative; overflow: hidden; margin-inline: auto; border: 1px solid var(--line-strong); border-radius: var(--r2); background: #fff; }
.fit iframe { position: absolute; top: 0; left: 0; border: 0; transform-origin: 0 0; background: #fff; }
@media (max-width: 900px) { .variants { grid-template-columns: minmax(0, 1fr); } }
`;

/** The script of a set's page: each frame scaled to the width of its column, again when the page resizes. */
const SCRIPT = `
function fitFrames() {
  for (const box of document.querySelectorAll(".fit")) {
    const width = Number(box.dataset.width);
    const height = Number(box.dataset.height);
    const room = box.parentElement.clientWidth || width;
    const scale = Math.min(1, room / width);
    box.firstElementChild.style.transform = "scale(" + scale + ")";
    box.style.width = Math.min(room, Math.ceil(width * scale) + 2) + "px";
    box.style.height = Math.ceil(height * scale) + "px";
  }
}
fitFrames();
window.addEventListener("resize", fitFrames);
if (typeof ResizeObserver === "function") new ResizeObserver(fitFrames).observe(document.querySelector("main"));
`;

module.exports = { latestOf, setBodyOf, setFileOf, sectionsOf, STYLE, SCRIPT };
