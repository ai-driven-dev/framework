// The showcase: one static page per record of the design system and a home page, rendered from
// the project, the engine's problems, the tokens stylesheet and the captures already read. Pure:
// the command reads the files and writes the pages. Each page holds the review of its record,
// handed back as one copy.
const { list, frontMatterEnd, LINE_BREAK } = require("./markdown.cjs");
const { placed, fm, verdictRows, stateVerdict, REVIEW_KIND, COMPONENT_KINDS, SYSTEM_ID } = require("./model.cjs");
const { renderOf } = require("./renders.cjs");
const { cited } = require("./graph.cjs");
const { parseLink } = require("./code.cjs");
const { text } = require("./project.cjs");
const { STYLE, escaped, documentOf, inlined, STYLESHEET_LINK } = require("./page.cjs");
const { catalog, resolvedValues, TYPES } = require("./tokens.cjs");

const DEFAULT_LANGUAGE = "en";
const UNRESOLVED = ["none", "pending"]; // a state still to review
const SYSTEM_KINDS = ["brand", "system"];
const LEVELS = ["asset", ...COMPONENT_KINDS];
const BASE_CONTEXT = ""; // the key of `resolvedValues` for the base
const UNTYPED = "css"; // the section of the tokens that hold raw CSS and no `$type`
const SAMPLE = "Aa";
const GROUPS = ["system", "components", "journeys", "templates", "pages"];

/** The words of the page chrome, one table per language: the same keys in each. */
const LABELS = {
  en: {
    title: "Design system showcase",
    pick: "Pick a record in the list.",
    home: "Overview",
    list: "Records",
    system: "Brand and system",
    components: "Components",
    journeys: "Journeys",
    templates: "Templates",
    pages: "Pages",
    asset: "Assets",
    atom: "Atoms",
    molecule: "Molecules",
    organism: "Organisms",
    uses: "Uses",
    usedBy: "Used by",
    checks: "Engine checks",
    review: "Review",
    count: "{ok}/{total} OK",
    ok: "OK",
    revise: "Revise",
    comment: "What should change?",
    outdated: "outdated, v{version}",
    noCapture: "No capture. Save it at {path}",
    capture: "Capture of {state}",
    copy: "Copy the review",
    copied: "Copied",
    batch: "Still to review",
    batchHint: "Uncheck a record to review it on its page.",
    allOk: "All OK, copy",
    blocked: "Write what should change on each state to revise.",
    theme: "Theme",
    platform: "Platform",
    sides: "Side by side",
    combination: "Combination",
    tokens: "Tokens",
  },
  fr: {
    title: "Vitrine du système de design",
    pick: "Choisissez une fiche dans la liste.",
    home: "Aperçu",
    list: "Fiches",
    system: "Marque et système",
    components: "Composants",
    journeys: "Parcours",
    templates: "Modèles",
    pages: "Pages",
    asset: "Ressources",
    atom: "Atomes",
    molecule: "Molécules",
    organism: "Organismes",
    uses: "Utilise",
    usedBy: "Utilisé par",
    checks: "Contrôles du moteur",
    review: "Revue",
    count: "{ok}/{total} OK",
    ok: "OK",
    revise: "À revoir",
    comment: "Que faut-il changer ?",
    outdated: "obsolète, v{version}",
    noCapture: "Aucune capture. Enregistrez-la dans {path}",
    capture: "Capture de {state}",
    copy: "Copier la revue",
    copied: "Copié",
    batch: "Encore à juger",
    batchHint: "Décochez une fiche pour la juger sur sa page.",
    allOk: "Tout OK, copier",
    blocked: "Écrivez ce qu'il faut changer sur chaque état à revoir.",
    theme: "Thème",
    platform: "Plateforme",
    sides: "Côte à côte",
    combination: "Combinaison",
    tokens: "Tokens",
  },
};

/** The language `code` names, English when there is no table for it. */
const languageOf = (code) => (Object.hasOwn(LABELS, code) ? code : DEFAULT_LANGUAGE);

