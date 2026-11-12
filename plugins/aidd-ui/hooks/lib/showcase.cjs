// The showcase: one static page per record of the design system and a home page, rendered from
// the project, the engine's problems, the tokens stylesheet and the captures already read. Pure:
// the command reads the files and writes the pages. Each page holds the review of its record,
// handed back as one copy.
const { list, table, frontMatterEnd, LINE_BREAK } = require("./markdown.cjs");
const { placed, fm, STEPS_SECTION, PERSONA_SECTION, verdictRows, stateVerdict, REVIEW_KIND, COMPONENT_KINDS, SYSTEM_ID } = require("./model.cjs");
const { renderOf } = require("./renders.cjs");
const { cited } = require("./graph.cjs");
const { parseLink } = require("./code.cjs");
const { text } = require("./project.cjs");
const { escaped, documentOf, inlined, STYLESHEET_LINK } = require("./page.cjs");
const { catalog, resolvedValues, TYPES } = require("./tokens.cjs");

const DEFAULT_LANGUAGE = "en";
const UNRESOLVED = ["none", "pending"]; // a state still to review
const SYSTEM_KINDS = ["brand", "system"];
const LEVELS = ["asset", ...COMPONENT_KINDS];
const BASE_CONTEXT = ""; // the key of `resolvedValues` for the base
const UNTYPED = "css"; // the section of the tokens that hold raw CSS and no `$type`
const SAMPLE = "Aa";
const EXPECTED_COMPONENT = "R18";
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
    templates: "Wireframes",
    pages: "Pages",
    asset: "Assets",
    atom: "Atoms",
    molecule: "Molecules",
    organism: "Organisms",
    uses: "Uses",
    appearsIn: "Appears in",
    checks: "Engine checks",
    review: "Review",
    ok: "OK",
    revise: "Revise",
    comment: "What should change?",
    outdated: "outdated, v{version}",
    noCapture: "No capture. Save it at {path}",
    capture: "Capture of {state}",
    copy: "Finish and copy",
    copied: "Copied",
    clear: "Clear",
    allOk: "Mark the remaining as OK",
    close: "Close",
    nothing: "Nothing to review yet.",
    blocked: "Write what should change on each state to revise.",
    theme: "Theme",
    platform: "Platform",
    sides: "Side by side",
    combination: "Combination",
    tokens: "Tokens",
    forPersona: "For",
    states: "States",
    steps: "{count} steps",
    noRender: "No render",
  },
  fr: {
    title: "Vitrine du système de design",
    pick: "Choisissez une fiche dans la liste.",
    home: "Aperçu",
    list: "Fiches",
    system: "Marque et système",
    components: "Composants",
    journeys: "Parcours",
    templates: "Wireframes",
    pages: "Pages",
    asset: "Ressources",
    atom: "Atomes",
    molecule: "Molécules",
    organism: "Organismes",
    uses: "Utilise",
    appearsIn: "Apparaît dans",
    checks: "Contrôles du moteur",
    review: "Revue",
    ok: "OK",
    revise: "À revoir",
    comment: "Que faut-il changer ?",
    outdated: "obsolète, v{version}",
    noCapture: "Aucune capture. Enregistrez-la dans {path}",
    capture: "Capture de {state}",
    copy: "Terminer et copier",
    copied: "Copié",
    clear: "Effacer",
    allOk: "Marquer le reste OK",
    close: "Fermer",
    nothing: "Rien à juger pour l'instant.",
    blocked: "Écrivez ce qu'il faut changer sur chaque état à revoir.",
    theme: "Thème",
    platform: "Plateforme",
    sides: "Côte à côte",
    combination: "Combinaison",
    tokens: "Tokens",
    forPersona: "Pour",
    states: "États",
    steps: "{count} étapes",
    noRender: "Aucun rendu",
  },
};

/** The language `code` names, English when there is no table for it. */
const languageOf = (code) => (Object.hasOwn(LABELS, code) ? code : DEFAULT_LANGUAGE);

const filled = (label, values) => label.replace(/\{(\w+)\}/g, (_, key) => values[key]);
const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // the same order on every machine
const byRecordId = (a, b) => byCode(fm(a).id, fm(b).id);
const byLevel = (a, b) => LEVELS.indexOf(fm(a).kind) - LEVELS.indexOf(fm(b).kind) || byRecordId(a, b);

/** The look of the showcase, light on purpose: wireframes are paper and renders are mostly light
 * screens, so a light shell frames them like a design tool's canvas instead of glaring against them.
 * One scale for space, type and radius, one accent, the system fonts only. */
