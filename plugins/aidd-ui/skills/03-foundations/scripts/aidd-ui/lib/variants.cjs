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

// Limit: only a lone `d` or `l` before a vowel is elided; slugs carry no apostrophe, so no other contraction is recovered.
const ELISION = /\b([dl]) (?=[aeiouyh\u00e0\u00e2\u00e9\u00e8\u00ea\u00ee\u00f4\u00fb])/gi;

/** A slug as a title a person reads: its hyphens as spaces, a lone `d` or `l` before a vowel elided, its first letter capital. */
const titleOf = (name) => {
  const words = String(name).replaceAll("-", " ").replace(ELISION, "$1'");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const HEADING = /^# +(.+?)\s*$/m;

/** What a person is shown for a file of a variant, never its path: the first heading of its record, of the record
 * beside it for a render, else the name of the file as words. */
function fileTitleOf(variant, file) {
  const stem = file.path.replace(/\.[^./]+$/, "");
  const record = file.path.endsWith(".md") ? file : variant.files.find((each) => each.path === `${stem}.md`);
  return (record && HEADING.exec(record.text)?.[1]) || titleOf(stem.split("/").pop());
}

/** The title of a set: the heading of the record the first variant writes under the set's own name, else its id as words. */
function setTitleOf(set) {
  const stem = (file) => file.path.replace(/\.[^./]+$/, "").split("/").pop();
  const written = set.variants?.[0]?.files.find((file) => MARKDOWN_FILE.test(file.path) && stem(file) === set.id);
  return (written && HEADING.exec(written.text)?.[1]) || titleOf(set.id);
}

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

/** What a cell says, with its case and spacing set aside. */
const valueOf = (cell) => String(cell ?? "").toLowerCase().replace(/\s+/g, " ").trim();

const COLOUR = /(#[0-9a-f]{6})\b/gi;

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
  const font = variant.axes.filter(([axis]) => !PALETTE_AXIS.test(axis)).map(([, value]) => fontOf(value)).find(Boolean) ?? null;
  const sizes = sizesOf(variant);
  return { background: colours[0], text: colours[1], accent: colours[2] ?? colours[1], font, sizes };
}

const TAG = /<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>|<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const STATE_VALUE = /\bdata-state="([^"]*)"/;

/** The states a render names for the screen itself, each once, in the order first seen.
 * An element inside another that names a state is a component's own state, never the screen's. */
function statesOf(html) {
  const found = [];
  const open = [];
  for (const [, , closing, name, attributes] of html.matchAll(TAG)) {
    if (!name) continue;
    const tag = name.toLowerCase();
    if (closing) {
      const at = open.map((each) => each.tag).lastIndexOf(tag);
      if (at >= 0) open.length = at;
      continue;
    }
    const state = STATE_VALUE.exec(attributes)?.[1];
    if (state !== undefined && !open.some((each) => each.state)) found.push(state);
    if (!VOID_TAGS.has(tag) && !attributes.endsWith("/")) open.push({ tag, state: state !== undefined });
  }
  return [...new Set(found)];
}

/** The state a screen opens on: its default, else the first it names. Null when it names none. */
function firstStateOf(html) {
  const states = statesOf(html);
  return states.includes("default") ? "default" : (states[0] ?? null);
}

/** A state as the page names it: a known name in the language, any other as written. */
const stateNameOf = (labels, state) => (Object.hasOwn(labels.stateNames, state) ? labels.stateNames[state] : state);

const NAMED_FONT = /([A-Z][\w-]*(?: [A-Z0-9][\w-]*)*)\s*,?\s*$/;

/** The font stack a cell names: the font written just before its generic family, then that family's fallbacks.
 * Null when it names no generic family. */
function fontOf(value) {
  const text = String(value ?? "");
  const found = FAMILY.exec(text);
  if (!found) return null;
  const generic = FAMILIES[found[1].toLowerCase()];
  const named = NAMED_FONT.exec(text.slice(0, found.index))?.[1];
  return named ? `'${named}', ${generic}` : generic;
}

/** The sizes in `px` of the first cell that gives two or more, or null. */
const sizesOf = (variant) => variant.axes.map(([, value]) => [...String(value ?? "").matchAll(PIXELS)].map((match) => match[1])).find((found) => found.length >= 2) ?? null;