const filled = (label, values) => label.replace(/\{(\w+)\}/g, (_, key) => values[key]);
const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // the same order on every machine
const byRecordId = (a, b) => byCode(fm(a).id, fm(b).id);

const LAYOUT = `
body { display: block; height: auto; }
.shell { display: grid; grid-template-columns: 16rem minmax(0, 1fr); min-height: 100vh; }
.shell > nav, .shell > main { grid-area: auto; }
.shell > main > h1 { font-size: 24px; line-height: 1.25; white-space: normal; }
.shell > nav { position: sticky; top: 0; height: 100vh; }
.shell > main { padding: 24px; min-width: 0; display: flex; flex-direction: column; gap: 24px; }
nav h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 16px 8px 4px; }
nav h3 { font-size: 12px; color: var(--muted); margin: 8px 8px 2px; }
nav ul, .links ul, .checks ul { list-style: none; margin: 0; padding: 0; }
nav li { padding: 2px 8px; display: flex; gap: 6px; align-items: center; }
nav a, .links a { color: var(--accent-text); text-decoration: none; }
nav a[aria-current="page"] { font-weight: 600; color: var(--text); }
.tag { font-size: 10px; border-radius: 4px; padding: 0 4px; background: var(--revise-bg); color: var(--revise-fg); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.chip { display: inline-flex; gap: 6px; border-radius: 999px; padding: 0 8px; line-height: 20px; font-size: 12px; background: var(--pill); color: var(--pill-text); }
.chip[data-status="proposed"] { background: var(--revise-bg); color: var(--revise-fg); }
.key { color: var(--muted); }
.links { display: flex; gap: 8px; flex-wrap: wrap; align-items: baseline; }
.links h2, .checks h2, .review h2 { font-size: 13px; margin: 0; }
.links ul { display: flex; gap: 12px; flex-wrap: wrap; }
.checks li { padding: 2px 0; }
.review { display: flex; flex-direction: column; gap: 16px; }
.review .bar-top, .review .toolbar, .gallery .toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.review fieldset, .gallery fieldset { border: 0; display: flex; gap: 8px; align-items: center; padding: 0; margin: 0; }
.state { border: 1px solid var(--line); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.state h3 { margin: 0; font-size: 13px; }
.state[data-current="ok"] { border-color: var(--keep-dot); }
.state[data-current="revise"] { border-color: var(--revise-dot); }
.pair { display: flex; gap: 12px; flex-wrap: wrap; }
.render { display: flex; gap: 12px; flex: 1 1 24rem; min-width: 0; }
.render iframe { flex: 1; min-width: 0; width: 100%; min-block-size: 120px; border: 1px solid var(--line); border-radius: 6px; background: #fff; }
.render iframe[data-platform="mobile"] { flex: 0 0 390px; inline-size: 390px; }
.capture { flex: 1 1 24rem; margin: 0; min-width: 0; }
.capture img { max-width: 100%; border: 1px solid var(--line); border-radius: 6px; }
.capture.missing { display: flex; align-items: center; justify-content: center; border: 1px dashed var(--line); border-radius: 6px; color: var(--muted); padding: 12px; }
.choose { display: flex; gap: 8px; }
.verdict[aria-pressed="true"] { background: var(--sel); border-color: var(--sel-line); }
.outdated, .said, .count { margin: 0; color: var(--muted); }
.batch { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.batch h2, .batch p { margin: 0; }
.batch ul { list-style: none; margin: 0; padding: 0; }
textarea.out { width: 100%; min-height: 8rem; font: 12px ui-monospace, monospace; }
textarea.comment { width: 100%; font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 6px; }
`;

/** The delivery of a copy, shared by the pages that hand a review back: the clipboard, else a text area to copy from. */
const DELIVER = `
function shown(button, content) {
  const area = document.querySelector("textarea.out") || button.insertAdjacentElement("afterend", document.createElement("textarea"));
  area.className = "out";
  area.readOnly = true;
  area.value = content;
  area.focus();
  area.select();
}
function deliver(button, content) {
  Promise.resolve().then(() => navigator.clipboard.writeText(content)).then(() => {
    const label = button.textContent;
    button.textContent = button.dataset.copied;
    setTimeout(() => { button.textContent = label; }, 1500);
  }, () => shown(button, content));
}
`;