const SHELL = `
:root { color-scheme: light;
  --bg: #f5f5f3; --surface: #ffffff; --sunken: #eeeeeb; --canvas: #ebebe7; --line: #e3e3df; --line-strong: #d2d2cc;
  --text: #1d1d1b; --muted: #66665f; --faint: #96968f;
  --accent: #4f46e5; --accent-hover: #4338ca; --accent-soft: #eef0fe; --accent-text: #4338ca;
  --ok: #15803d; --ok-soft: #e6f4ea; --revise: #b45309; --revise-soft: #fdf2e1; --pending: #96968f;
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px;
  --r1: 6px; --r2: 10px; --r3: 14px; --drawer: 380px;
  --t-xs: 11px; --t-sm: 12px; --t-md: 14px; --t-lg: 16px; --t-xl: 20px; --t-2xl: 28px;
  --shadow-1: 0 1px 2px rgba(24, 24, 20, 0.06); --shadow-2: 0 1px 2px rgba(24, 24, 20, 0.06), 0 8px 24px rgba(24, 24, 20, 0.08);
  --font: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; background: var(--bg); color: var(--text); font: var(--t-md)/1.5 var(--font); -webkit-font-smoothing: antialiased; }
a { color: var(--accent-text); text-decoration: none; }
a:hover { text-decoration: underline; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
code { font: var(--t-sm) var(--mono); background: var(--sunken); border-radius: 4px; padding: 1px 5px; }
button { font: 500 var(--t-sm)/1 var(--font); color: var(--text); background: var(--surface); border: 1px solid var(--line-strong); border-radius: var(--r1); height: 32px; padding: 0 var(--s3); cursor: pointer; transition: background-color 120ms, border-color 120ms, color 120ms; }
button:hover { background: var(--sunken); }
button:disabled { opacity: 0.45; cursor: default; }
#copy { background: var(--accent); border-color: var(--accent); color: #fff; }
#copy:hover:not(:disabled) { background: var(--accent-hover); }
select { appearance: none; font: inherit; font-size: var(--t-sm); color: var(--text); background: var(--surface); border: 1px solid var(--line-strong); border-radius: var(--r1); height: 32px; padding: 0 var(--s5) 0 var(--s2); }
.shell { display: grid; grid-template-columns: 248px minmax(0, 1fr); min-height: 100vh; }
.shell > nav { position: sticky; top: 0; height: 100vh; overflow: auto; background: var(--surface); border-right: 1px solid var(--line); padding: var(--s4) var(--s3) var(--s6); }
.shell > main { min-width: 0; padding: var(--s6) var(--s7) var(--s7); display: flex; flex-direction: column; gap: var(--s5); max-width: 1320px; }
nav .brand { display: flex; align-items: center; gap: var(--s2); padding: var(--s1) var(--s2) var(--s4); font-size: var(--t-sm); font-weight: 600; }
nav .mark { inline-size: 18px; block-size: 18px; border-radius: 5px; background: linear-gradient(135deg, var(--accent), #8b5cf6); flex: none; }
nav .home { margin: 0; }
nav h2 { font-size: var(--t-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--faint); margin: var(--s5) var(--s2) var(--s1); }
nav h3 { font-size: var(--t-xs); font-weight: 500; color: var(--muted); margin: var(--s3) var(--s2) 2px; }
nav ul, .links ul, .checks ul, .appears ul, .drawer ol { list-style: none; margin: 0; padding: 0; }
nav li, nav .home { display: flex; align-items: center; gap: var(--s2); border-radius: var(--r1); }
nav li a, nav .home a { flex: 1; min-width: 0; padding: 5px var(--s2); color: var(--text); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
nav li:hover, nav .home:hover { background: var(--sunken); }
nav a:hover { text-decoration: none; }
nav li:has(a[aria-current="page"]), nav .home:has(a[aria-current="page"]) { background: var(--accent-soft); }
nav a[aria-current="page"] { color: var(--accent-text); font-weight: 600; }
.tag { flex: none; margin-right: var(--s2); font-size: 10px; font-weight: 500; border-radius: 999px; padding: 1px 6px; background: var(--revise-soft); color: var(--revise); }
.head { display: flex; flex-direction: column; gap: var(--s2); }
.crumb { margin: 0; font-size: var(--t-sm); font-weight: 500; color: var(--faint); }
.head h1, main > h1 { margin: 0; font-size: var(--t-2xl); line-height: 1.2; font-weight: 650; letter-spacing: -0.01em; }
.lede { margin: 0; color: var(--muted); font-size: var(--t-lg); max-width: 72ch; }
.head .persona { margin: 0; color: var(--muted); max-width: 72ch; }
.chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: var(--s1) 0 0; }
.version { color: var(--faint); font-size: var(--t-sm); font-weight: 500; margin-right: var(--s2); }
.chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 0 10px; line-height: 22px; font-size: var(--t-sm); color: var(--text); }
.chip .key { color: var(--faint); }
.chip[data-key="code"] { font-family: var(--mono); font-size: var(--t-xs); }
.chip[data-status] { border-color: transparent; font-weight: 500; }
.chip[data-status="proposed"] { background: var(--revise-soft); color: var(--revise); }
.chip[data-status="validated"] { background: var(--ok-soft); color: var(--ok); }
.chip[data-status]::before { content: ""; inline-size: 6px; block-size: 6px; border-radius: 50%; background: currentColor; }
.links { display: flex; gap: var(--s3); flex-wrap: wrap; align-items: center; }
.links h2, .checks h2, .bar-top h2, .overview h2, .appears h2 { font-size: var(--t-md); font-weight: 600; margin: 0; }
.links h2 { font-size: var(--t-sm); color: var(--muted); font-weight: 500; min-width: 4rem; }
.links ul { display: flex; gap: 6px; flex-wrap: wrap; }
.links a { display: inline-block; padding: 2px 10px; border-radius: 999px; background: var(--accent-soft); font-size: var(--t-sm); }
.checks, .doc { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r3); box-shadow: var(--shadow-1); }
.checks { padding: var(--s4) var(--s5); display: flex; flex-direction: column; gap: var(--s2); }
.checks li { padding: var(--s2) 0; border-top: 1px solid var(--line); color: var(--muted); }
.checks li b { display: inline-block; margin-right: var(--s2); padding: 0 6px; border-radius: 4px; background: var(--revise-soft); color: var(--revise); font: 600 var(--t-xs)/18px var(--mono); }
.checks .fix { display: block; color: var(--faint); font-size: var(--t-sm); }
.doc { padding: var(--s5) var(--s6); color: var(--text); max-width: 72ch; }
.doc:empty { display: none; }
.doc h1, .doc h2, .doc h3 { margin: var(--s5) 0 var(--s2); line-height: 1.3; }
.doc h2 { font-size: var(--t-lg); }
.doc h3 { font-size: var(--t-md); }
.doc > :first-child { margin-top: 0; }
.doc > :last-child { margin-bottom: 0; }
.doc p, .doc ul { margin: 0 0 var(--s3); color: #3b3b37; }
.doc .scroll { overflow-x: auto; }
.doc table { border-collapse: collapse; width: 100%; font-size: 13px; }
.doc th { text-align: left; font-weight: 600; color: var(--muted); border-bottom: 1px solid var(--line-strong); padding: 6px 10px; }
.doc td { border-bottom: 1px solid var(--line); padding: 8px 10px; vertical-align: top; }
.journey { padding: var(--s2) 0 var(--s4); }
.board { list-style: none; margin: 0 0 0 calc(var(--s7) * -1); padding: 0; display: flex; flex-wrap: wrap; row-gap: var(--s6); align-items: flex-start; }
.board .card { position: relative; flex: none; inline-size: calc(232px + var(--s7)); padding-left: var(--s7); display: flex; flex-direction: column; gap: var(--s3); }
.board .card:not(:first-child)::after { content: ""; position: absolute; top: 74px; left: 10px; inline-size: calc(var(--s7) - 20px); block-size: 2px; background: var(--line-strong); }
.board .card:not(:first-child)::before { content: ""; position: absolute; top: 70px; left: calc(var(--s7) - 18px); inline-size: 8px; block-size: 8px; border: solid var(--line-strong); border-width: 2px 2px 0 0; transform: rotate(45deg); }
.step { display: flex; flex-direction: column; gap: var(--s2); color: var(--text); }
.step:hover { text-decoration: none; }
.step:hover .mini { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft), var(--shadow-2); }
.screen { font-size: 13px; font-weight: 600; padding: 0 2px; }
.action { display: flex; gap: var(--s2); margin: 0; font-size: 13px; line-height: 1.45; color: var(--muted); }
.num { flex: none; display: grid; place-content: center; inline-size: 20px; block-size: 20px; border-radius: 50%; background: var(--accent); color: #fff; font-size: var(--t-xs); font-weight: 600; line-height: 1; }
.mini { position: relative; display: block; overflow: hidden; inline-size: 100%; aspect-ratio: 8 / 5; border: 1px solid var(--line); border-radius: var(--r2); background: #fbfbfa; box-shadow: var(--shadow-2); transition: border-color 120ms, box-shadow 120ms; }
.mini iframe { position: absolute; top: 0; left: 0; inline-size: 400%; block-size: 400%; border: 0; transform: scale(0.25); transform-origin: 0 0; pointer-events: none; }
.mini.empty { display: grid; place-content: center; border-style: dashed; box-shadow: none; background: var(--sunken); color: var(--faint); font-size: var(--t-sm); }
.review { display: flex; flex-direction: column; gap: 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r3); box-shadow: var(--shadow-1); overflow: hidden; }
.bar-top { display: flex; gap: var(--s3); align-items: center; flex-wrap: wrap; padding: var(--s3) var(--s4) var(--s3) var(--s5); border-bottom: 1px solid var(--line); }
.toolbar { display: flex; gap: var(--s3); align-items: center; flex-wrap: wrap; padding: var(--s2) var(--s5); border-bottom: 1px solid var(--line); background: var(--bg); }
.gallery .toolbar { border: 1px solid var(--line); border-radius: var(--r2); }
.review fieldset, .gallery fieldset { border: 0; display: flex; gap: var(--s2); align-items: center; padding: 0; margin: 0; }
legend { float: left; margin-right: var(--s2); font-size: var(--t-sm); font-weight: 600; color: var(--muted); }
label { font-size: var(--t-sm); color: var(--muted); }
#sides[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-text); }
.tabs { display: flex; gap: var(--s1); padding: 0 var(--s4); border-bottom: 1px solid var(--line); overflow-x: auto; }
.tab { display: inline-flex; align-items: center; gap: var(--s2); height: 42px; padding: 0 var(--s3); border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent; color: var(--muted); font-size: 13px; }
.tab:hover { background: transparent; color: var(--text); }
.tab[aria-selected="true"] { color: var(--text); border-bottom-color: var(--accent); font-weight: 600; }
.tab .dot { inline-size: 8px; block-size: 8px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--faint); }
.tab[data-current="ok"] .dot { background: var(--ok); box-shadow: none; }
.tab[data-current="revise"] .dot { background: var(--revise); box-shadow: none; }
.tab[data-current="pending"] .dot { box-shadow: inset 0 0 0 1.5px var(--revise); }
.tab[data-choice="ok"] .dot { background: var(--ok); box-shadow: none; }
.tab[data-choice="revise"] .dot { background: var(--revise); box-shadow: none; }
.state { display: flex; flex-direction: column; }
.state-bar { display: flex; gap: var(--s3); align-items: center; flex-wrap: wrap; padding: var(--s3) var(--s5); }
.outdated, .said { margin: 0; font-size: var(--t-sm); color: var(--muted); }
.outdated { padding: 0 var(--s2); border-radius: 999px; background: var(--sunken); line-height: 20px; }
.said { padding-left: var(--s2); border-left: 2px solid var(--revise); }
.choose { display: inline-flex; margin-left: auto; padding: 2px; gap: 2px; background: var(--sunken); border-radius: var(--r1); }
.choose .verdict { height: 24px; padding: 0 var(--s2); border: 0; background: transparent; color: var(--muted); font-size: var(--t-xs); }
.choose .verdict:hover { color: var(--text); }
.verdict[data-verdict="ok"][aria-pressed="true"] { background: var(--surface); color: var(--ok); box-shadow: var(--shadow-1); }
.verdict[data-verdict="revise"][aria-pressed="true"] { background: var(--surface); color: var(--revise); box-shadow: var(--shadow-1); }
textarea.comment { display: block; flex-basis: 100%; inline-size: 100%; font: inherit; font-size: 13px; color: var(--text); background: var(--surface); border: 1px solid var(--line-strong); border-radius: var(--r1); padding: var(--s2) var(--s3); resize: vertical; }
textarea.comment:focus { outline: 2px solid var(--accent-soft); border-color: var(--accent); }
.pair { display: flex; gap: var(--s5); flex-wrap: wrap; align-items: flex-start; padding: var(--s6); background: var(--canvas) radial-gradient(#d6d6d0 1px, transparent 1px) 0 0 / 16px 16px; border-top: 1px solid var(--line); }
.render { display: flex; gap: var(--s5); flex: 1 1 24rem; min-width: 0; align-items: flex-start; }
.render iframe { box-sizing: content-box; flex: 1; min-width: 0; width: 100%; height: 240px; border: 1px solid var(--line-strong); border-radius: var(--r2); background: #fff; box-shadow: 0 2px 4px rgba(24, 24, 20, 0.05), 0 16px 40px rgba(24, 24, 20, 0.1); }
.state .render iframe[data-platform="mobile"] { flex: 0 0 390px; inline-size: 390px; }
.capture { flex: 1 1 24rem; margin: 0; min-width: 0; }
.capture img { display: block; max-width: 100%; border: 1px solid var(--line-strong); border-radius: var(--r2); box-shadow: var(--shadow-2); }
.capture.missing { display: flex; align-items: center; justify-content: center; min-block-size: 160px; border: 1.5px dashed var(--line-strong); border-radius: var(--r2); color: var(--muted); padding: var(--s4); font-size: var(--t-sm); text-align: center; }
.gallery { display: flex; flex-direction: column; gap: var(--s3); }
.gallery .pair { border: 1px solid var(--line); border-radius: var(--r3); }
.overview { display: flex; flex-direction: column; gap: var(--s3); }
.overview h2 { display: flex; align-items: center; gap: var(--s2); }
.overview h2 span { font-size: var(--t-xs); font-weight: 600; color: var(--muted); background: var(--sunken); border-radius: 999px; padding: 0 7px; line-height: 18px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: var(--s4); }
a.card { display: flex; flex-direction: column; overflow: hidden; color: var(--text); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r3); box-shadow: var(--shadow-1); transition: border-color 120ms, box-shadow 120ms, transform 120ms; }
a.card:hover { text-decoration: none; border-color: #c7cdfb; box-shadow: var(--shadow-2); transform: translateY(-1px); }
a.card .mini { border: 0; border-bottom: 1px solid var(--line); border-radius: 0; box-shadow: none; }
.glyph { display: grid; place-content: center; aspect-ratio: 8 / 5; border-bottom: 1px solid var(--line); background: var(--sunken) radial-gradient(#dcdcd6 1px, transparent 1px) 0 0 / 12px 12px; color: var(--faint); font-size: var(--t-2xl); font-weight: 650; letter-spacing: -0.02em; }
.card-body { display: flex; flex-direction: column; gap: 6px; padding: var(--s3) var(--s4) var(--s4); }
.card-body b { font-size: var(--t-md); font-weight: 600; }
.meta { display: flex; align-items: center; gap: var(--s2); font-size: var(--t-sm); color: var(--muted); }
.meta .chip { line-height: 18px; padding: 0 8px; font-size: var(--t-xs); }
.steps, .progress { margin-left: auto; color: var(--faint); }
.progress { font-variant-numeric: tabular-nums; }
.progress[data-complete="true"] { color: var(--ok); }
.appears { display: flex; flex-direction: column; gap: var(--s3); padding-top: var(--s5); border-top: 1px solid var(--line); }
.appears ul { display: flex; flex-wrap: wrap; gap: var(--s3); }
.mini-card { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-inline-size: 180px; padding: var(--s3) var(--s4); color: var(--text); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r2); box-shadow: var(--shadow-1); transition: border-color 120ms, box-shadow 120ms; }
.mini-card:hover { text-decoration: none; border-color: #c7cdfb; box-shadow: var(--shadow-2); }
.mini-card b { font-size: 13px; font-weight: 600; }
.mini-card .chip { line-height: 18px; padding: 0 8px; font-size: var(--t-xs); }
.open-review { position: fixed; top: var(--s4); right: var(--s5); z-index: 20; display: inline-flex; align-items: center; gap: var(--s2); height: 34px; box-shadow: var(--shadow-2); }
.open-review[aria-expanded="true"] { display: none; }
.tally { padding: 0 7px; border-radius: 999px; background: var(--sunken); color: var(--muted); font-size: var(--t-xs); line-height: 18px; font-variant-numeric: tabular-nums; }
.drawer { position: fixed; top: 0; right: 0; bottom: 0; z-index: 30; inline-size: var(--drawer); display: flex; flex-direction: column; background: var(--surface); border-left: 1px solid var(--line); box-shadow: -12px 0 32px rgba(24, 24, 20, 0.08); }
.drawer-head { display: flex; align-items: center; gap: var(--s2); padding: var(--s3) var(--s3) var(--s3) var(--s5); border-bottom: 1px solid var(--line); }
.drawer-head h2 { margin: 0; font-size: var(--t-md); font-weight: 600; }
.drawer-head .close { margin-left: auto; inline-size: 32px; padding: 0; border-color: transparent; background: transparent; color: var(--muted); font-size: var(--t-lg); }
.drawer-body { flex: 1; overflow: auto; padding: var(--s2) 0; }
.drawer-body > p { margin: var(--s4) var(--s5); color: var(--muted); font-size: 13px; }
.item { border-bottom: 1px solid var(--line); }
.item summary { display: flex; align-items: center; gap: var(--s2); padding: var(--s3) var(--s5); cursor: pointer; font-size: 13px; font-weight: 600; list-style: none; }
.item summary::-webkit-details-marker { display: none; }
.item summary::before { content: ""; flex: none; inline-size: 6px; block-size: 6px; border: solid var(--faint); border-width: 0 1.5px 1.5px 0; transform: rotate(-45deg); transition: transform 120ms; }
.item[open] summary::before { transform: rotate(45deg); }
.item summary:hover { background: var(--bg); }
.item[data-here] summary { color: var(--accent-text); }
.item .done { margin-left: auto; color: var(--faint); font-weight: 500; font-size: var(--t-xs); font-variant-numeric: tabular-nums; }
.item ol { padding: 0 var(--s3) var(--s3); }
.pstate { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); padding: 6px var(--s2); border-radius: var(--r1); }
.pstate.on { background: var(--accent-soft); }
.pstate::before { content: ""; flex: none; inline-size: 8px; block-size: 8px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--faint); }
.pstate[data-current="ok"]::before, .pstate[data-choice="ok"]::before { background: var(--ok); box-shadow: none; }
.pstate[data-current="revise"]::before, .pstate[data-choice="revise"]::before { background: var(--revise); box-shadow: none; }
.pstate .pick { min-width: 0; flex: 1; color: var(--text); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pstate .said { flex-basis: 100%; margin-left: var(--s4); font-size: var(--t-xs); }
.drawer-foot { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); padding: var(--s3) var(--s5); border-top: 1px solid var(--line); background: var(--bg); }
.drawer-foot #copy { margin-left: auto; }
#note { flex-basis: 100%; margin: 0; color: var(--revise); font-size: var(--t-sm); }
#note:empty { display: none; }
textarea.out { width: 100%; min-height: 8rem; font: var(--t-sm) var(--mono); border: 1px solid var(--line-strong); border-radius: var(--r1); padding: var(--s2); }
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
  const root = frame.contentDocument && frame.contentDocument.documentElement;
  const height = root ? Math.ceil(root.getBoundingClientRect().height) : 0;
  if (height > 0) frame.style.height = height + "px";
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

/** What the review skill reads back from a copy: each record with a state decided, its decided states in
 * the order given, as fenced JSON. One record is one object, as a record's page always copied it; several
 * are a list of the same objects, as the overview copied them. Nothing decided copies nothing. Embedded in
 * the pages as its own source, so the test and the page run the same function. */
function copiedOf(entries) {
  const body = entries.filter((entry) => entry.verdicts.length).map((entry) => ({
    record: entry.record,
    version: Number(entry.version),
    verdicts: entry.verdicts.map((each) => ({ state: each.state, verdict: each.verdict, comment: String(each.comment || "").trim() })),
  }));
  if (!body.length) return "";
  return "```json\n" + JSON.stringify(body.length === 1 ? body[0] : body, null, 2) + "\n```\n";
}

/** The verdicts kept in the browser, limited to the records at the versions `keys` names (`id@version`):
 * a raised version, or a record gone, leaves its verdicts behind. Anything unreadable keeps nothing. */
function keptOf(store, keys) {
  const kept = {};
  if (!store || typeof store !== "object") return kept;
  for (const key of keys) if (store[key] && typeof store[key] === "object") kept[key] = store[key];
  return kept;
}

/** The script of the review panel, on every page: a verdict by state of every record, kept in the browser
 * across the pages when it shares their storage, else for the page alone; then one copy of all decided. */
const PANEL = `${DELIVER}
${copiedOf.toString()}
${keptOf.toString()}
const STORE = "aidd-ui-review";
const drawer = document.getElementById("review");
const opener = document.getElementById("open-review");
const copy = document.getElementById("copy");
const clear = document.getElementById("clear");
const allOk = document.getElementById("all-ok");
const note = document.getElementById("note");
const items = [...drawer.querySelectorAll("details.item")];
const keyOf = (item) => item.dataset.record + "@" + item.dataset.version;
const rowsOf = (item) => [...item.querySelectorAll("li.pstate")];
function stored(name) {
  try { return window.localStorage.getItem(name); } catch (error) { return null; }
}
function keep(name, value) {
  try {
    if (value === null) window.localStorage.removeItem(name);
    else window.localStorage.setItem(name, value);
  } catch (error) { /* no shared storage: the review holds for this page alone */ }
}
let choices = {};
try { choices = keptOf(JSON.parse(stored(STORE) || "{}"), items.map(keyOf)); } catch (error) { choices = {}; }
const choiceOf = (item, state) => (choices[keyOf(item)] || {})[state];
function choose(item, state, choice) {
  const own = Object.assign({}, choices[keyOf(item)]);
  if (choice) own[state] = choice;
  else delete own[state];
  if (Object.keys(own).length) choices[keyOf(item)] = own;
  else delete choices[keyOf(item)];
  keep(STORE, Object.keys(choices).length ? JSON.stringify(choices) : null);
}
const settled = (row) => row.dataset.current === "ok" || row.dataset.current === "revise";
const remaining = () => items.flatMap((item) => rowsOf(item).filter((row) => !choiceOf(item, row.dataset.state) && !settled(row)).map((row) => ({ item, row })));
const entries = () => items.map((item) => ({
  record: item.dataset.record,
  version: item.dataset.version,
  verdicts: rowsOf(item).filter((row) => choiceOf(item, row.dataset.state)).map((row) => ({ state: row.dataset.state, verdict: choiceOf(item, row.dataset.state).verdict, comment: choiceOf(item, row.dataset.state).comment || "" })),
}));
const blocked = () => entries().some((entry) => entry.verdicts.some((each) => each.verdict === "revise" && !each.comment.trim()));
function paint() {
  let done = 0;
  let total = 0;
  for (const item of items) {
    const rows = rowsOf(item);
    let own = 0;
    for (const row of rows) {
      const choice = choiceOf(item, row.dataset.state);
      const verdict = choice ? choice.verdict : "";
      if (verdict) row.dataset.choice = verdict;
      else delete row.dataset.choice;
      row.querySelectorAll(".verdict").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.verdict === verdict)));
      const field = row.querySelector(".comment");
      field.hidden = verdict !== "revise";
      if (document.activeElement !== field) field.value = (choice && choice.comment) || "";
      if (verdict || settled(row)) own += 1;
      const tab = item.hasAttribute("data-here") ? document.getElementById("tab-" + row.dataset.state) : null;
      if (tab && verdict) tab.dataset.choice = verdict;
      else if (tab) delete tab.dataset.choice;
    }
    item.querySelector(".done").textContent = own + "/" + rows.length;
    document.querySelectorAll('.progress[data-record="' + item.dataset.record + '"]').forEach((each) => {
      each.textContent = own + "/" + rows.length;
      each.dataset.complete = String(own === rows.length);
    });
    done += own;
    total += rows.length;
  }
  document.querySelectorAll(".tally").forEach((each) => { each.textContent = done + "/" + total; });
  const stuck = blocked();
  copy.disabled = stuck || !entries().some((entry) => entry.verdicts.length);
  allOk.disabled = remaining().length === 0;
  note.textContent = stuck ? copy.dataset.blocked : "";
}
/** Marks the state of the page's own record that its tabs show. */
function marked(state) {
  for (const item of items) if (item.hasAttribute("data-here")) rowsOf(item).forEach((row) => row.classList.toggle("on", row.dataset.state === state));
}
function show(on) {
  drawer.hidden = !on;
  opener.setAttribute("aria-expanded", String(on));
  keep(STORE + "-open", on ? "1" : null);
}
items.forEach((item) => rowsOf(item).forEach((row) => {
  const state = row.dataset.state;
  const field = row.querySelector(".comment");
  row.querySelectorAll(".verdict").forEach((button) => button.addEventListener("click", () => {
    const now = choiceOf(item, state);
    const again = now && now.verdict === button.dataset.verdict;
    const revise = button.dataset.verdict === "revise";
    choose(item, state, again ? null : { verdict: button.dataset.verdict, comment: revise && now ? now.comment || "" : "" });
    paint();
    if (!again && revise) field.focus();
  }));
  field.addEventListener("input", () => {
    choose(item, state, { verdict: "revise", comment: field.value });
    paint();
  });
  const tab = item.hasAttribute("data-here") ? document.getElementById("tab-" + state) : null;
  if (tab && typeof openTab === "function") row.querySelector(".pick").addEventListener("click", (event) => {
    event.preventDefault();
    openTab(tab);
  });
}));
opener.addEventListener("click", () => show(true));
document.getElementById("close-review").addEventListener("click", () => show(false));
allOk.addEventListener("click", () => {
  for (const { item, row } of remaining()) choose(item, row.dataset.state, { verdict: "ok", comment: "" });
  paint();
});
copy.addEventListener("click", () => {
  if (blocked()) return;
  const content = copiedOf(entries());
  if (!content) return;
  deliver(copy, content);
  clear.hidden = false;
});
clear.addEventListener("click", () => {
  choices = {};
  keep(STORE, null);
  clear.hidden = true;
  const out = document.querySelector("textarea.out");
  if (out) out.remove();
  paint();
});
if (stored(STORE + "-open") === "1") show(true);
paint();
`;

/** The script of the state tabs: one panel open at a time, its frames fitted as it opens, the state
 * marked in the review panel; the tab the address names opens first. Runs after the panel's script. */
const TABS = `
const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
function openTab(tab) {
  for (const each of tabs) {
    const on = each === tab;
    each.setAttribute("aria-selected", String(on));
    each.tabIndex = on ? 0 : -1;
    document.getElementById(each.getAttribute("aria-controls")).hidden = !on;
  }
  document.getElementById(tab.getAttribute("aria-controls")).querySelectorAll(".render iframe").forEach(fit);
  marked(tab.dataset.tab);
}
tabs.forEach((tab, at) => {
  tab.addEventListener("click", () => openTab(tab));
  tab.addEventListener("keydown", (event) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const next = tabs[(at + step + tabs.length) % tabs.length];
    openTab(next);
    next.focus();
  });
});
const asked = document.getElementById(location.hash.slice(1));
if (tabs.includes(asked)) openTab(asked);
else if (tabs.length) marked(tabs.find((tab) => tab.getAttribute("aria-selected") === "true").dataset.tab);
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
  return `<nav aria-label="${escaped(labels.list)}"><div class="brand"><span class="mark"></span>${labels.title}</div><p class="home"><a href="index.html"${current === null ? ' aria-current="page"' : ""}>${labels.home}</a></p>${sections.join("")}</nav>`;
}