/** What an axis cell says as a tile: each `#rrggbb` as a swatch with its code under it, a sample button in the accent
 * after the first colours of a look, a generic font family as a heading and a body line in that font at the sizes
 * the variant gives, the rest as escaped text. */
function cellOf(value, { variant, labels, sampled }) {
  const text = String(value ?? "");
  const tones = text
    .split(COLOUR)
    .map((part, at, parts) => (at % 2 ? `<span class="tone"><i class="swatch" style="background: ${part}"></i><code>${part}</code></span>` : at > 0 && at < parts.length - 1 && /^[\s,;]*$/.test(part) ? "" : escaped(part)))
    .join("");
  const look = text.split(COLOUR).length > 1 ? lookOf(variant) : null;
  const sample = look && !sampled.done ? ((sampled.done = true), `<span class="sample" style="background: ${look.accent}; color: ${look.background}">${escaped(labels.sample)}</span>`) : "";
  const font = fontOf(text);
  const [body, heading] = sizesOf(variant) ?? [];
  const size = (px) => (px ? ` style="font-size: ${px}px"` : "");
  const specimen = font ? `<span class="specimen" style="font-family: ${font}"><b${size(heading)}>${escaped(labels.specimenHeading)}</b><span${size(body)}>${escaped(labels.specimenBody)}</span></span>` : "";
  return tones + sample + specimen;
}

/** A wireframe dressed in a look by element styles alone: its structure stays as written, only its first state shown. */
function dressedOf(html, { background, text, accent, font, sizes }) {
  const [body, heading, button] = sizes ?? [];
  const bodySize = body ? ` font-size: ${body}px;` : "";
  const headingSize = heading ? ` h1, h2 { font-size: ${heading}px; }` : "";
  const buttonSize = button ? ` min-height: ${button}px;` : "";
  const state = firstStateOf(html);
  const hide = state === null ? "" : `[data-state]:not([data-state=${JSON.stringify(state)}]):not([data-state] [data-state]) { display: none !important; }`;
  const style = `<style>${hide}body { background: ${background}; color: ${text};${font ? ` font-family: ${font};` : ""}${bodySize} }${headingSize} button { background: ${accent}; color: ${background}; border: 0; padding: 8px 16px; border-radius: 8px; font: inherit;${buttonSize} } textarea, input { background: transparent; color: inherit; border: 1px solid ${accent}; }</style>`;
  return html.includes("</head>") ? html.replace("</head>", () => `${style}</head>`) : style + html;
}

/** A frame of a document at a size, scaled by the script to the width of its column. */
const frameOf = ({ variant, title, doc, size: [size, width, height] }) => `<figure class="frame"><div class="fit" data-size="${size}" data-width="${width}" data-height="${height}" style="height: ${height}px"><iframe title="${escaped(`${titleOf(variant.name)} ${title}`)}" style="width: ${width}px; height: ${height}px" srcdoc="${escaped(doc)}"></iframe></div></figure>`;

/** A render in one mobile frame, whole: the script of the bar above the columns picks its state and its size. It names the
 * states the render holds, and keeps a note, hidden until the chosen state is one it lacks. */
function framesOf({ variant, file, tokens, labels, page }) {
  const doc = inlined(file.text, tokens);
  const named = statesOf(file.text);
  const own = named.length ? ` data-states="${escaped(named.join(" "))}"` : "";
  return `<div class="file rendering" data-path="${escaped(file.path)}"${own}>${fileTitleOf(variant, file) === page ? "" : `<h3>${escaped(fileTitleOf(variant, file))}</h3>`}${frameOf({ variant, title: fileTitleOf(variant, file), doc, size: MOBILE })}<p class="no-state" hidden>${escaped(labels.noState)}</p></div>`;
}

const DESKTOP = SIZES.find(([size]) => size === "desktop");
const MOBILE = SIZES.find(([size]) => size === "mobile");

/** The one screen a column shows: the first dressed wireframe in a mobile frame, and the document of each
 * dressed wireframe kept beside it for the select above the columns to switch to. */