/** The script of a page that shows frames: the theme and platform dressing, the twin beside, the height of the content. */
const FRAMES = `
const frames = () => [...document.querySelectorAll(".render iframe")];
const combination = (name) => {
  const pick = {};
  document.querySelectorAll('[data-combo="' + name + '"] select').forEach((select) => { pick[select.dataset.axis] = select.value; });
  return pick;
};
function dress(frame) {
  const root = frame.contentDocument && frame.contentDocument.documentElement;
  if (!root) return;
  const pick = combination(frame.dataset.combo);
  for (const axis in pick) root.dataset[axis] = pick[axis];
  if (pick.platform) frame.dataset.platform = pick.platform;
  fit(frame);
}
function fit(frame) {
  frame.style.height = "";
  frame.style.height = frame.contentDocument.documentElement.scrollHeight + "px";
}
function watch(frame) {
  frame.addEventListener("load", () => dress(frame));
  dress(frame);
}
frames().forEach(watch);
document.querySelectorAll(".toolbar select").forEach((select) => select.addEventListener("change", () => frames().forEach(dress)));
const sides = document.getElementById("sides");
if (sides) sides.addEventListener("click", () => {
  const on = sides.getAttribute("aria-pressed") !== "true";
  sides.setAttribute("aria-pressed", String(on));
  document.querySelector('[data-combo="b"]').hidden = !on;
  for (const holder of document.querySelectorAll(".render")) {
    const own = holder.querySelectorAll("iframe");
    if (on && own.length === 1) {
      const twin = own[0].cloneNode();
      twin.dataset.combo = "b";
      holder.append(twin);
      watch(twin);
    }
    if (!on && own.length === 2) own[1].remove();
  }
  frames().forEach(dress);
});
`;

/** The script of a page that hands a review back: a verdict by state, then one copy. */
const REVIEW = `${DELIVER}
const review = document.querySelector(".review");
const copy = document.getElementById("copy");
const note = document.getElementById("note");
const chosen = () => [...review.querySelectorAll("article.state")].filter((article) => article.dataset.choice).map((article) => ({ state: article.dataset.state, verdict: article.dataset.choice, comment: article.querySelector(".comment").value.trim() }));
const blocked = () => chosen().some((entry) => entry.verdict === "revise" && !entry.comment);
function refresh() {
  const stuck = blocked();
  copy.disabled = stuck || chosen().length === 0;
  note.textContent = stuck ? copy.dataset.blocked : "";
}
review.querySelectorAll("article.state").forEach((article) => {
  const field = article.querySelector(".comment");
  article.querySelectorAll(".verdict").forEach((button) => button.addEventListener("click", () => {
    article.dataset.choice = button.dataset.verdict;
    article.querySelectorAll(".verdict").forEach((each) => each.setAttribute("aria-pressed", String(each === button)));
    field.hidden = button.dataset.verdict !== "revise";
    refresh();
  }));
  field.addEventListener("input", refresh);
});
copy.addEventListener("click", () => {
  if (blocked()) return;
  const body = { record: review.dataset.record, version: Number(review.dataset.version), verdicts: chosen() };
  const content = "\`\`\`json\\n" + JSON.stringify(body, null, 2) + "\\n\`\`\`\\n";
  deliver(copy, content);
});
refresh();
`;

/** The script of the home page: the records still checked are handed back as OK in one copy. */
const HOME_SCRIPT = `${DELIVER}
const batch = document.querySelector(".batch");
const copy = document.getElementById("copy-all");
const checked = () => [...batch.querySelectorAll("li[data-record]")].filter((item) => item.querySelector("input").checked);
const refresh = () => { copy.disabled = checked().length === 0; };
batch.querySelectorAll("input").forEach((box) => box.addEventListener("change", refresh));
copy.addEventListener("click", () => {
  const body = checked().map((item) => ({ record: item.dataset.record, version: Number(item.dataset.version), verdicts: JSON.parse(item.dataset.states).map((state) => ({ state, verdict: "ok", comment: "" })) }));
  deliver(copy, "\`\`\`json\\n" + JSON.stringify(body, null, 2) + "\\n\`\`\`\\n");
});
refresh();
`;

