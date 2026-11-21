// The sections of the charte page and of the identity page, as `{id, title, html}`: one list that the page
// draws and the navigation links, so a link can never name a section the page lacks. Pure: values, names
// and labels come in, markup goes out.
const { escaped, documentOf, inlined, STYLESHEET_LINK } = require("./html.cjs");
const { charteOf, contrastOf } = require("./charte.cjs");
const { LINE_BREAK } = require("./markdown.cjs");

const PATH_SEPARATOR = ".";
const PX_PER_REM = 16;
const PILL_PX = 999;
const LENGTH = /^(-?\d*\.?\d+)(rem|px)$/;
const ALPHA_COLOUR = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+) \/ ([\d.]+)\)$/;
const ROLE_LEAVES = ["family", "size", "weight", "line-height"];
const SAMPLE = "Aa";
const SECTION_LINE = /^## +(.+?)\s*$/;

const lastOf = (name) => name.slice(name.lastIndexOf(PATH_SEPARATOR) + 1);
const groupOf = (name) => name.slice(0, Math.max(name.lastIndexOf(PATH_SEPARATOR), 0));

/** A value as a person reads it: a colour with alpha as its hex and its opacity, anything else as is. */
function shownValue(value) {
  const match = ALPHA_COLOUR.exec(value);
  if (!match) return value;
  const hex = match.slice(1, 4).map((part) => Math.round(Number(part) * 255).toString(16).padStart(2, "0")).join("");
  return `#${hex} · ${Math.round(Number(match[4]) * 100)}%`;
}

const pixelsOf = (value) => {
  const match = LENGTH.exec(value.trim());
  return match ? Number(match[1]) * (match[2] === "rem" ? PX_PER_REM : 1) : null;
};
/** A length as written, and in pixels when it is in rem: "1rem · 16 px". */
const lengthText = (value) => (pixelsOf(value) === null || value.endsWith("px") ? value : `${value} · ${Number(pixelsOf(value).toFixed(2))} px`);

const swatchOf = (value) => (value ? `<i class="swatch" style="background: ${escaped(value)}"></i>` : '<i class="swatch"></i>');
const nameOf = (entry) => `<code class="name">${escaped(entry.name)}</code>`;
const item = (entry, ...parts) => `<li data-token="${escaped(entry.name)}">${parts.join("")}</li>`;
const valueOf = (text) => `<span class="value">${escaped(text)}</span>`;
const list = (kind, items) => (items.length ? `<ul class="${kind}">${items.join("")}</ul>` : "");

const paletteOf = (entries, values) => list("swatches", entries.map((entry) => item(entry, swatchOf(values.get(entry.name) ?? ""), nameOf(entry), valueOf(shownValue(values.get(entry.name) ?? "")))));

const ratioText = (ratio, labels) => `${ratio.toFixed(2).replace(".", labels.charte.decimal)}:1`;
const WORDS = { aa: "aa", large: "aaLarge", fail: "fail" };

const FOCUS_ROLE = /^color\.focus([.-]|$)/;
/** A pair as its colours draw it: the text sample for a text colour, a line for a border and a ring for a focus colour, on the ground. */
function sampleOf(fg, bg, values, nonText) {
  const [front, back] = [escaped(values.get(fg)), escaped(values.get(bg))];
  if (!nonText) return `<span class="pair-sample" style="color: ${front}; background: ${back}">${SAMPLE}</span>`;
  if (FOCUS_ROLE.test(fg)) return `<span class="pair-ring" style="background: ${back}"><i style="border-color: ${front}"></i></span>`;
  return `<span class="pair-line" style="background: ${back}"><i style="background: ${front}"></i></span>`;
}