/** The state a miniature shows: `default` when the record has it, else its first. */
const shownState = (record) => (list(fm(record).states).includes("default") ? "default" : list(fm(record).states)[0]);

/** A live miniature of a record's shown state, sketched for a wireframe; an empty box when it has no render.
 * Out of `.render`, so the frames script never dresses nor fits it. */
function miniatureOf(project, record, tokens, labels) {
  if (!record || !hasRender(project, record)) return `<span class="mini empty">${labels.noRender}</span>`;
  const doc = stateDocument(text(project, renderOf(record)), tokens, shownState(record), fm(record).kind === "wireframe");
  return `<span class="mini"><iframe tabindex="-1" aria-hidden="true" loading="eager" title="${escaped(fm(record).id)}" srcdoc="${escaped(doc)}"></iframe></span>`;
}

/** The persona of a journey as one line under its title: "For" the name the front matter gives, then the
 * text of its Persona section. A text that already opens with the name is a sentence, shown as written. */
function personaOf(record, labels) {
  const said = (record.sections[PERSONA_SECTION]?.lines ?? []).map((line) => line.trim()).filter(Boolean).join(" ");
  const name = String(fm(record).persona ?? "").trim();
  if (!said && !name) return "";
  const opensWithName = name && said.toLowerCase().startsWith(name.toLowerCase());
  const line = !said ? `${labels.forPersona} ${name}` : !name ? said : opensWithName ? said : `${labels.forPersona} ${name}: ${said}`;
  return `<p class="persona">${escaped(line)}</p>`;
}