function screenOf({ variant, docs, tokens }) {
  const [first] = docs;
  const kept = docs.map((each) => `<template class="screen-doc" data-path="${escaped(each.path)}" data-doc="${escaped(inlined(each.text, tokens))}"></template>`).join("");
  return `<div class="file screen" data-path="${escaped(first.path)}">${frameOf({ variant, title: fileTitleOf(variant, first), doc: inlined(first.text, tokens), size: MOBILE })}${kept}</div>`;
}

/** One variant as a column: its name, its intent, its axes, then each of its files. */
function columnOf({ variant, at, shared, tokens, labels, wireframes, parent, siblings, voting, page }) {
  const look = lookOf(variant);
  const docs = look && wireframes.length ? wireframes.map((wireframe) => ({ path: wireframe.path, text: dressedOf(wireframe.text, look) })) : null;
  const screens = docs ? [screenOf({ variant, docs, tokens })] : null;
  const before = new Map(parent?.axes ?? []);
  const changed = (axis, value) => (parent && String(before.get(axis) ?? "").trim() !== String(value ?? "").trim() ? ` data-changed="${escaped(parent.name)}" title="${escaped(filled(labels.changed, { parent: titleOf(parent.name) }))}"` : "");
  const same = (axis) => siblings.length > 1 && siblings.every((each) => valueOf(each.axes.find(([name]) => name === axis)?.[1]) === valueOf(variant.axes.find(([name]) => name === axis)?.[1]));
  const sampled = { done: false };
  const axes = variant.axes.map(([axis, value]) => `<tr${same(axis) ? " data-same" : ""}><th>${escaped(axis)}${same(axis) ? ` <small class="same-tag">${escaped(labels.identical)}</small>` : ""}</th><td${changed(axis, value)}>${same(axis) ? `<span class="value">${cellOf(value, { variant, labels, sampled })}</span>` : `<button type="button" class="take" data-axis="${escaped(axis)}" data-variant="${escaped(variant.name)}" aria-pressed="false">${cellOf(value, { variant, labels, sampled })}<span class="take-cta">${escaped(labels.take)}</span></button>`}</td></tr>`).join("");
  const renders = screens ? [] : variant.files.filter((file) => RENDER_FILE.test(file.path)).map((file) => framesOf({ variant, file, tokens, labels, page }));
  const documents = variant.files.filter((file) => MARKDOWN_FILE.test(file.path)).flatMap((file) => {
    const text = shared.has(file.path) ? shared.get(file.path).texts[at] : file.text;
    return text ? [`<div class="file" data-path="${escaped(file.path)}"><h3>${escaped(fileTitleOf(variant, file))}</h3>${documentOf(text)}</div>`] : [];
  });
  const full = documents.length ? `<details class="fulltext"><summary>${escaped(labels.full)}</summary>${documents.join("")}</details>` : "";
  const large = screens || renders.length ? `<button type="button" class="large" data-variant="${escaped(variant.name)}">${escaped(labels.large)}</button>` : "";
  const votes = voting ? `<span class="choose">${[["keep", labels.keep], ["revise", labels.revise], ["discard", labels.discard]].map(([verdict, label]) => `<button type="button" class="colvote" data-verdict="${verdict}" data-variant="${escaped(variant.name)}" aria-pressed="false">${escaped(label)}</button>`).join("")}</span><textarea class="colcomment" rows="2" placeholder="${escaped(labels.comment)}" aria-label="${escaped(labels.comment)}" hidden></textarea>` : "";
  return `<section class="variant" data-variant="${escaped(variant.name)}"><header class="column-head"><h2>${escaped(titleOf(variant.name))}</h2><p class="intent">${escaped(variant.intent ?? "")}</p>${votes}</header><table class="axes"><tbody>${axes}</tbody></table>${renders.concat(screens ?? [], large, full).join("")}</section>`;
}

/** The bar above a round's columns: a tab per state the renders of the round show (none when they show one or none)
 * and the size to see them at, so the variants compare on the same state at the same size. Empty when no variant has a render. */