/** The grid of contrast under the roles: a row per text colour, a column per ground, each cell the pair in its own colours with its ratio and its verdict in words. */
function contrastGridOf(entries, values, labels) {
  const { columns, rows } = contrastOf(entries, values);
  if (!rows.length) return "";
  const cell = (fg, bg, found, nonText) => {
    if (!found) return `<td data-fg="${escaped(fg)}" data-bg="${escaped(bg)}"></td>`;
    return `<td data-fg="${escaped(fg)}" data-bg="${escaped(bg)}" data-verdict="${found.verdict}">${sampleOf(fg, bg, values, nonText)}<span class="ratio">${ratioText(found.ratio, labels)}</span><span class="verdict">${labels.charte[WORDS[found.verdict]]}</span></td>`;
  };
  const head = columns.map((bg) => `<th scope="col">${escaped(bg)}</th>`).join("");
  const body = rows.map((row) => `<tr><th scope="row">${escaped(row.fg)}</th>${row.cells.map((found, at) => cell(row.fg, columns[at], found, row.nonText)).join("")}</tr>`).join("");
  return `<div class="scroll"><table class="contrast"><caption>${escaped(labels.charte.contrast)}</caption><thead><tr><td></td>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

const rolesOf = (entries, values, labels) => list("swatches roles", entries.map((entry) => {
  const cites = entry.cites.length ? `<span class="cites">= ${escaped(entry.cites.join(", "))}</span>` : "";
  return item(entry, swatchOf(values.get(entry.name) ?? ""), nameOf(entry), cites, valueOf(shownValue(values.get(entry.name) ?? "")));
})) + contrastGridOf(entries, values, labels);

const spaceOf = (entries, values) => list("squares", entries.map((entry) => {
  const value = values.get(entry.name) ?? "";
  return item(entry, `<i class="square" style="inline-size: ${escaped(value)}; block-size: ${escaped(value)}"></i>`, nameOf(entry), valueOf(lengthText(value)));
}));

const radiusOf = (entries, values, labels) => list("tiles", entries.map((entry) => {
  const value = values.get(entry.name) ?? "";
  return item(entry, `<i class="tile" style="border-radius: ${escaped(value)}"></i>`, nameOf(entry), valueOf(lengthText(value)), pixelsOf(value) >= PILL_PX ? `<span class="cites">${labels.charte.pill}</span>` : "");
}));

const REFERENCE_PX = 44;
const sizeOf = (entries, values, labels) => list("sizes", entries.map((entry) => {
  const value = values.get(entry.name) ?? "";
  return item(entry, `<span class="size-pair"><i class="box" style="block-size: min(${escaped(value)}, 12rem)"></i><i class="reference" title="${REFERENCE_PX} px"></i></span>`, nameOf(entry), valueOf(lengthText(value)), `<span class="cites">${escaped(labels.charte.reference)}</span>`);
}));

const othersOf = (entries, values) => list("plain", entries.map((entry) => item(entry, nameOf(entry), valueOf(shownValue(values.get(entry.name) ?? "")))));

/** The groups of typography tokens that set a whole text role: `type.body` holding a family and a size, say. */
function roleGroupsOf(entries) {
  const found = new Map();
  for (const entry of entries) {
    const group = groupOf(entry.name);
    if (group && ROLE_LEAVES.includes(lastOf(entry.name))) found.set(group, [...(found.get(group) ?? []), entry]);
  }
  return new Map([...found].filter(([, own]) => own.length > 1));
}

const styleOf = (declarations) => declarations.map(([property, entry]) => `${property}: var(${entry.property})`).join("; ");
const LEAF_PROPERTY = { family: "font-family", size: "font-size", weight: "font-weight", "line-height": "line-height" };

const TYPE_STYLE = `
body { margin: 0; padding: 0 0 4px; color: #1d1d1b; font: 14px/1.4 system-ui, sans-serif; }
.row { display: grid; grid-template-columns: minmax(7rem, 14rem) minmax(0, 1fr); gap: 4px 16px; align-items: baseline; padding: 8px 0; border-top: 1px solid #e4e4df; }
.row:first-child { border-top: 0; }
.row span { min-width: 0; overflow-wrap: break-word; }
@media (max-width: 600px) { .row { grid-template-columns: minmax(0, 1fr); gap: 2px; } }
code { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: #6b6b64; overflow-wrap: anywhere; }
h3 { margin: 16px 0 0; font: 600 12px/16px system-ui, sans-serif; color: #5c5c55; }
`;

/** The typography of the charte as the document of one frame: roles first, then the size scale, weights, families and line heights. */
function typographyFrame(entries, labels, language, tokens) {
  const roles = roleGroupsOf(entries);
  const grouped = new Set([...roles.values()].flat().map((entry) => entry.name));
  const rest = entries.filter((entry) => !grouped.has(entry.name));
  const row = (label, sample, style = "") => `<div class="row"><code>${escaped(label)}</code><span style="${escaped(style)}">${sample}</span></div>`;
  const sample = escaped(labels.charte.sample);
  const blocks = [
    ...[...roles].map(([group, own]) => row(group, sample, styleOf(own.map((entry) => [LEAF_PROPERTY[lastOf(entry.name)], entry])))),
    ...rest.filter((entry) => entry.type === "dimension").map((entry) => row(entry.name, sample, styleOf([["font-size", entry]]))),
    ...rest.filter((entry) => entry.type === "fontWeight").map((entry) => row(entry.name, "Aa", styleOf([["font-weight", entry]]))),
    ...rest.filter((entry) => entry.type === "fontFamily").map((entry) => row(entry.name, sample, styleOf([["font-family", entry]]))),
    ...rest.filter((entry) => entry.type === "number").map((entry) => row(entry.name, "", "")),
  ];
  const doc = ["<!doctype html>", `<html lang="${language}">`, "<head>", '<meta charset="utf-8">', STYLESHEET_LINK, `<style>${TYPE_STYLE}</style>`, "</head>", "<body>", ...blocks, "</body>", "</html>"].join("\n");
  return `<div class="render bare"><iframe data-combo="a" title="${escaped(labels.charte.typographie.title)}" srcdoc="${escaped(inlined(doc, tokens))}"></iframe></div>`;
}

const MIN_WIDTH = /min-width:\s*([\d.]+(?:rem|em|px))/;
const minOf = (query) => MIN_WIDTH.exec(query)?.[1] ?? null;

/** The breakpoints as a ruler, narrowest first: a stop per breakpoint with its name and where it starts. An empty query is the default, up to the next width. */
function breakpointsOf(rows, labels) {
  const stops = rows.map((row) => ({ name: row.Name, query: row.Query, min: minOf(row.Query) }));
  const width = (stop) => (stop.min === null ? 0 : pixelsOf(stop.min));
  stops.sort((first, second) => width(first) - width(second));
  const stop = (one, at) => {
    const next = stops.slice(at + 1).find((other) => other.min !== null);
    const text = one.query === "" ? (next ? labels.charte.defaultQuery.replace("{min}", next.min) : labels.charte.defaultOnly) : one.query;
    const size = one.min === null ? "" : `<span class="value">${escaped(lengthText(one.min))}</span>`;
    return `<li data-breakpoint="${escaped(one.name)}"><i class="tick"></i><code class="name">${escaped(one.name)}</code><span class="cites">${escaped(text)}</span>${size}</li>`;
  }
  return `<ol class="ruler">${stops.map(stop).join("")}</ol>`;
}

/** The sections of the charte page: `{id, title, html}` in the order of the page, only those with something to show.
 * `entries` are the catalog's, `values` the base values, `citations` name to the names a token reads, `rows` the
 * Breakpoints table, `notes` the rest of system.md as html, `tokens` the stylesheet text. */
function charteSectionsOf({ entries, values, citations, primitives, rows, notes, tokens, labels, language }) {
  const held = charteOf(entries, primitives, citations);
  const bodies = {
    palette: () => paletteOf(held.palette, values),
    roles: () => rolesOf(held.roles, values, labels),
    typographie: () => (held.typographie.length ? typographyFrame(held.typographie, labels, language, tokens) : ""),
    espacements: () => spaceOf(held.espacements, values),
    arrondis: () => radiusOf(held.arrondis, values, labels),
    tailles: () => sizeOf(held.tailles, values, labels),
    "points-de-rupture": () => (rows.length ? breakpointsOf(rows, labels) : ""),
    autres: () => othersOf(held.autres, values),
  };
  const sections = Object.entries(bodies).map(([id, body]) => ({ id, title: labels.charte[id].title, lead: labels.charte[id].lead, body: body() }));
  if (notes) sections.push({ id: "notes", title: labels.charte.notes.title, lead: labels.charte.notes.lead, body: notes });
  return sections.filter((section) => section.body);
}

const slugOf = (name) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";

const TABLE_RULE = /^\|(?:\s*:?-+:?\s*\|)+\s*$/;

/** The lines with the header cells of their tables named in the language of `labels`, a cell it does not know as written. */
function columnsNamed(lines, labels) {
  const column = (cell) => { const name = cell.trim(); return Object.hasOwn(labels.columns, name) ? ` ${labels.columns[name]} ` : cell; };
  return lines.map((line, at) => (line.startsWith("|") && TABLE_RULE.test(lines[at + 1] ?? "") ? line.split("|").map(column).join("|") : line));
}

/** The sections of the identity page: one per `## ` heading of the lines, named in the language of `labels`. */
function identitySectionsOf(lines, labels) {
  const found = [];
  for (const line of lines) {
    const heading = SECTION_LINE.exec(line);
    if (heading) found.push({ name: heading[1], lines: [] });
    else if (found.length) found.at(-1).lines.push(line);
  }
  const used = new Set();
  return found.map(({ name, lines: own }) => {
    let id = slugOf(name);
    for (let n = 2; used.has(id); n += 1) id = `${slugOf(name)}-${n}`;
    used.add(id);
    const body = own.some((line) => line.trim()) ? documentOf(columnsNamed(own, labels).join(LINE_BREAK)) : "";
    return { id, title: Object.hasOwn(labels.sections, name) ? labels.sections[name] : name, body };
  });
}

/** One section as a native `section`, labelled by its heading. */
const sectionHtml = ({ id, title, lead, body }) => `<section id="${escaped(id)}" aria-labelledby="${escaped(id)}-title"><h2 id="${escaped(id)}-title">${escaped(title)}</h2>${lead ? `<p class="lead">${escaped(lead)}</p>` : ""}${body}</section>`;

/** The anchors of a list of sections in the navigation, under the page that holds them. */
const subNavigationOf = (page, sections) => (sections.length ? `<ul class="sub">${sections.map(({ id, title }) => `<li><a href="${escaped(page)}.html#${escaped(id)}">${escaped(title)}</a></li>`).join("")}</ul>` : "");

const CHARTE_STYLE = `
main section[id] { display: flex; flex-direction: column; gap: var(--s3); scroll-margin-top: var(--s5); }
main section[id] > h2 { margin: var(--s5) 0 0; font-size: var(--t-xl); line-height: 28px; font-weight: 600; }
main section[id] > .lead { margin: 0; max-width: 68ch; color: var(--muted); font-size: var(--t-md); }
main section[id] > .doc { background: none; border: 0; padding: 0; max-width: 68ch; }
main section[id] ul { list-style: none; margin: 0; padding: 0; }
main section[id] li { min-width: 0; }
.name { background: none; padding: 0; color: var(--faint); overflow-wrap: anywhere; }
.value { color: var(--text); font-size: var(--t-sm); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.cites { color: var(--muted); font-size: var(--t-sm); }
.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: var(--s4) var(--s3); }
.swatches li, .squares li, .tiles li, .sizes li { display: flex; flex-direction: column; align-items: flex-start; gap: var(--s1); }
.swatch { display: block; inline-size: 100%; block-size: 56px; border-radius: var(--r2); border: 1px solid var(--line-strong); background: repeating-conic-gradient(color-mix(in srgb, var(--faint) 20%, transparent) 0 25%, transparent 0 50%) 0 0 / 12px 12px; }
.squares, .tiles, .sizes { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--s5) var(--s5); }
.square { display: block; max-inline-size: 100%; background: var(--text); }
.tile { display: block; inline-size: 64px; block-size: 64px; background: var(--sunken); border: 2px solid var(--text); }
.size-pair { display: flex; align-items: flex-end; gap: var(--s2); }
.box { display: block; inline-size: 96px; background: var(--sunken); border: 1px solid var(--text); border-radius: var(--r1); }
.reference { display: block; block-size: ${REFERENCE_PX}px; inline-size: 0; border-left: 2px dashed var(--faint); }
.scroll { overflow-x: auto; max-inline-size: 100%; }
section[id] .render.bare { background: none; border: 0; border-radius: 0; padding: 0; }
.contrast { border-collapse: collapse; font-size: var(--t-sm); }
.contrast caption { text-align: left; color: var(--muted); padding-bottom: var(--s2); }
.contrast th, .contrast td { border: 1px solid var(--line); padding: var(--s2) var(--s3); text-align: left; vertical-align: top; font-weight: 400; }
.contrast thead th, .contrast tbody th { font: 12px var(--mono); color: var(--faint); background: var(--surface); }
.contrast td { background: var(--surface); }
.contrast td[data-verdict] { display: table-cell; }
.pair-sample { display: inline-block; padding: 2px var(--s3); border-radius: var(--r1); border: 1px solid var(--line-strong); font-size: var(--t-lg); font-weight: 600; }
.pair-line, .pair-ring { display: flex; align-items: center; justify-content: center; inline-size: 4.5rem; block-size: 2.25rem; border-radius: var(--r1); border: 1px solid var(--line-strong); }
.pair-line i { display: block; inline-size: 70%; block-size: 3px; }
.pair-ring i { display: block; inline-size: 70%; block-size: 1rem; border: 2px solid; border-radius: var(--r1); }
.ratio, .verdict { display: block; }
.ratio { margin-top: var(--s1); font-variant-numeric: tabular-nums; color: var(--text); }
.verdict { color: var(--muted); }
.contrast td[data-verdict="fail"] .verdict { color: var(--revise); font-weight: 600; }
.ruler { list-style: none; margin: 0; padding: var(--s3) 0 0; display: flex; flex-wrap: wrap; border-top: 2px solid var(--line-strong); }
.ruler li { position: relative; flex: 1 1 12rem; display: flex; flex-direction: column; gap: var(--s1); padding: var(--s3) var(--s3) var(--s3) 0; }
.ruler .tick { position: absolute; inset-block-start: calc(-1 * var(--s3) - 7px); inset-inline-start: 0; inline-size: 2px; block-size: 12px; background: var(--text); }
.plain li { display: flex; flex-wrap: wrap; gap: var(--s1) var(--s4); padding: var(--s2) 0; border-top: 1px solid var(--line); }
.plain li:first-child { border-top: 0; }
section[id] .render { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r3); padding: var(--s4) var(--s5); }
section[id] .render iframe { display: block; inline-size: 100%; border: 0; }
`;

module.exports = { charteSectionsOf, identitySectionsOf, columnsNamed, sectionHtml, subNavigationOf, CHARTE_STYLE };