/** A journey as a storyboard: a card per step of its Steps table, showing a miniature of the record that
 * bears the name and linking its page, the screen named under it, then the action numbered. */
function journeyOf({ project, record, recordsById, tokens, labels }) {
  const steps = table(record.sections[STEPS_SECTION]);
  if (!steps.length) return "";
  const card = (row, at) => {
    const target = recordsById.get(row.Screen);
    const face = `${miniatureOf(project, target, tokens, labels)}<span class="screen">${escaped(target ? titleOf(project, target) : row.Screen ?? "")}</span>`;
    const shown = target ? `<a class="step" href="${escaped(row.Screen)}.html">${face}</a>` : `<div class="step">${face}</div>`;
    return `<li class="card" data-step="${at + 1}">${shown}<p class="action"><span class="num">${at + 1}</span>${escaped(row.Action ?? "")}</p></li>`;
  };
  return `<section class="journey"><ol class="board">${steps.map(card).join("")}</ol></section>`;
}

const chipOf = (key, value) => `<span class="chip" data-key="${key}"><span class="key">${key}</span>${escaped(String(value))}</span>`;

const statusOf = (record) => (fm(record).status === undefined ? "" : `<span class="chip" data-status="${escaped(fm(record).status)}">${escaped(fm(record).status)}</span>`);