function compareOf({ variants, labels }) {
  const files = variants.flatMap((variant) => variant.files.filter((file) => RENDER_FILE.test(file.path)));
  if (!files.length) return "";
  const union = [...new Set(files.flatMap((file) => statesOf(file.text)))];
  const named = union.includes("default") ? ["default", ...union.filter((state) => state !== "default")] : union;
  const states = named.length > 1 ? `<div class="seg" role="group" aria-label="${escaped(labels.states)}">${named.map((state, at) => `<button type="button" class="tab" data-show-state="${escaped(state)}" aria-pressed="${at === 0}">${escaped(stateNameOf(labels, state))}</button>`).join("")}</div>` : "";
  const sizes = `<div class="seg size" role="group" aria-label="${escaped(labels.size)}">${SIZES.slice().reverse().map(([size, width]) => `<button type="button" class="tab" data-show-size="${size}" data-width="${width}" aria-pressed="${size === MOBILE[0]}">${escaped(labels[size])}</button>`).join("")}</div>`;
  return `<div class="compare tabs" data-state="${escaped(named.length > 1 ? named[0] : "")}" data-width="${MOBILE[1]}">${states}${sizes}</div>`;
}

/** The dialog that shows the screen of a variant at desktop width, one script for all the columns. */
const largeOf = (labels) => {
  const [, width, height] = DESKTOP;
  return `<dialog id="large" aria-label="${escaped(labels.large)}" data-width="${width}" data-height="${height}"><div class="large-head"><button type="button" data-step="-1">${escaped(labels.previousVariant)}</button><strong id="large-title"></strong><button type="button" data-step="1">${escaped(labels.nextVariant)}</button><button type="button" class="close" id="large-close" aria-label="${escaped(labels.close)}">&times;</button></div><div class="large-fit"><iframe title="${escaped(labels.large)}"></iframe></div></dialog>`;
};

/** The body of a set's page: its name, then the problems that keep it from being shown, else the paths the
 * variants share and one column per variant. */
function setBodyOf({ set, tokens, labels, wireframes = [] }) {
  const head = `<header class="head"><p class="crumb">${labels.choose}</p><h1>${escaped(set.title ?? titleOf(set.id))}</h1></header>`;
  if (set.problems.length) {
    const items = set.problems.map((each) => `<li data-rule="${escaped(each.rule)}"><b>${escaped(each.rule)}</b> ${escaped(each.message)} <span class="fix">${escaped(each.fix)}</span></li>`);
    return `${head}\n<section class="checks"><h2>${labels.checks}</h2><ul>${items.join("")}</ul></section>`;
  }
  const rounds = [...new Set(set.variants.map((variant) => variant.round ?? 1))].sort((a, b) => a - b);
  const options = wireframes.map((wireframe) => `<option value="${escaped(wireframe.path)}">${escaped(wireframe.title ?? titleOf(wireframe.path.replace(/\.[^./]+$/, "")))}</option>`).join("");
  const dressed = wireframes.length && set.variants.some(lookOf);
  const shown = (variant) => !(wireframes.length && lookOf(variant)) && variant.files.some((file) => RENDER_FILE.test(file.path));
  const note = wireframes.length && set.variants.some(lookOf) ? `<div class="preview-bar"><p class="preview-note">${escaped(labels.preview)}</p><label class="screen-pick">${escaped(labels.screen)} <select id="screen-pick">${options}</select></label></div>` : "";
  const roundBody = (round) => {
    const own = set.variants.filter((variant) => (variant.round ?? 1) === round);
    const shared = sharedOf(own);
    const same = [...shared].filter(([, each]) => each.same.length).map(([path, each]) => `<p class="same" data-path="${escaped(path)}">${escaped(fileTitleOf(own.find((variant) => variant.files.some((file) => file.path === path)), { path }))} ${escaped(filled(labels.same, { sections: each.same.join(JOINER) }))}</p>`);
    const columns = own.map((variant, at) => columnOf({ variant, at, shared, tokens, labels, wireframes, siblings: own, voting: round === rounds.at(-1), page: set.title ?? titleOf(set.id), parent: set.variants.find((each) => each.name === variant.parent && (each.round ?? 1) < round) }));
    const body = [same.join("\n"), compareOf({ variants: own.filter(shown), labels }), `<div class="variants" style="--count: ${columns.length}" data-set="${escaped(set.id)}" data-fingerprint="${escaped(set.fingerprint)}">${columns.join("")}</div>`].filter(Boolean).join("\n");
    return rounds.length > 1 ? `<details class="round" data-round="${round}"${round === rounds.at(-1) ? " open" : ""}><summary>${escaped(filled(labels.round, { round }))}</summary>${body}</details>` : body;
  };
  return [head, note, ...rounds.map(roundBody), dressed || set.variants.some(shown) ? largeOf(labels) : ""].filter(Boolean).join("\n");
}