/** What a review says of a state of `record`: `current` is the verdict that decides it at the record's version
 * ("none" when there is none), `outdated` the version of the latest older verdict when only older ones exist. */
function verdictOf(rows, record, state) {
  const now = stateVerdict(rows, record, state);
  if (now) return { current: now.Verdict, comment: now.Comment ?? "", outdated: null };
  const older = rows.filter((row) => row.Screen === fm(record).id && row.State === state).map((row) => row.Version).sort((a, b) => Number(b) - Number(a))[0];
  return { current: "none", comment: "", outdated: older ?? null };
}

/** Whether the record has a render to show state by state. */
const hasRender = (project, record) => list(fm(record).states).length > 0 && project.renders.includes(renderOf(record)) && text(project, renderOf(record)) !== null;

/** Whether a screen's code is at its version: its states then each need a capture. */
const isCoded = (record) => fm(record).kind === "screen" && list(fm(record).code).some((link) => parseLink(link)?.version === fm(record).version);

/** The group of the navigation a record belongs to. */
function groupOf(record) {
  const kind = fm(record).kind;
  if (SYSTEM_KINDS.includes(kind)) return "system";
  if (kind === "journey") return "journeys";
  if (kind === "wireframe") return "templates";
  if (kind === "screen") return "pages";
  return "components";
}

const link = (id, current) => `<a href="${escaped(id)}.html"${current ? ' aria-current="page"' : ""}>${escaped(id)}</a>`;

/** The navigation, the same on every page: each group in the order of the paths. */
function navigationOf(records, labels, current) {
  const item = (record) => `<li data-id="${escaped(fm(record).id)}">${link(fm(record).id, fm(record).id === current)}${fm(record).status === "proposed" ? `<span class="tag">proposed</span>` : ""}</li>`;
  const sections = GROUPS.flatMap((group) => {
    const own = records.filter((record) => groupOf(record) === group);
    if (!own.length) return [];
    if (group !== "components") return [`<section data-group="${group}"><h2>${labels[group]}</h2><ul>${own.sort(byRecordId).map(item).join("")}</ul></section>`];
    const levels = LEVELS.flatMap((level) => {
      const inLevel = own.filter((record) => fm(record).kind === level);
      return inLevel.length ? [`<h3>${labels[level]}</h3><ul data-level="${level}">${inLevel.sort(byRecordId).map(item).join("")}</ul>`] : [];
    });
    return [`<section data-group="${group}"><h2>${labels[group]}</h2>${levels.join("")}</section>`];
  });
  return `<nav aria-label="${escaped(labels.list)}"><p><a href="index.html"${current === null ? ' aria-current="page"' : ""}>${labels.home}</a></p>${sections.join("")}</nav>`;
}

const chipOf = (key, value) => `<span class="chip" data-key="${key}"><span class="key">${key}</span>${escaped(String(value))}</span>`;

/** The chips under the title of a record: its status, kind, version, route and code links. */
function chipsOf(record) {
  const { status, kind, version, route } = fm(record);
  return [
    ...(status === undefined ? [] : [`<span class="chip" data-status="${escaped(status)}">${escaped(status)}</span>`]),
    chipOf("kind", kind),
    ...(version === undefined ? [] : [chipOf("version", version)]),
    ...(route === undefined ? [] : [chipOf("route", route)]),
    ...list(fm(record).code).map((code) => chipOf("code", code)),
  ].join("");
}

const linksOf = (kind, label, ids) => (ids.length ? `<section class="links" data-links="${kind}"><h2>${label}</h2><ul>${ids.map((id) => `<li>${link(id, false)}</li>`).join("")}</ul></section>` : "");