/** The line under the title of a record: its status, its version small beside it, then its route and code
 * links. Its id and kind are left to the navigation and the group above the title. */
function chipsOf(record) {
  const { version, route } = fm(record);
  return [
    statusOf(record),
    ...(version === undefined ? [] : [`<span class="version">v${escaped(String(version))}</span>`]),
    ...(route === undefined ? [] : [chipOf("route", route)]),
    ...list(fm(record).code).map((code) => chipOf("code", code)),
  ].join("");
}

const linksOf = (kind, label, ids) => (ids.length ? `<section class="links" data-links="${kind}"><h2>${label}</h2><ul>${ids.map((id) => `<li>${link(id, false)}</li>`).join("")}</ul></section>` : "");

/** Where a record appears, at the bottom of its page: a small card per record that cites it, its title and status. */
function appearsOf({ project, ids, recordsById, labels }) {
  if (!ids.length) return "";
  const card = (id) => `<li><a class="mini-card" href="${escaped(id)}.html"><b>${escaped(titleOf(project, recordsById.get(id)))}</b>${statusOf(recordsById.get(id))}</a></li>`;
  return `<section class="appears"><h2>${labels.appearsIn}</h2><ul>${ids.map(card).join("")}</ul></section>`;
}

/** The engine checks about a record or its render. A component the design system does not hold yet (R18) is left to the final reply. */
function checksOf(problems, record, labels) {
  const own = problems.filter((each) => each.rule !== EXPECTED_COMPONENT && (each.file === record.file || each.file === renderOf(record)));
  if (!own.length) return "";
  const items = own.map((each) => `<li data-rule="${escaped(each.rule)}"><b>${escaped(each.rule)}</b> ${escaped(each.message)} <span class="fix">${escaped(each.fix)}</span></li>`);
  return `<section class="checks"><h2>${labels.checks}</h2><ul>${items.join("")}</ul></section>`;
}