/** The look of a set's page, added to the shell's. */
const STYLE = `
.variants { display: grid; grid-template-columns: repeat(var(--count), minmax(0, 1fr)); gap: var(--s5); align-items: start; }
.variant:has(.colvote[data-verdict="discard"][aria-pressed="true"]) { opacity: 0.6; }
.variant { display: flex; flex-direction: column; gap: var(--s3); min-width: 0; padding: var(--s4); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r3); box-shadow: var(--shadow-1); }
.column-head { position: sticky; top: 0; z-index: 2; display: flex; flex-direction: column; gap: var(--s2); padding-block: var(--s2); background: var(--surface); }
.column-head .choose { margin-top: auto; }
.variant h2 { margin: 0; font-size: var(--t-xl); }
.variant h3 { margin: 0; font-size: var(--t-sm); font-weight: 500; color: var(--muted); }
.variant .intent { margin: 0; color: var(--muted); }
.axes { border-collapse: collapse; width: 100%; font-size: var(--t-md); }
.axes, .axes tbody, .axes tr { display: block; }
.axes th, .axes td { display: block; }
.axes th { text-align: left; font-weight: 500; font-size: var(--t-xs); color: var(--muted); padding: 4px var(--s2) 4px 0; white-space: nowrap; vertical-align: top; }
.axes td { padding: 4px 0; overflow-wrap: anywhere; }
.round > summary { cursor: pointer; font-weight: 600; margin: var(--s3) 0; }
.axes td[data-changed] { box-shadow: inset 3px 0 0 var(--revise); }
.take { display: block; inline-size: 100%; height: auto; line-height: 1.4; padding: var(--s1) var(--s2); border: 1px solid var(--line-strong); border-radius: var(--r1); background: var(--surface); color: inherit; font: inherit; text-align: left; cursor: pointer; transition: border-color var(--d1) var(--ease); }
.take:hover { border-color: var(--accent); }
.take-cta { display: block; margin-top: 2px; font-size: var(--t-xs); font-weight: 600; text-align: right; color: var(--text); }
.take[aria-pressed="true"] { border-color: var(--ok); box-shadow: inset 0 0 0 1px var(--ok); }
.take[aria-pressed="true"] .take-cta::before { content: "\\2713 "; color: var(--ok); }
.axes .value { display: block; padding: var(--s1) var(--s2); color: var(--muted); }
.choices h3 { margin: var(--s3) var(--s5) var(--s1); font-size: var(--t-xs); font-weight: 500; color: var(--muted); }
.choice { border-bottom: 1px solid var(--line); }
.choice summary { display: flex; align-items: center; gap: var(--s2); padding: var(--s3) var(--s5); cursor: pointer; font-size: var(--t-sm); font-weight: 600; }
.choice .done { margin-left: auto; color: var(--faint); font-weight: 500; font-size: var(--t-xs); }
.choice ol { padding: 0 var(--s3) var(--s3); }
.pvariant { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); padding: 6px var(--s2); border-radius: var(--r1); }
.pvariant .pick { min-width: 0; flex: 1; font-size: var(--t-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pvariant .comment { flex-basis: 100%; }
.choose .vote { flex: 1; height: var(--h-control); padding: 0 var(--s2); border: 0; background: transparent; color: var(--muted); font-size: var(--t-xs); }
.vote[aria-pressed="true"] { background: var(--surface); box-shadow: var(--shadow-1); color: var(--text); }
.vote[data-verdict="keep"][aria-pressed="true"] { background: var(--ok-soft); box-shadow: inset 0 0 0 1.5px var(--ok); color: var(--ok); }
.vote[data-verdict="revise"][aria-pressed="true"] { background: var(--revise-soft); box-shadow: inset 0 0 0 1.5px var(--revise); color: var(--revise); }
.vote[data-verdict="discard"][aria-pressed="true"] { background: var(--sunken); box-shadow: none; color: var(--muted); }
.tone { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; margin: 0 6px 6px 0; vertical-align: top; }
.axes .swatch { display: block; inline-size: 44px; block-size: 44px; border: 1px solid var(--line-strong); border-radius: var(--r1); }
.axes td code { font-size: 10px; }
.sample { display: inline-block; padding: 6px 14px; border-radius: var(--r2); font-size: var(--t-sm); vertical-align: top; }
.specimen { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
.preview-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s3); margin: 0 0 var(--s4); }
.screen-pick { font-size: var(--t-sm); color: var(--muted); }
.preview-note { margin: 0; color: var(--muted); font-size: var(--t-sm); }
.axes tr[data-same] th { opacity: 0.5; }
.same-tag { font-weight: 400; font-style: italic; }
.large { align-self: flex-start; }
#large { padding: 0; border: 1px solid var(--line-strong); border-radius: var(--r3); max-inline-size: 96vw; background: var(--surface); }
#large::backdrop { background: var(--scrim); }
.large-head { display: flex; align-items: center; gap: var(--s2); padding: var(--s2) var(--s3); }
.large-head strong { flex: 1; text-align: center; }
.large-fit { position: relative; overflow: hidden; margin-inline: auto; }
.large-fit iframe { position: absolute; top: 0; left: 0; border: 0; transform-origin: 0 0; background: var(--paper); }
.fulltext > summary { cursor: pointer; font-size: var(--t-sm); font-weight: 600; color: var(--muted); }
.fulltext[open] > summary { margin-bottom: var(--s3); }
.same { margin: 0; color: var(--muted); font-size: var(--t-sm); }
.file { display: flex; flex-direction: column; gap: var(--s2); min-width: 0; }
.variant .doc { padding: var(--s3) var(--s4); max-width: none; box-shadow: none; }
.compare { padding: 0; margin: 0 0 var(--s4); flex-wrap: wrap; align-items: center; row-gap: 0; }
.compare .seg { display: flex; gap: var(--s1); min-width: 0; overflow-x: auto; }
.compare .size { margin-left: auto; }
.compare .tab[aria-pressed="true"] { color: var(--text); border-bottom-color: var(--accent); font-weight: 600; }
.no-state { margin: 0; padding: var(--s5) var(--s3); border: 1px dashed var(--line-strong); border-radius: var(--r2); background: var(--sunken); color: var(--muted); font-size: var(--t-sm); text-align: center; }
.frame { margin: 0; display: flex; flex-direction: column; gap: var(--s1); }
.fit { position: relative; overflow: hidden; margin-inline: auto; border-radius: var(--r2); box-shadow: var(--shadow-frame); background: var(--paper); }
.fit iframe { position: absolute; top: 0; left: 0; border: 0; transform-origin: 0 0; background: var(--paper); }
@media (max-width: 900px) { .variants { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 768px) { .column-head { top: var(--bar); } }
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
function alignRows() {
  for (const round of document.querySelectorAll(".variants")) {
    const columns = [...round.querySelectorAll(".variant")];
    const groups = [columns.map((column) => column.querySelector(".column-head"))];
    columns.forEach((column) => [...column.querySelectorAll(".axes tr")].forEach((row, at) => (groups[at + 1] = groups[at + 1] || []).push(row)));
    for (const group of groups) group.filter(Boolean).forEach((part) => (part.style.minHeight = ""));
    if (columns.some((column) => column.offsetTop !== columns[0].offsetTop)) continue;
    for (const group of groups) {
      const parts = group.filter(Boolean);
      const tallest = Math.max(...parts.map((part) => part.offsetHeight));
      parts.forEach((part) => (part.style.minHeight = tallest + "px"));
    }
  }
}
alignRows();
window.addEventListener("resize", alignRows);
document.querySelectorAll("details.round").forEach((round) => round.addEventListener("toggle", alignRows));
/* The bar above a round: its state and its size apply to every render of the round. A frame is as wide as the size, as tall as the content of the state shown, then scaled to its column by fitFrames. */
function showState(frame, state) {
  const doc = frame.contentDocument;
  if (!doc || !doc.head) return;
  const style = doc.getElementById("compare-state") || doc.createElement("style");
  style.id = "compare-state";
  style.textContent = state ? "[data-state]:not([data-state=" + JSON.stringify(state) + "]):not([data-state] [data-state]) { display: none !important; }" : "";
  if (!style.parentNode) doc.head.append(style);
}
function measure(box) {
  const frame = box.firstElementChild;
  const root = frame.contentDocument && frame.contentDocument.documentElement;
  frame.style.width = box.dataset.width + "px";
  frame.style.height = "0px";
  const height = root ? Math.ceil(root.getBoundingClientRect().height) : 0;
  box.dataset.height = String(height > 0 ? height : Number(box.dataset.height));
  frame.style.height = box.dataset.height + "px";
}
for (const bar of document.querySelectorAll(".compare")) {
  const round = bar.nextElementSibling;
  const render = () => {
    for (const holder of round.querySelectorAll(".rendering")) {
      const box = holder.querySelector(".fit");
      const states = holder.dataset.states ? holder.dataset.states.split(" ") : [];
      const missing = states.length > 0 && bar.dataset.state !== "" && !states.includes(bar.dataset.state);
      box.hidden = missing;
      holder.querySelector(".no-state").hidden = !missing;
      box.dataset.width = bar.dataset.width;
      showState(box.firstElementChild, bar.dataset.state);
      measure(box);
    }
    fitFrames();
  };
  for (const button of bar.querySelectorAll("button")) button.addEventListener("click", () => {
    if (button.dataset.showState !== undefined) bar.dataset.state = button.dataset.showState;
    else bar.dataset.width = button.dataset.width;
    for (const other of button.parentElement.children) other.setAttribute("aria-pressed", String(other === button));
    render();
  });
  for (const frame of round.querySelectorAll(".rendering iframe")) frame.addEventListener("load", () => {
    render();
    const root = frame.contentDocument && frame.contentDocument.documentElement;
    if (root && typeof ResizeObserver === "function") new ResizeObserver(render).observe(root);
  });
  render();
}
const large = document.getElementById("large");
if (large) {
  const frame = large.querySelector("iframe");
  const box = large.querySelector(".large-fit");
  const width = Number(large.dataset.width);
  const height = Number(large.dataset.height);
  let column = null;
  const round = () => [...column.closest(".variants").querySelectorAll(".variant")].filter((each) => each.querySelector(".screen, .rendering"));
  function showLarge() {
    const scale = Math.min(1, (window.innerWidth * 0.9) / width, (window.innerHeight * 0.8) / height);
    frame.style.width = width + "px";
    frame.style.height = height + "px";
    frame.style.transform = "scale(" + scale + ")";
    box.style.width = Math.ceil(width * scale) + "px";
    box.style.height = Math.ceil(height * scale) + "px";
    const own = column.querySelector(".screen iframe");
    const bar = column.closest(".variants").previousElementSibling;
    const state = !own && bar && bar.classList.contains("compare") ? bar.dataset.state : null;
    frame.onload = state === null ? null : () => showState(frame, state);
    frame.srcdoc = (own || column.querySelector(".rendering iframe")).srcdoc;
    document.getElementById("large-title").textContent = column.querySelector("h2").textContent;
  }
  document.querySelectorAll("button.large").forEach((button) => button.addEventListener("click", () => {
    column = button.closest(".variant");
    showLarge();
    large.showModal();
  }));
  large.querySelectorAll("[data-step]").forEach((button) => button.addEventListener("click", () => {
    const all = round();
    column = all[(all.indexOf(column) + Number(button.dataset.step) + all.length) % all.length];
    showLarge();
  }));
  document.getElementById("large-close").addEventListener("click", () => large.close());
}
const pick = document.getElementById("screen-pick");
if (pick) pick.addEventListener("change", () => {
  for (const screen of document.querySelectorAll(".screen")) {
    const doc = [...screen.querySelectorAll("template.screen-doc")].find((each) => each.dataset.path === pick.value);
    if (doc) screen.querySelector("iframe").srcdoc = doc.dataset.doc;
  }
});
if (typeof ResizeObserver === "function") new ResizeObserver(fitFrames).observe(document.querySelector("main"));
`;

module.exports = { titleOf, setTitleOf, stateNameOf, latestOf, setBodyOf, setFileOf, sectionsOf, STYLE, SCRIPT };