/** The engine checks about a record or its render. */
function checksOf(problems, record, labels) {
  const own = problems.filter((each) => each.file === record.file || each.file === renderOf(record));
  if (!own.length) return "";
  const items = own.map((each) => `<li data-rule="${escaped(each.rule)}"><b>${escaped(each.rule)}</b> ${escaped(each.message)} <span class="fix">${escaped(each.fix)}</span></li>`);
  return `<section class="checks"><h2>${labels.checks}</h2><ul>${items.join("")}</ul></section>`;
}

/** The document of one state of a render: the tokens inline, every other state hidden. A render without `</head>` keeps every state visible in each frame: a known limit. */
function stateDocument(render, tokens, state) {
  const hide = `<style>[data-state]:not([data-state=${JSON.stringify(state)}]) { display: none !important; }</style>`;
  const doc = inlined(render, tokens);
  return doc.replace(/<\/head>/i, () => `${hide}</head>`);
}

const optionsOf = (values, second) => values.map((value, at) => `<option value="${escaped(value)}"${second && at === 1 ? " selected" : ""}>${escaped(value)}</option>`).join("");

/** The theme and platform pickers: a combination A, a combination B shown beside it on request. */
function toolbarOf(system, labels) {
  const axes = [["theme", labels.theme, list(system && fm(system).themes)], ["platform", labels.platform, list(system && fm(system).platforms)]].filter(([, , values]) => values.length);
  if (!axes.length) return "";
  const combo = (name, second) => `<fieldset data-combo="${name}"${second ? " hidden" : ""}><legend>${labels.combination} ${name.toUpperCase()}</legend>${axes.map(([axis, label, values]) => `<label>${label} <select data-axis="${axis}">${optionsOf(values, second)}</select></label>`).join("")}</fieldset>`;
  return `<div class="toolbar">${combo("a", false)}${combo("b", true)}<button type="button" id="sides" aria-pressed="false">${labels.sides}</button></div>`;
}

/** One state of a record: its render, the capture beside it for a coded screen, and the two choices. */
function stateOf({ record, state, verdict, render, tokens, captures, labels, platform }) {
  const { id, version } = fm(record);
  const file = `${record.folder}/${id}.${state}@${version}.png`;
  const capture = !isCoded(record) ? "" : captures.has(file) ? `<figure class="capture" data-file="${escaped(file)}"><img src="../${escaped(file)}" alt="${escaped(filled(labels.capture, { state }))}"></figure>` : `<div class="capture missing" data-file="${escaped(file)}">${escaped(filled(labels.noCapture, { path: file }))}</div>`;
  return [
    `<article class="state" data-state="${escaped(state)}" data-current="${escaped(verdict.current)}">`,
    `<h3>${escaped(state)}</h3>`,
    verdict.outdated === null ? "" : `<p class="outdated" data-version="${escaped(verdict.outdated)}">${escaped(filled(labels.outdated, { version: verdict.outdated }))}</p>`,
    verdict.comment ? `<p class="said">${escaped(verdict.comment)}</p>` : "",
    `<div class="pair"><div class="render"><iframe data-combo="a"${platform} title="${escaped(`${id} ${state}`)}" srcdoc="${escaped(stateDocument(render, tokens, state))}"></iframe></div>${capture}</div>`,
    `<div class="choose"><button type="button" class="verdict" data-verdict="ok" aria-pressed="false">${labels.ok}</button><button type="button" class="verdict" data-verdict="revise" aria-pressed="false">${labels.revise}</button></div>`,
    `<textarea class="comment" rows="2" hidden placeholder="${escaped(labels.comment)}" aria-label="${escaped(labels.comment)}"></textarea>`,
    "</article>",
  ].filter(Boolean).join("\n");
}