/** How a wireframe looks in the showcase: a lo-fi sketch on paper. Text in a readable scale, buttons as
 * grey rounded blocks, fields as outlined boxes, tables with light rules, links as plain dark text,
 * emphasis as a pill, images as crossed boxes, each zone a faint outline named small in its corner.
 * Fixed colours, so the paper stays light whatever the reader's scheme. The record stays unstyled. */
const GREY_BOX = `
:root { color-scheme: light; background: #fbfbfa; }
body { margin: 0; padding: 24px 28px 28px; font: 14px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #45453f; background: #fbfbfa; }
[data-zone] { position: relative; box-sizing: border-box; min-height: 48px; margin: 0 0 12px; padding: 24px 16px 14px; border: 1px solid #e7e7e2; border-radius: 10px; background: #ffffff; }
[data-zone]::before { content: attr(data-zone); position: absolute; top: 6px; left: 12px; font: 500 10px/1 system-ui, sans-serif; letter-spacing: 0.02em; color: #b4b4ad; }
[data-zone]:empty { background: repeating-linear-gradient(-45deg, #ffffff 0 7px, #f3f3f0 7px 8px); }
h1, h2, h3, h4 { margin: 0 0 8px; color: #2b2b28; line-height: 1.25; font-weight: 650; }
h1 { font-size: 22px; } h2 { font-size: 16px; } h3, h4 { font-size: 14px; }
p { margin: 0 0 8px; } p:last-child, ul:last-child, ol:last-child, table:last-child { margin-bottom: 0; }
a { color: #2b2b28; text-decoration: none; font-weight: 500; }
nav, menu { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 20px; margin: 0; padding: 0; }
nav strong, nav b { margin-right: auto; padding: 0; background: none; font-size: 15px; font-weight: 700; color: #2b2b28; }
nav strong::before { content: ""; display: inline-block; inline-size: 14px; block-size: 14px; margin-right: 8px; vertical-align: -2px; border-radius: 4px; background: #c9c9c3; }
strong, b, mark, [role="status"] { display: inline-block; padding: 0 8px; border-radius: 999px; background: #ecece8; color: #3b3b37; font-size: 12px; font-weight: 600; line-height: 20px; }
button, input[type="submit"], input[type="button"] { font: 500 13px/1 system-ui, sans-serif; color: #3b3b37; background: #e4e4df; border: 0; border-radius: 8px; padding: 10px 16px; margin: 0 8px 4px 0; }
input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]), select, textarea { box-sizing: border-box; font: 13px system-ui, sans-serif; color: #9a9a93; background: #ffffff; border: 1.5px solid #d4d4ce; border-radius: 8px; padding: 9px 12px; min-inline-size: 220px; max-inline-size: 100%; }
input[type="checkbox"], input[type="radio"] { inline-size: 15px; block-size: 15px; margin: 0 8px 0 0; vertical-align: -2px; accent-color: #8a8a83; }
label { display: block; margin: 0 0 12px; font-size: 13px; font-weight: 500; color: #5c5c55; }
label > input:not([type="checkbox"]):not([type="radio"]), label > select, label > textarea { display: block; margin-top: 6px; inline-size: 100%; max-inline-size: 420px; }
form > button, form > input[type="submit"] { margin-top: 4px; }
table { border-collapse: collapse; inline-size: 100%; font-size: 13px; margin: 0 0 8px; }
th { text-align: left; font-weight: 600; font-size: 12px; color: #8a8a83; padding: 8px 12px; border-bottom: 1px solid #deded8; }
td { padding: 10px 12px; border-bottom: 1px solid #efefeb; }
th strong, td strong { font-size: 11px; }
ul, ol { margin: 0 0 8px; padding-left: 18px; }
li { margin: 4px 0; } li::marker { color: #bcbcb5; }
img, video, canvas, [role="img"] { display: inline-block; min-inline-size: 96px; min-block-size: 64px; border: 1px solid #d4d4ce; border-radius: 6px; font-size: 0; background: #f4f4f1 linear-gradient(to top right, transparent calc(50% - 0.5px), #d4d4ce 50%, transparent calc(50% + 0.5px)), linear-gradient(to bottom right, transparent calc(50% - 0.5px), #d4d4ce 50%, transparent calc(50% + 0.5px)); }
hr { border: 0; border-top: 1px solid #e7e7e2; margin: 12px 0; }
[role="alert"] { padding: 10px 12px; border-radius: 8px; background: #f1f1ed; border-left: 3px solid #9a9a93; color: #3b3b37; }
small { color: #8a8a83; }
code { font: 12px ui-monospace, Menlo, monospace; background: #f0f0ec; border-radius: 4px; padding: 1px 4px; }`;

/** The document of one state of a render: the tokens inline, every other state hidden. A render without `</head>` keeps every state visible in each frame: a known limit. */
function stateDocument(render, tokens, state, sketch) {
  const hide = `<style>[data-state]:not([data-state=${JSON.stringify(state)}]) { display: none !important; }${sketch ? GREY_BOX : ""}</style>`;
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

/** The id of a state's tab and of its panel. */
const tabId = (state) => `tab-${state}`;
const panelId = (state) => `panel-${state}`;

/** One state of a record, as the panel of its tab: an older verdict or a comment already given, then its
 * render on the canvas, the capture beside it for a coded screen. Only the first panel starts open. The
 * verdicts are chosen in the review panel. */
function stateOf({ record, state, verdict, render, tokens, captures, labels, platform, first }) {
  const { id, version } = fm(record);
  const file = `${record.folder}/${id}.${state}@${version}.png`;
  const capture = !isCoded(record) ? "" : captures.has(file) ? `<figure class="capture" data-file="${escaped(file)}"><img src="../${escaped(file)}" alt="${escaped(filled(labels.capture, { state }))}"></figure>` : `<div class="capture missing" data-file="${escaped(file)}">${escaped(filled(labels.noCapture, { path: file }))}</div>`;
  const notes = [
    verdict.outdated === null ? "" : `<p class="outdated" data-version="${escaped(verdict.outdated)}">${escaped(filled(labels.outdated, { version: verdict.outdated }))}</p>`,
    verdict.comment ? `<p class="said">${escaped(verdict.comment)}</p>` : "",
  ].join("");
  return [
    `<article class="state" data-state="${escaped(state)}" data-current="${escaped(verdict.current)}" role="tabpanel" id="${escaped(panelId(state))}" aria-labelledby="${escaped(tabId(state))}"${first ? "" : " hidden"}>`,
    notes ? `<div class="state-bar">${notes}</div>` : "",
    `<div class="pair"><div class="render"><iframe data-combo="a"${platform} title="${escaped(`${id} ${state}`)}" srcdoc="${escaped(stateDocument(render, tokens, state, fm(record).kind === "wireframe"))}"></iframe></div>${capture}</div>`,
    "</article>",
  ].filter(Boolean).join("\n");
}

/** The tabs of the states, in the order of their panels, each marked with the verdict that decides it. */
function tabsOf(states, labels) {
  const tab = ({ state, verdict }, at) => `<button type="button" role="tab" class="tab" id="${escaped(tabId(state))}" aria-controls="${escaped(panelId(state))}" aria-selected="${at === 0}" tabindex="${at === 0 ? 0 : -1}" data-tab="${escaped(state)}" data-current="${escaped(verdict.current)}"><i class="dot" aria-hidden="true"></i>${escaped(state)}</button>`;
  return `<div class="tabs" role="tablist" aria-label="${escaped(labels.states)}">${states.map(tab).join("")}</div>`;
}

const GALLERY_STYLE = `
body { margin: 0; padding: 16px; font-size: 13px; }
h2 { font-size: 15px; margin: 0 0 8px; }
h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.6; margin: 16px 0 4px; }
ul { list-style: none; margin: 0; padding: 0; }
li { display: grid; grid-template-columns: minmax(8rem, 1fr) minmax(6rem, 1fr) 2fr; gap: 12px; align-items: center; padding: 4px 0; border-bottom: 1px solid #8884; }
code, .value { overflow-wrap: anywhere; }
.value { opacity: 0.7; }
.swatch { display: block; inline-size: 100%; block-size: 56px; border-radius: 6px; border: 1px solid #8886; }
.bar { display: block; block-size: 12px; background: #888; border-radius: 2px; }
.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 16px 12px; }
.swatches li { display: flex; flex-direction: column; align-items: stretch; gap: 2px; padding: 0; border: 0; }
.swatches .specimen { order: -1; margin-bottom: 4px; border-radius: 6px; background: repeating-conic-gradient(#8883 0 25%, transparent 0 50%) 0 0 / 12px 12px; }
`;

const ALPHA_COLOUR = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+) \/ ([\d.]+)\)$/;

/** A value as a person reads it: a colour with alpha as its hex and its opacity, anything else as is. */
function shownValue(value) {
  const match = ALPHA_COLOUR.exec(value);
  if (!match) return value;
  const hex = match.slice(1, 4).map((part) => Math.round(Number(part) * 255).toString(16).padStart(2, "0")).join("");
  return `#${hex} · ${Math.round(Number(match[4]) * 100)}%`;
}

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
  const row = (entry) => `<li data-token="${escaped(entry.name)}"><code>${escaped(entry.name)}</code><span class="value">${escaped(shownValue(values.get(entry.name) ?? ""))}</span><span class="specimen">${specimenOf(entry)}</span></li>`;
  const sections = [...TYPES, UNTYPED].flatMap((type) => {
    const own = entries.filter((entry) => (entry.type ?? UNTYPED) === type);
    return own.length ? [`<section data-type="${type}"><h3>${type}</h3><ul${type === "color" ? ' class="swatches"' : ""}>${own.map(row).join("")}</ul></section>`] : [];
  });
  const doc = ["<!doctype html>", `<html lang="${language}">`, "<head>", '<meta charset="utf-8">', STYLESHEET_LINK, `<style>${GALLERY_STYLE}</style>`, "</head>", "<body>", `<h2>${labels.tokens}</h2>`, ...sections, "</body>", "</html>"].join("\n");
  return `<section class="gallery">${toolbarOf(system, labels)}<div class="pair"><div class="render"><iframe data-combo="a"${platformOf(system)} title="${escaped(labels.tokens)}" srcdoc="${escaped(inlined(doc, tokens))}"></iframe></div></div></section>`;
}

/** The `data-platform` attribute of a frame: the first platform the system declares, none without one. */
const platformOf = (system) => (system && list(fm(system).platforms).length ? ` data-platform="${escaped(list(fm(system).platforms)[0])}"` : "");

/** The states of a record with what the review says of each: the ones still to review first, the others in the record's order. */
function orderedStates(rows, record) {
  const states = list(fm(record).states).map((state) => ({ state, verdict: verdictOf(rows, record, state) }));
  return [...states.filter(({ verdict }) => UNRESOLVED.includes(verdict.current)), ...states.filter(({ verdict }) => !UNRESOLVED.includes(verdict.current))];
}

/** How many states of a record a verdict at its version already settles, ok or revise. */
const settledOf = (states) => states.filter(({ verdict }) => !UNRESOLVED.includes(verdict.current)).length;

/** The review of a record: each state as a tab, the ones still to review first. */
function reviewOf({ project, system, record, rows, tokens, captures, labels }) {
  const render = text(project, renderOf(record));
  const ordered = orderedStates(rows, record);
  return [
    `<section class="review" data-record="${escaped(fm(record).id)}" data-version="${escaped(String(fm(record).version))}">`,
    `<div class="bar-top"><h2>${labels.states}</h2></div>`,
    toolbarOf(system, labels),
    tabsOf(ordered, labels),
    ...ordered.map(({ state, verdict }, at) => stateOf({ record, state, verdict, render, tokens, captures, labels, platform: platformOf(system), first: at === 0 })),
    "</section>",
  ].join("\n");
}

/** The review panel, the same on every page but for the record it stands on, which starts open: every record
 * with states and a render, each state with a link to its tab, its verdict pair and a comment field, then
 * one copy of all that is decided. Opened by the button at the top of the page, which tallies the states settled. */
function drawerOf({ project, reviewable, rows, labels, current }) {
  let settled = 0;
  let total = 0;
  const item = (record) => {
    const { id, version } = fm(record);
    const states = orderedStates(rows, record);
    settled += settledOf(states);
    total += states.length;
    const row = ({ state, verdict }) => [
      `<li class="pstate" data-state="${escaped(state)}" data-current="${escaped(verdict.current)}">`,
      `<a class="pick" href="${escaped(id)}.html#${escaped(tabId(state))}">${escaped(state)}</a>`,
      `<span class="choose"><button type="button" class="verdict" data-verdict="ok" aria-pressed="false">${labels.ok}</button><button type="button" class="verdict" data-verdict="revise" aria-pressed="false">${labels.revise}</button></span>`,
      verdict.comment ? `<p class="said">${escaped(verdict.comment)}</p>` : "",
      `<textarea class="comment" rows="2" placeholder="${escaped(labels.comment)}" aria-label="${escaped(labels.comment)}" hidden></textarea>`,
      "</li>",
    ].join("");
    return `<details class="item" data-record="${escaped(id)}" data-version="${escaped(String(version))}"${id === current ? " open data-here" : ""}><summary><span>${escaped(titleOf(project, record))}</span><span class="done">${settledOf(states)}/${states.length}</span></summary><ol>${states.map(row).join("")}</ol></details>`;
  };
  const items = reviewable.map(item).join("\n");
  const tally = `<span class="tally">${settled}/${total}</span>`;
  return [
    `<button type="button" class="open-review" id="open-review" aria-controls="review" aria-expanded="false">${labels.review} ${tally}</button>`,
    `<aside class="drawer" id="review" aria-label="${escaped(labels.review)}" hidden>`,
    `<div class="drawer-head"><h2>${labels.review}</h2>${tally}<button type="button" class="close" id="close-review" aria-label="${escaped(labels.close)}">&times;</button></div>`,
    `<div class="drawer-body">${items || `<p>${labels.nothing}</p>`}</div>`,
    `<div class="drawer-foot"><p id="note" role="status"></p><button type="button" id="all-ok">${labels.allOk}</button><button type="button" id="clear" hidden>${labels.clear}</button><button type="button" id="copy" data-copied="${escaped(labels.copied)}" data-blocked="${escaped(labels.blocked)}">${labels.copy}</button></div>`,
    "</aside>",
  ].join("\n");
}

const TITLE_LINE = /^# +(.+?)\s*$/;

/** The record's text without its front matter, as lines. */
function bodyLines(project, record) {
  const lines = (text(project, record.file) ?? "").split(LINE_BREAK);
  return lines.slice(frontMatterEnd(lines) + 1);
}