const GALLERY_STYLE = `
body { margin: 0; padding: 16px; font-size: 13px; }
h2 { font-size: 15px; margin: 0 0 8px; }
h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.6; margin: 16px 0 4px; }
ul { list-style: none; margin: 0; padding: 0; }
li { display: grid; grid-template-columns: minmax(8rem, 1fr) minmax(6rem, 1fr) 2fr; gap: 12px; align-items: center; padding: 4px 0; border-bottom: 1px solid #8884; }
code, .value { overflow-wrap: anywhere; }
.value { opacity: 0.7; }
.swatch { display: block; inline-size: 48px; block-size: 24px; border-radius: 4px; border: 1px solid #8886; }
.bar { display: block; block-size: 12px; background: #888; border-radius: 2px; }
`;

/** What shows a token in the gallery: a swatch, a bar, a sample of text, or nothing beside its value. */
function specimenOf({ type, property }) {
  const use = `var(${escaped(property)})`;
  if (type === "color") return `<i class="swatch" style="background: ${use}"></i>`;
  if (type === "dimension") return `<i class="bar" style="inline-size: min(${use}, 100%)"></i>`;
  if (type === "fontFamily") return `<span style="font-family: ${use}">${SAMPLE}</span>`;
  if (type === "fontWeight") return `<span style="font-weight: ${use}">${SAMPLE}</span>`;
  return "";
}

/** The gallery of the system page: every token by type in a frame that holds the stylesheet, with the
 * value it has in the base context. Nothing without a stylesheet. */
function galleryOf({ project, system, tokens, labels, language }) {
  const entries = tokens === null ? [] : catalog(project);
  if (!entries.length) return "";
  const values = resolvedValues(project).get(BASE_CONTEXT) ?? new Map();
  const row = (entry) => `<li data-token="${escaped(entry.name)}"><code>${escaped(entry.name)}</code><span class="value">${escaped(values.get(entry.name) ?? "")}</span><span class="specimen">${specimenOf(entry)}</span></li>`;
  const sections = [...TYPES, UNTYPED].flatMap((type) => {
    const own = entries.filter((entry) => (entry.type ?? UNTYPED) === type);
    return own.length ? [`<section data-type="${type}"><h3>${type}</h3><ul>${own.map(row).join("")}</ul></section>`] : [];
  });
  const doc = ["<!doctype html>", `<html lang="${language}">`, "<head>", '<meta charset="utf-8">', STYLESHEET_LINK, `<style>${GALLERY_STYLE}</style>`, "</head>", "<body>", `<h2>${labels.tokens}</h2>`, ...sections, "</body>", "</html>"].join("\n");
  return `<section class="gallery">${toolbarOf(system, labels)}<div class="pair"><div class="render"><iframe data-combo="a"${platformOf(system)} title="${escaped(labels.tokens)}" srcdoc="${escaped(inlined(doc, tokens))}"></iframe></div></div></section>`;
}

/** The `data-platform` attribute of a frame: the first platform the system declares, none without one. */
const platformOf = (system) => (system && list(fm(system).platforms).length ? ` data-platform="${escaped(list(fm(system).platforms)[0])}"` : "");

/** The review of a record: each state, the ones still to review first, and the one copy. */
function reviewOf({ project, system, record, rows, tokens, captures, labels }) {
  const render = text(project, renderOf(record));
  const states = list(fm(record).states).map((state) => ({ state, verdict: verdictOf(rows, record, state) }));
  const ok = states.filter(({ verdict }) => verdict.current === "ok").length;
  const ordered = [...states.filter(({ verdict }) => UNRESOLVED.includes(verdict.current)), ...states.filter(({ verdict }) => !UNRESOLVED.includes(verdict.current))];
  return [
    `<section class="review" data-record="${escaped(fm(record).id)}" data-version="${escaped(String(fm(record).version))}">`,
    `<div class="bar-top"><h2>${labels.review}</h2><p class="count" data-ok="${ok}" data-total="${states.length}">${filled(labels.count, { ok, total: states.length })}</p><button type="button" id="copy" data-copied="${escaped(labels.copied)}" data-blocked="${escaped(labels.blocked)}">${labels.copy}</button><span id="note" role="status"></span></div>`,
    toolbarOf(system, labels),
    ...ordered.map(({ state, verdict }) => stateOf({ record, state, verdict, render, tokens, captures, labels, platform: platformOf(system) })),
    "</section>",
  ].join("\n");
}

/** The records of the home page's batch, by id: reviewable, not coded, no state to revise, at least one state not ok. */
function batchOf({ project, records, rows, labels }) {
  const entries = records.filter((record) => hasRender(project, record) && !isCoded(record)).sort(byRecordId).flatMap((record) => {
    const verdicts = list(fm(record).states).map((state) => ({ state, current: verdictOf(rows, record, state).current }));
    const left = verdicts.filter(({ current }) => current !== "ok").map(({ state }) => state);
    return left.length && !verdicts.some(({ current }) => current === "revise") ? [{ record, left }] : [];
  });
  if (!entries.length) return "";
  const item = ({ record, left }) => `<li data-record="${escaped(fm(record).id)}" data-version="${escaped(String(fm(record).version))}" data-states="${escaped(JSON.stringify(left))}"><label><input type="checkbox" checked> ${link(fm(record).id, false)}</label></li>`;
  return `<section class="batch" data-records="${entries.length}"><h2>${labels.batch}</h2><p>${labels.batchHint}</p><ul>${entries.map(item).join("")}</ul><button type="button" id="copy-all" data-copied="${escaped(labels.copied)}">${labels.allOk}</button></section>`;
}

/** The record as text under its title, without its front matter: the chips above show it. */
function specOf(project, record) {
  const lines = (text(project, record.file) ?? "").split(LINE_BREAK);
  return documentOf(lines.slice(frontMatterEnd(lines) + 1).join(LINE_BREAK));
}

const pageOf = (title, lang, navigation, body, script) => ["<!doctype html>", `<html lang="${lang}">`, "<head>", '<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">', `<title>${escaped(title)}</title>`, `<style>${STYLE}${LAYOUT}</style>`, "</head>", "<body>", '<div class="shell">', navigation, "<main>", body, "</main>", "</div>", ...(script ? [`<script>${script}</script>`] : []), "</body>", "</html>", ""].join("\n");

/** The pages of the showcase by file name: `index.html` and one page per record that is not a review.
 * `problems` are the engine's, `tokens` the stylesheet text or null, `captures` the png paths beside
 * the records, relative to the design system folder. */
function showcaseOf({ project, problems, tokens, captures, lang }) {
  const language = languageOf(lang);
  const labels = LABELS[language];
  const records = placed(project).filter((record) => fm(record).kind !== REVIEW_KIND && fm(record).id);
  const ids = new Set(records.map((record) => fm(record).id));
  const rows = verdictRows(placed(project));
  const system = project.records.find((record) => fm(record).kind === "system");
  const batch = batchOf({ project, records, rows, labels });
  const pages = { "index.html": pageOf(labels.title, language, navigationOf(records, labels, null), `<h1>${labels.title}</h1><p>${labels.pick}</p>${batch}`, batch ? HOME_SCRIPT : "") };
  for (const record of records) {
    const id = fm(record).id;
    const uses = [...new Set(cited(record))].filter((each) => each !== id && ids.has(each)).sort(byCode);
    const usedBy = records.filter((other) => fm(other).id !== id && cited(other).includes(id)).map((other) => fm(other).id).sort(byCode);
    const reviewed = hasRender(project, record);
    const body = [
      `<h1>${escaped(id)}</h1>`,
      `<div class="chips">${chipsOf(record)}</div>`,
      linksOf("uses", labels.uses, uses),
      linksOf("used-by", labels.usedBy, usedBy),
      id === SYSTEM_ID ? galleryOf({ project, system, tokens, labels, language }) : "",
      reviewed ? reviewOf({ project, system, record, rows, tokens, captures, labels }) : "",
      checksOf(problems, record, labels),
      specOf(project, record),
    ].filter(Boolean).join("\n");
    pages[`${id}.html`] = pageOf(id, language, navigationOf(records, labels, id), body, reviewed ? FRAMES + REVIEW : id === SYSTEM_ID ? FRAMES : "");
  }
  return pages;
}

module.exports = { showcaseOf, languageOf, LABELS };