/** The first `# ` heading of a record's text, else its id. */
const titleOf = (project, record) => bodyLines(project, record).map((line) => TITLE_LINE.exec(line)?.[1]).find(Boolean) ?? fm(record).id;

/** The `## ` sections a page already shows in its own shape, so its text leaves them out. */
const SHOWN_SECTIONS = { journey: [PERSONA_SECTION, STEPS_SECTION] };
const SECTION_LINE = /^## +(.+?)\s*$/;

/** Where the record's description stands among its body lines: the first paragraph under its title, before
 * any heading; null without one. A paragraph is taken as prose: a list or a table there would be read as one. */
function descriptionAt(lines) {
  let start = lines.findIndex((line) => TITLE_LINE.test(line)) + 1;
  while (start < lines.length && !lines[start].trim()) start += 1;
  if (start >= lines.length || lines[start].startsWith("#")) return null;
  let end = start;
  while (end < lines.length && lines[end].trim() && !lines[end].startsWith("#")) end += 1;
  return { start, end };
}

/** The description of a record, on one line, else "". */
function descriptionOf(project, record) {
  const lines = bodyLines(project, record);
  const at = descriptionAt(lines);
  return at ? lines.slice(at.start, at.end).map((line) => line.trim()).join(" ") : "";
}

/** The record as text under its title, without its front matter, its title and its description, which the
 * page heading shows, and the sections the page draws otherwise. */
function specOf(project, record) {
  const shown = SHOWN_SECTIONS[fm(record).kind] ?? [];
  const lines = bodyLines(project, record);
  const title = lines.findIndex((line) => TITLE_LINE.test(line));
  const description = descriptionAt(lines);
  let skipping = false;
  const kept = lines.filter((line, at) => {
    if (at === title || (description && at >= description.start && at < description.end)) return false;
    const section = SECTION_LINE.exec(line);
    if (section) skipping = shown.includes(section[1]);
    return !skipping;
  });
  return documentOf(kept.join(LINE_BREAK));
}

/** The heading of a record's page: its group, its title, its description and a journey's persona under it, then its status. */
const headOf = ({ record, title, description, persona, labels }) => `<header class="head"><p class="crumb">${labels[groupOf(record)]}</p><h1>${escaped(title)}</h1>${description ? `<p class="lede">${escaped(description)}</p>` : ""}${persona}<div class="chips">${chipsOf(record)}</div></header>`;

/** The record a card or a journey shows first: a journey's first step that names a record with a render, else the record itself. */
function shownRecordOf(project, record, recordsById) {
  if (fm(record).kind !== "journey") return record;
  return table(record.sections[STEPS_SECTION]).map((row) => recordsById.get(row.Screen)).find((target) => target && hasRender(project, target)) ?? null;
}

/** The home page: each group of records as cards, a miniature on each that has something to show. */
function overviewOf({ project, records, recordsById, rows, tokens, labels }) {
  const progressOf = (record) => {
    if (!hasRender(project, record)) return "";
    const states = orderedStates(rows, record);
    return `<span class="progress" data-record="${escaped(fm(record).id)}">${settledOf(states)}/${states.length}</span>`;
  };
  const card = (record) => {
    const { id, kind } = fm(record);
    const title = titleOf(project, record);
    const shown = shownRecordOf(project, record, recordsById);
    const face = shown && hasRender(project, shown) ? miniatureOf(project, shown, tokens, labels) : `<span class="glyph" aria-hidden="true">${escaped(title.slice(0, 2))}</span>`;
    const steps = kind === "journey" ? `<span class="steps">${escaped(filled(labels.steps, { count: table(record.sections[STEPS_SECTION]).length }))}</span>` : "";
    return `<a class="card" href="${escaped(id)}.html">${face}<span class="card-body"><b>${escaped(title)}</b><span class="meta">${statusOf(record)}<span>${escaped(String(kind))}</span>${steps}${progressOf(record)}</span></span></a>`;
  };
  return GROUPS.flatMap((group) => {
    const own = records.filter((record) => groupOf(record) === group).sort(byLevel);
    return own.length ? [`<section class="overview" data-overview="${group}"><h2>${labels[group]}<span>${own.length}</span></h2><div class="cards">${own.map(card).join("")}</div></section>`] : [];
  }).join("\n");
}

const pageOf = ({ title, lang, navigation, body, drawer, script }) => ["<!doctype html>", `<html lang="${lang}">`, "<head>", '<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">', `<title>${escaped(title)}</title>`, `<style>${SHELL}</style>`, "</head>", "<body>", '<div class="shell">', navigation, "<main>", body, "</main>", "</div>", drawer, `<script>${script}</script>`, "</body>", "</html>", ""].join("\n");

/** The pages of the showcase by file name: `index.html` and one page per record that is not a review.
 * `problems` are the engine's, `tokens` the stylesheet text or null, `captures` the png paths beside
 * the records, relative to the design system folder. */
function showcaseOf({ project, problems, tokens, captures, lang }) {
  const language = languageOf(lang);
  const labels = LABELS[language];
  const records = placed(project).filter((record) => fm(record).kind !== REVIEW_KIND && fm(record).id);
  const recordsById = new Map();
  for (const record of records) if (!recordsById.has(fm(record).id)) recordsById.set(fm(record).id, record);
  const rows = verdictRows(placed(project));
  const system = project.records.find((record) => fm(record).kind === "system");
  const reviewable = records.filter((record) => hasRender(project, record)).sort((a, b) => GROUPS.indexOf(groupOf(a)) - GROUPS.indexOf(groupOf(b)) || byLevel(a, b));
  const drawer = (current) => drawerOf({ project, reviewable, rows, labels, current });
  const home = [`<header class="head"><h1>${labels.title}</h1><p class="lede">${labels.pick}</p></header>`, overviewOf({ project, records, recordsById, rows, tokens, labels })].join("\n");
  const pages = { "index.html": pageOf({ title: labels.title, lang: language, navigation: navigationOf(records, labels, null), body: home, drawer: drawer(null), script: PANEL }) };
  for (const record of records) {
    const id = fm(record).id;
    const uses = [...new Set(cited(record))].filter((each) => each !== id && recordsById.has(each)).sort(byCode);
    const usedBy = records.filter((other) => fm(other).id !== id && cited(other).includes(id)).map((other) => fm(other).id).sort(byCode);
    const reviewed = hasRender(project, record);
    const title = titleOf(project, record);
    const journey = fm(record).kind === "journey";
    const body = [
      headOf({ record, title, description: descriptionOf(project, record), persona: journey ? personaOf(record, labels) : "", labels }),
      journey ? "" : linksOf("uses", labels.uses, uses),
      journey ? journeyOf({ project, record, recordsById, tokens, labels }) : "",
      id === SYSTEM_ID ? galleryOf({ project, system, tokens, labels, language }) : "",
      reviewed ? reviewOf({ project, system, record, rows, tokens, captures, labels }) : "",
      checksOf(problems, record, labels),
      specOf(project, record),
      appearsOf({ project, ids: usedBy, recordsById, labels }),
    ].filter(Boolean).join("\n");
    const script = reviewed ? FRAMES + PANEL + TABS : id === SYSTEM_ID ? FRAMES + PANEL : PANEL;
    pages[`${id}.html`] = pageOf({ title, lang: language, navigation: navigationOf(records, labels, id), body, drawer: drawer(id), script });
  }
  return pages;
}

module.exports = { showcaseOf, copiedOf, keptOf, languageOf, LABELS };
