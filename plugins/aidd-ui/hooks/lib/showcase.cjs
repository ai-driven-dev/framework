// The showcase: one static page per record of the design system and a home page, rendered from
// the project, the engine's problems, the tokens stylesheet and the captures already read. Pure:
// the command reads the files and writes the pages. Each page holds the review of its record,
// handed back as one copy.
const { list, table, frontMatterEnd, LINE_BREAK } = require("./markdown.cjs");
const { placed, fm, BREAKPOINTS_SECTION, breakpointRows, STEPS_SECTION, PERSONA_SECTION, verdictRows, stateVerdict, reviewStatesOf, REVIEW_KIND, SYSTEM_ID } = require("./model.cjs");
const { renderOf } = require("./renders.cjs");
const { cited } = require("./graph.cjs");
const { parseLink } = require("./code.cjs");
const { text, UI_DIR } = require("./project.cjs");
const { escaped, documentOf, inlined, STYLESHEET_LINK } = require("./html.cjs");
const { catalog, citations, resolvedValues } = require("./tokens.cjs");
const { charteSectionsOf, identitySectionsOf, sectionHtml, subNavigationOf, CHARTE_STYLE } = require("./charte-page.cjs");
const variants = require("./variants.cjs");
const { STEPS, CATEGORIES, stepOf, categoryOf, setStepOf, awaitingOf } = require("./steps.cjs");

const WIREFRAMES_DIR = `${UI_DIR}/wireframes/`; // the screens a set of variants is shown on
const WIREFRAMES_SHOWN = 2;

const DEFAULT_LANGUAGE = "en";
const UNRESOLVED = ["none", "pending"]; // a state still to review
const BASE_CONTEXT = ""; // the key of `resolvedValues` for the base
const EXPECTED_COMPONENT = "R18";
const FEW_ITEMS = 3; // a drawer holding this many records or fewer opens every group
const SET_CURRENT = "set:"; // what a page of a set passes the navigation as its current page

/** The words of the page chrome, one table per language: the same keys in each. */
const LABELS = {
  en: {
    title: "Design system showcase",
    choose: "Variants",
    kindNames: { brand: "Brand identity", system: "Design system" },
    whole: "Whole",
    stepNames: { journeys: "Journeys", identity: "Identity", foundations: "Foundations", components: "Elements", screens: "Screens" },
    categories: { input: "Input", action: "Actions", display: "Display", navigation: "Navigation", group: "Groups", asset: "Assets" },
    outOfJourney: "Out of journey",
    toReview: "{count} to review",
    stepDone: "complete",
    stepEmpty: "no content",
    decided: "chosen",
    picks: "axes picked",
    round: "Round {round}",
    changed: "Changed from {parent}",
    desktop: "Desktop",
    mobile: "Mobile",
    same: "Same in all: {sections}",
    full: "Full text",
    sample: "Sample button",
    specimenHeading: "Heading",
    specimenBody: "A line of text to judge the letters.",
    identical: "same",
    size: "Size",
    noState: "This render has no such state.",
    large: "View large",
    previousVariant: "Previous variant",
    nextVariant: "Next variant",
    screen: "Screen",
    preview: "The previews show the colours, the letters and the sizes. The layout stays that of the wireframes.",
    keep: "Keep",
    discard: "Discard",
    home: "Overview",
    contents: "Contents",
    list: "Records",
    uses: "Uses",
    appearsIn: "Appears in",
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
    allOk: "All OK",
    close: "Close",
    nothing: "Nothing to review.",
    overviewNext: "{count} to review, in {steps}.",
    start: "Start the review",
    overviewTodo: "To review ({count})",
    overviewRevise: "To rework ({count})",
    blocked: "Write what should change on each state to revise.",
    copyHint: "Give an opinion on at least one state.",
    theme: "Theme",
    platform: "Platform",
    sides: "Side by side",
    combination: "Combination",
    charte: {
      palette: { title: "Palette", lead: "The raw colours of the project: every other colour is chosen among them." },
      roles: { title: "Roles", lead: "What each colour is used for: text, backgrounds, borders. Screens use these, never the palette directly." },
      typographie: { title: "Typography", lead: "The fonts, the sizes and the weights that every text of the project is set in." },
      espacements: { title: "Spacing", lead: "The gaps between and inside things, drawn at their real size." },
      arrondis: { title: "Corner radii", lead: "How round the corners of the controls and the surfaces are." },
      tailles: { title: "Sizes", lead: "The fixed sizes of the controls, set against the 44 px a finger needs." },
      "points-de-rupture": { title: "Breakpoints", lead: "The screen widths where the layout changes." },
      autres: { title: "Other settings", lead: "The remaining values: durations, shadows and whatever has no picture of its own." },
      notes: { title: "Notes", lead: "What the design system says besides its tokens." },
      contrast: "Contrast of the text colours on their backgrounds",
      aa: "AA",
      aaLarge: "AA large text",
      fail: "insufficient",
      decimal: ".",
      pill: "pill",
      reference: "reference 44 px",
      sample: "The quick brown fox jumps over the lazy dog",
      defaultQuery: "default (under {min})",
      defaultOnly: "default",
    },
    forPersona: "For",
    persona: "For {name}: {said}",
    states: "States",
    stateNames: {},
    sections: {},
    checksFolded: "For developers ({count})",
    noRender: "No render",
    statuses: { proposed: "proposed", validated: "validated", deprecated: "deprecated" },
    stepOf: "Step {at} of {count}",
    previousStep: "Previous step",
    nextStep: "Next step",
  },
  fr: {
    title: "Vitrine du système de design",
    choose: "Variantes",
    kindNames: { brand: "Identité visuelle", system: "Charte graphique" },
    whole: "L'ensemble",
    stepNames: { journeys: "Parcours", identity: "Identité", foundations: "Charte", components: "Éléments", screens: "Écrans" },
    categories: { input: "Saisie", action: "Actions", display: "Affichage", navigation: "Navigation", group: "Ensembles", asset: "Ressources" },
    outOfJourney: "Hors parcours",
    toReview: "{count} à relire",
    stepDone: "terminé",
    stepEmpty: "vide",
    decided: "choisies",
    picks: "axes pris",
    round: "Tour {round}",
    changed: "Changé depuis {parent}",
    desktop: "Ordinateur",
    mobile: "Mobile",
    same: "Identique dans toutes : {sections}",
    full: "Texte complet de la piste",
    sample: "Exemple de bouton",
    specimenHeading: "Titre",
    specimenBody: "Une ligne de texte pour juger les lettres.",
    identical: "identique",
    size: "Taille",
    noState: "Ce rendu n'a pas cet état.",
    large: "Voir en grand",
    previousVariant: "Variante précédente",
    nextVariant: "Variante suivante",
    screen: "Écran",
    preview: "Les aperçus montrent les couleurs, les lettres et les tailles. La mise en page reste celle des maquettes.",
    keep: "Garder",
    discard: "Écarter",
    home: "Aperçu",
    contents: "Sommaire",
    list: "Fiches",
    uses: "Utilise",
    appearsIn: "Apparaît dans",
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
    allOk: "Tout OK",
    close: "Fermer",
    nothing: "Rien à relire.",
    overviewNext: "{count} à relire, dans {steps}.",
    start: "Commencer la revue",
    overviewTodo: "À relire ({count})",
    overviewRevise: "À reprendre ({count})",
    blocked: "Écrivez ce qu'il faut changer sur chaque état à revoir.",
    copyHint: "Donnez un avis sur au moins un état.",
    theme: "Thème",
    platform: "Plateforme",
    sides: "Côte à côte",
    combination: "Combinaison",
    charte: {
      palette: { title: "Palette", lead: "Les couleurs brutes du projet : toutes les autres sont choisies parmi elles." },
      roles: { title: "Rôles", lead: "À quoi sert chaque couleur : texte, fonds, bordures. Les écrans utilisent les rôles, jamais la palette directement." },
      typographie: { title: "Typographie", lead: "Les polices, les tailles et les graisses dans lesquelles tout texte du projet est écrit." },
      espacements: { title: "Espacements", lead: "Les écarts entre les éléments et à l'intérieur, dessinés à leur taille réelle." },
      arrondis: { title: "Arrondis", lead: "À quel point les angles des contrôles et des surfaces sont arrondis." },
      tailles: { title: "Tailles", lead: "Les tailles fixes des contrôles, comparées aux 44 px qu'il faut à un doigt." },
      "points-de-rupture": { title: "Points de rupture", lead: "Les largeurs d'écran où la mise en page change." },
      autres: { title: "Autres réglages", lead: "Les valeurs restantes : durées, ombres et tout ce qui n'a pas d'image propre." },
      notes: { title: "Notes", lead: "Ce que le design system dit en plus de ses tokens." },
      contrast: "Contraste des couleurs de texte sur leurs fonds",
      aa: "AA",
      aaLarge: "AA gros texte",
      fail: "insuffisant",
      decimal: ",",
      pill: "pilule",
      reference: "repère 44 px",
      sample: "Portez ce vieux whisky au juge blond qui fume",
      defaultQuery: "par défaut (moins de {min})",
      defaultOnly: "par défaut",
    },
    forPersona: "Pour",
    persona: "Pour {name}\u202f: {said}",
    states: "États",
    stateNames: { default: "par défaut", empty: "vide", loading: "chargement", error: "erreur", hover: "survol", disabled: "désactivé", pressed: "appuyé", selected: "sélectionné", checked: "coché" },
    sections: { Usage: "Utilisation", Keyboard: "Clavier", Steps: "Étapes", Persona: "Persona", Users: "Utilisateurs", Domain: "Domaine", "Personality and tone": "Personnalité et ton", "Anti-references": "Anti-références", References: "Références", Breakpoints: "Points de rupture", Project: "Projet", Glossary: "Glossaire" },
    checksFolded: "Pour les développeurs ({count})",
    noRender: "Aucun rendu",
    statuses: { proposed: "proposé", validated: "validé", deprecated: "déprécié" },
    stepOf: "Étape {at} sur {count}",
    previousStep: "Étape précédente",
    nextStep: "Étape suivante",
  },
};

const { stateNameOf } = variants;

/** The language `code` names, English when there is no table for it. */
const languageOf = (code) => (Object.hasOwn(LABELS, code) ? code : DEFAULT_LANGUAGE);

const filled = (label, values) => label.replace(/\{(\w+)\}/g, (_, key) => values[key]);
const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // the same order on every machine
const byRecordId = (a, b) => byCode(fm(a).id, fm(b).id);

/** The narrowest readable card of a storyboard, the widest one, so a short journey keeps small cards, the gap that holds the arrow between two cards, and the
 * longest journey that can stand on one row: a container query cannot read a variable, so the width that
 * a count of steps needs is written out for each count. Longer, or narrower, a journey reads as a list. */
const CARD_MIN = 240;
const CARD_MAX = 320;
const CARD_GAP = 48;
const ROW_MAX_STEPS = 12;
const ARROW_RIGHT = `url("data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' viewBox='0 0 20 12'%3E%3Cpath d='M0 6h17M12 1l5 5-5 5' fill='none' stroke='%23d2d2cc' stroke-width='2'/%3E%3C/svg%3E")`;
const ARROW_DOWN = `url("data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' viewBox='0 0 12 20'%3E%3Cpath d='M6 0v17M1 12l5 5 5-5' fill='none' stroke='%23d2d2cc' stroke-width='2'/%3E%3C/svg%3E")`;
const rowBoards = () => Array.from({ length: ROW_MAX_STEPS - 1 }, (_, at) => {
  const n = at + 2;
  const board = `.board[data-steps="${n}"]`;
  return `@container (min-width: ${n * CARD_MIN + (n - 1) * CARD_GAP}px) { ${board} { display: grid; grid-template-columns: repeat(var(--steps), minmax(0, ${CARD_MAX}px)); column-gap: ${CARD_GAP}px; } ${board} .card { display: flex; flex-direction: column; gap: var(--s2); } ${board} .screen { align-self: stretch; } ${board} .card:not(:first-child)::before { left: auto; right: 100%; top: 0; inline-size: ${CARD_GAP}px; padding-top: 62.5%; background: ${ARROW_RIGHT} center / 20px 12px no-repeat; } }`;
}).join("\n");

/** The look of the showcase, light on purpose: wireframes are paper and renders are mostly light
 * screens, so a light shell frames them like a design tool's canvas instead of glaring against them.
 * One scale for space, type and radius, one accent, the system fonts only. */
const SHELL = `
:root { color-scheme: light;
  --bg: #f7f7f5; --surface: #ffffff; --sunken: #efefec; --canvas: #ebebe7; --line: #e4e4df; --line-strong: #d2d2cc; --control: #8f8f88;
  --text: #1d1d1b; --muted: #5c5c55; --faint: #6b6b64;
  --accent: #1d1d1b; --accent-hover: #3a3a37; --accent-soft: #efefec; --accent-text: #1d1d1b;
  --ok: #166534; --ok-soft: #e6f4ea; --revise: #9a4508; --revise-soft: #fdf2e1; --pending: #6b6b64;
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px; --s8: 64px;
  --r1: 4px; --r2: 8px; --r3: 12px; --drawer: 400px;
  --t-xs: 12px; --t-sm: 12px; --t-md: 14px; --t-lg: 16px; --t-xl: 20px; --t-2xl: 28px;
  --shadow: 0 1px 2px rgba(24, 24, 20, 0.06), 0 8px 24px rgba(24, 24, 20, 0.08);
  --font: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; background: var(--bg); color: var(--text); font: var(--t-md)/1.5 var(--font); -webkit-font-smoothing: antialiased; }
a { color: var(--accent-text); text-decoration: none; }
a:hover { text-decoration: underline; }
:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; box-shadow: 0 0 0 2px #fff; }
code { font: var(--t-sm) var(--mono); background: var(--sunken); border-radius: var(--r1); padding: 1px 5px; }
button { font: 500 var(--t-sm)/1 var(--font); color: var(--text); background: var(--surface); border: 1px solid var(--control); border-radius: var(--r2); height: 32px; padding: 0 var(--s3); cursor: pointer; transition: background-color 120ms, border-color 120ms, color 120ms; }
button:hover { background: var(--sunken); }
button:disabled { background: var(--sunken); border-color: var(--line); color: var(--muted); cursor: default; }
#copy { background: var(--accent); border-color: var(--accent); color: #fff; }
#copy:hover:not(:disabled) { background: var(--accent-hover); }
#copy:disabled { background: var(--sunken); border-color: var(--line); color: var(--muted); }
select { appearance: none; font: inherit; font-size: var(--t-sm); color: var(--text); background: var(--surface); border: 1px solid var(--control); border-radius: var(--r2); height: 32px; padding: 0 var(--s5) 0 var(--s2); }
.shell { display: grid; grid-template-columns: 264px minmax(0, 1fr); min-height: 100vh; }
.shell > nav { position: sticky; top: 0; height: 100vh; overflow: hidden; display: flex; flex-direction: column; background: var(--surface); border-right: 1px solid var(--line); padding: var(--s4); }
.nav-scroll { flex: 1; min-height: 0; overflow: auto; }
.nav-bar { display: none; }
.shell > main { min-width: 0; padding: var(--s6) var(--s7); display: flex; flex-direction: column; gap: var(--s5); max-width: 1320px; }
.shell > main.wide { max-width: none; }
nav .brand { display: flex; align-items: center; gap: var(--s1); padding: var(--s1) 0 var(--s4); font-size: var(--t-sm); font-weight: 600; }
nav .mark { inline-size: 20px; block-size: 20px; border-radius: var(--r1); background: var(--text); flex: none; }
nav .home { margin: 0; }
nav .steps { list-style: none; margin: var(--s3) 0 var(--s4); padding: 0; }
nav .steps > li { display: block; }
nav summary { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: var(--s2); padding: 6px var(--s2) 6px var(--s5); background: var(--surface); cursor: pointer; font-size: var(--t-md); font-weight: 600; border-radius: var(--r2); list-style: none; }
nav summary::-webkit-details-marker { display: none; }
nav summary:hover { background: var(--sunken); }
nav .stepno { position: absolute; left: 0; inline-size: 20px; block-size: 20px; border-radius: 999px; background: var(--sunken); color: var(--muted); font-size: var(--t-xs); text-align: center; line-height: 20px; }
nav .step-name { flex: 1; }
nav summary a.step-name { padding: 0; font-weight: 600; color: inherit; }
nav .step-mark { color: var(--muted); font-size: var(--t-xs); font-variant-numeric: tabular-nums; }
nav h2 { font-size: var(--t-sm); font-weight: 600; color: var(--muted); margin: var(--s5) 0 var(--s1); padding-left: var(--s5); }
nav h3 { font-size: var(--t-sm); font-weight: 600; color: var(--muted); margin: var(--s3) 0 var(--s1); padding-left: var(--s5); }
nav ul, .links ul, .checks ul, .appears ul, .drawer ol { list-style: none; margin: 0; padding: 0; }
nav li, nav .home { display: flex; align-items: center; gap: var(--s2); border-radius: var(--r2); }
nav li a, nav .home a { flex: 1; min-width: 0; padding: 5px var(--s2) 5px var(--s5); color: var(--muted); font-size: var(--t-md); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
nav li:hover, nav .home:hover { background: var(--sunken); }
nav a:hover { text-decoration: none; }
nav li:has(> a[aria-current="page"]), nav .home:has(> a[aria-current="page"]) { background: var(--sunken); box-shadow: inset 2px 0 0 var(--text); border-radius: 0 var(--r2) var(--r2) 0; }
nav a[aria-current="page"] { color: var(--text); font-weight: 600; }
.head { display: flex; flex-direction: column; gap: var(--s2); }
.head > .stamp { display: flex; align-items: center; gap: var(--s2); }
.crumb { margin: 0; font-size: var(--t-sm); font-weight: 500; color: var(--faint); }
.head h1, main > h1 { margin: 0; font-size: var(--t-2xl); line-height: 1.2; font-weight: 600; letter-spacing: -0.01em; }
.lede { margin: 0; color: var(--text); font-size: var(--t-lg); max-width: 72ch; }
.head .persona { margin: 0; color: #4a4a45; max-width: 72ch; }
.chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: var(--s1) 0 0; }
.version { color: var(--faint); font-size: var(--t-sm); font-weight: 500; }
.chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 0 10px; line-height: 22px; font-size: var(--t-sm); color: var(--text); }
.chip .key { color: var(--faint); }
.chip[data-key="code"] { font-family: var(--mono); font-size: var(--t-xs); }
.chip[data-status] { border-color: transparent; font-weight: 500; }
.chip[data-status="proposed"] { background: var(--revise-soft); color: var(--revise); }
.chip[data-status="validated"] { background: var(--ok-soft); color: var(--ok); }
.chip[data-status]::before { content: ""; inline-size: 6px; block-size: 6px; border-radius: 50%; background: currentColor; }
.links { display: flex; gap: var(--s3); flex-wrap: wrap; align-items: center; }
.links h2, .bar-top h2, .overview h2, .appears h2 { font-size: var(--t-md); font-weight: 600; margin: 0; }
.links h2 { font-size: var(--t-sm); color: var(--muted); font-weight: 500; min-width: 4rem; }
.links ul { display: flex; gap: 6px; flex-wrap: wrap; }
.links a { display: inline-block; padding: 2px 10px; border-radius: 999px; background: var(--accent-soft); font-size: var(--t-sm); }
.checks { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r3); }
.checks { padding: var(--s3) var(--s5); }
.checks summary { cursor: pointer; font-size: var(--t-sm); font-weight: 500; color: var(--muted); }
.checks li { padding: var(--s2) 0; border-top: 1px solid var(--line); color: var(--muted); }
.checks li b { display: inline-block; margin-right: var(--s2); padding: 0 6px; border-radius: 4px; background: var(--revise-soft); color: var(--revise); font: 600 var(--t-xs)/18px var(--mono); }
.checks .fix { display: block; color: var(--faint); font-size: var(--t-sm); }
.doc { color: var(--text); max-width: 68ch; }
.doc:empty { display: none; }
.doc h1, .doc h2, .doc h3 { margin: var(--s5) 0 var(--s2); line-height: 1.3; }
.doc h2 { font-size: var(--t-lg); }
.doc h3 { font-size: var(--t-md); }
.doc > :first-child { margin-top: 0; }
.doc > :last-child { margin-bottom: 0; }
.doc p, .doc ul { margin: 0 0 var(--s3); color: #3b3b37; }
.doc .scroll { overflow-x: auto; }
.doc table { border-collapse: collapse; width: 100%; font-size: var(--t-md); }
.doc th { text-align: left; font-weight: 600; color: var(--muted); border-bottom: 1px solid var(--line-strong); padding: 6px 10px; }
.doc td { border-bottom: 1px solid var(--line); padding: 8px 10px; vertical-align: top; }
.journey-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2) var(--s5); padding: var(--s3) var(--s4); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r2); font-size: var(--t-md); }
.journey-bar .journey-title { font-weight: 600; }
.journey-bar .where { color: var(--muted); font-variant-numeric: tabular-nums; }
.journey-bar .prev, .journey-bar .next { display: inline-flex; flex-direction: column; gap: 1px; min-width: 0; }
.journey-bar .next { margin-left: auto; align-items: flex-end; text-align: right; }
.journey-bar small { color: var(--faint); font-size: var(--t-xs); }
.journey { padding: var(--s2) 0 var(--s4); container-type: inline-size; }
.board { list-style: none; margin: 0; padding: 0 0 var(--s4); display: flex; flex-direction: column; gap: var(--s5); }
.board .card { position: relative; display: grid; grid-template-columns: 280px minmax(0, 1fr); grid-template-rows: auto 1fr; column-gap: var(--s4); row-gap: var(--s1); align-items: start; }
.board .card:not(:first-child)::before { content: ""; position: absolute; left: 134px; top: calc(var(--s5) * -1); inline-size: 12px; block-size: var(--s5); background: ${ARROW_DOWN} center / contain no-repeat; }
.board .step { display: contents; }
.board .mini { grid-column: 1; grid-row: 1 / span 2; align-self: start; }
.board .screen { grid-column: 2; grid-row: 1; align-self: end; }
.board .action { grid-column: 2; grid-row: 2; }
.step { display: flex; flex-direction: column; gap: var(--s2); color: var(--text); }
.step:hover { text-decoration: none; }
.step:hover .mini { border-color: var(--text); }
.screen { font-size: var(--t-md); font-weight: 600; padding: 0 2px; }
.action { display: flex; gap: var(--s2); margin: 0; font-size: var(--t-md); line-height: 1.45; color: var(--muted); }
.num { flex: none; display: grid; place-content: center; inline-size: 20px; block-size: 20px; border-radius: 50%; background: var(--accent); color: #fff; font-size: var(--t-xs); font-weight: 600; line-height: 1; }
.mini { position: relative; display: block; overflow: hidden; inline-size: 100%; aspect-ratio: 8 / 5; border: 1px solid var(--line); border-radius: var(--r2); background: #fbfbfa; transition: border-color 120ms; }
.mini iframe { position: absolute; top: 0; left: 0; inline-size: 400%; block-size: 400%; border: 0; transform: scale(0.25); transform-origin: 0 0; pointer-events: none; }
.mini.empty { display: grid; place-content: center; border-style: dashed; box-shadow: none; background: var(--sunken); color: var(--faint); font-size: var(--t-sm); }
.review { display: flex; flex-direction: column; gap: 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r3); overflow: hidden; }
.bar-top { display: flex; gap: var(--s3); align-items: center; flex-wrap: wrap; padding: var(--s3) var(--s4) var(--s3) var(--s5); border-bottom: 1px solid var(--line); }
.toolbar { display: flex; gap: var(--s3); align-items: center; flex-wrap: wrap; padding: var(--s2) var(--s5); border-bottom: 1px solid var(--line); background: var(--bg); }
.review fieldset { border: 0; display: flex; gap: var(--s2); align-items: center; padding: 0; margin: 0; }
legend { float: left; margin-right: var(--s2); font-size: var(--t-sm); font-weight: 600; color: var(--muted); }
label { font-size: var(--t-sm); color: var(--muted); }
#sides[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-text); }
.tabs { display: flex; gap: var(--s1); padding: 0 var(--s4); border-bottom: 1px solid var(--line); overflow-x: auto; }
.tab { display: inline-flex; align-items: center; gap: var(--s2); height: 42px; white-space: nowrap; flex: none; padding: 0 var(--s3); border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent; color: var(--muted); font-size: var(--t-md); }
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
.choose { display: inline-flex; margin-left: auto; padding: 2px; gap: 2px; background: var(--sunken); border-radius: var(--r2); }
.choose .verdict { height: 24px; padding: 0 var(--s2); border: 0; background: transparent; color: var(--muted); font-size: var(--t-xs); }
.choose .verdict:hover { color: var(--text); }
.verdict[data-verdict="ok"][aria-pressed="true"] { background: var(--surface); color: var(--ok); }
.verdict[data-verdict="revise"][aria-pressed="true"] { background: var(--surface); color: var(--revise); }
.choose .colvote { height: 24px; padding: 0 var(--s2); border: 0; border-radius: var(--r2); background: transparent; color: var(--muted); font-size: var(--t-xs); cursor: pointer; }
.colvote:hover { color: var(--text); }
.colvote[aria-pressed="true"] { background: var(--surface); color: var(--ok); }
.colvote[data-verdict="revise"][aria-pressed="true"] { color: var(--revise); }
textarea.comment { display: block; flex-basis: 100%; inline-size: 100%; font: inherit; font-size: var(--t-md); color: var(--text); background: var(--surface); border: 1px solid var(--control); border-radius: var(--r2); padding: var(--s2) var(--s3); resize: vertical; }
textarea.comment:focus { outline: 2px solid var(--accent-soft); border-color: var(--accent); }
.pair { display: flex; gap: var(--s5); flex-wrap: wrap; align-items: flex-start; padding: var(--s6); background: var(--canvas) radial-gradient(#d6d6d0 1px, transparent 1px) 0 0 / 16px 16px; border-top: 1px solid var(--line); }
.render { display: flex; gap: var(--s5); flex: 1 1 24rem; min-width: 0; align-items: flex-start; }
.render iframe { box-sizing: content-box; flex: 1; min-width: 0; width: 100%; height: 240px; border: 1px solid var(--line-strong); border-radius: var(--r2); background: #fff; }
.state .render iframe[data-platform="mobile"] { flex: 0 0 390px; inline-size: 390px; }
.capture { flex: 1 1 24rem; margin: 0; min-width: 0; }
.capture img { display: block; max-width: 100%; border: 1px solid var(--line-strong); border-radius: var(--r2); }
.capture.missing { display: flex; align-items: center; justify-content: center; min-block-size: 160px; border: 1.5px dashed var(--line-strong); border-radius: var(--r2); color: var(--muted); padding: var(--s4); font-size: var(--t-sm); text-align: center; }
.overview { display: flex; flex-direction: column; gap: var(--s3); }
.overview h2 { display: flex; align-items: center; gap: var(--s2); }
.overview h2 span { font-size: var(--t-xs); font-weight: 600; color: var(--muted); background: var(--sunken); border-radius: 999px; padding: 0 7px; line-height: 18px; }
.todo-step h3 { display: flex; align-items: center; gap: var(--s2); margin: var(--s3) 0 var(--s1); font-size: var(--t-md); }
.todo-step h3 span { font-size: var(--t-xs); font-weight: 600; color: var(--muted); background: var(--sunken); border-radius: 999px; padding: 0 7px; line-height: 18px; }
.todo-step h4 { margin: var(--s3) 0 2px; font-size: var(--t-xs); font-weight: 500; color: var(--muted); }
.overview ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.overview li { display: flex; align-items: center; gap: var(--s2); padding: 4px 0; border-bottom: 1px solid var(--line); }
.overview li a { flex: 1; }
.stepper { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s2); }
.stepper li > a, .stepper li > .cell { display: flex; align-items: center; gap: var(--s3); min-block-size: 44px; padding: var(--s2) var(--s4); border: 1px solid var(--line); border-radius: var(--r2); background: var(--surface); color: var(--text); text-decoration: none; }
.stepper li > a:hover { background: var(--sunken); }
.stepper .no { flex: none; inline-size: 24px; block-size: 24px; display: grid; place-items: center; border-radius: 999px; background: var(--sunken); font-size: var(--t-xs); font-weight: 600; }
.stepper .name { font-weight: 600; }
.stepper .state { margin-left: auto; color: var(--muted); font-size: var(--t-sm); }
.stepper li[data-state="todo"] .state { color: var(--revise); font-weight: 600; }
.stepper li[data-state="empty"] > .cell { color: var(--muted); background: transparent; }
.start-row { margin: var(--s3) 0 0; }
.start { display: inline-flex; align-items: center; min-block-size: 44px; padding: 0 var(--s5); border-radius: var(--r2); background: var(--accent); color: #fff; font-weight: 600; text-decoration: none; }
.start:hover { background: var(--accent-hover); }
@media (min-width: 900px) { .stepper { flex-direction: row; } .stepper li { flex: 1 1 0; min-width: 0; } .stepper li > a, .stepper li > .cell { flex-direction: column; align-items: flex-start; block-size: 100%; gap: var(--s2); } .stepper .state { margin-left: 0; } }
.progress { margin-left: auto; color: var(--faint); font-variant-numeric: tabular-nums; }
.progress[data-complete="true"] { color: var(--ok); }
.appears { display: flex; flex-direction: column; gap: var(--s3); padding-top: var(--s5); border-top: 1px solid var(--line); }
.appears ul { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--s3); }
.mini-card { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-inline-size: 180px; padding: var(--s3) var(--s4); color: var(--text); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r2); transition: border-color 120ms, box-shadow 120ms; }
.mini-card:hover { text-decoration: none; border-color: #c7cdfb; }
.mini-card b { font-size: var(--t-md); font-weight: 600; }
.mini-card .chip { line-height: 18px; padding: 0 8px; font-size: var(--t-xs); }
.open-review { display: flex; align-items: center; justify-content: space-between; gap: var(--s2); inline-size: 100%; height: 34px; padding: 0 var(--s4); background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
.open-review:hover { background: var(--accent-hover); }
.open-review .pending { padding: 0 7px; border-radius: 999px; background: rgba(255, 255, 255, 0.22); color: #fff; font-size: var(--t-xs); line-height: 18px; font-variant-numeric: tabular-nums; }
.open-review[aria-expanded="true"] { display: none; }
.review-foot { flex: none; padding: var(--s3) 0 0; background: var(--surface); }
.tally { padding: 0 7px; border-radius: 999px; background: var(--sunken); color: var(--muted); font-size: var(--t-xs); line-height: 18px; font-variant-numeric: tabular-nums; }
.scrim { display: none; }
body[data-drawer="open"] .scrim { display: block; position: fixed; inset: 0; z-index: 25; background: rgba(29, 29, 27, 0.4); }
@media (min-width: 1680px) {
  .scrim { display: none !important; }
  body[data-drawer="open"] .shell > main { padding-right: calc(var(--s7) + var(--drawer)); max-width: calc(1320px + var(--drawer)); }
}
.drawer { position: fixed; max-inline-size: 100vw; top: 0; right: 0; bottom: 0; z-index: 30; inline-size: var(--drawer); display: flex; flex-direction: column; background: var(--surface); border-left: 1px solid var(--line); box-shadow: var(--shadow); }
.drawer-head { display: flex; align-items: center; gap: var(--s2); padding: var(--s3) var(--s3) var(--s3) var(--s5); border-bottom: 1px solid var(--line); }
.drawer-head h2 { margin: 0; font-size: var(--t-md); font-weight: 600; }
.drawer-head .close { margin-left: auto; inline-size: 32px; padding: 0; border-color: transparent; background: transparent; color: var(--muted); font-size: var(--t-lg); }
.drawer-body { flex: 1; overflow: auto; padding: var(--s2) 0; }
.drawer-body > p { margin: var(--s4) var(--s5); color: var(--muted); font-size: var(--t-md); }
.step-group > summary { display: flex; align-items: center; gap: var(--s2); padding: var(--s3) var(--s5); cursor: pointer; font-size: var(--t-md); font-weight: 600; list-style: none; background: var(--bg); border-bottom: 1px solid var(--line); }
.step-group > summary::-webkit-details-marker { display: none; }
.step-group .step-count { color: var(--faint); font-weight: 500; }
.step-group .step-ok { margin-left: auto; height: 26px; }
.item { border-bottom: 1px solid var(--line); }
.item summary { display: flex; align-items: center; gap: var(--s2); padding: var(--s3) var(--s5); cursor: pointer; font-size: var(--t-md); font-weight: 600; list-style: none; }
.item summary::-webkit-details-marker { display: none; }
.item summary::before { content: ""; flex: none; inline-size: 6px; block-size: 6px; border: solid var(--faint); border-width: 0 1.5px 1.5px 0; transform: rotate(-45deg); transition: transform 120ms; }
.item[open] summary::before { transform: rotate(45deg); }
.item summary:hover { background: var(--bg); }
.item[data-here] summary { color: var(--accent-text); }
.item .done { margin-left: auto; color: var(--faint); font-weight: 500; font-size: var(--t-xs); font-variant-numeric: tabular-nums; }
.item ol { padding: 0 var(--s3) var(--s3); }
.pstate { min-block-size: 44px; display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); padding: 6px var(--s2); border-radius: var(--r2); }
.pstate.on { background: var(--accent-soft); }
.pstate::before { content: ""; flex: none; inline-size: 8px; block-size: 8px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--faint); }
.pstate[data-current="ok"]::before, .pstate[data-choice="ok"]::before { background: var(--ok); box-shadow: none; }
.pstate[data-current="revise"]::before, .pstate[data-choice="revise"]::before { background: var(--revise); box-shadow: none; }
.pstate .pick { min-width: 0; flex: 1; color: var(--text); font-size: var(--t-md); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pstate .said { flex-basis: 100%; margin-left: var(--s4); font-size: var(--t-xs); }
.drawer-foot { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); padding: var(--s3) var(--s5); border-top: 1px solid var(--line); background: var(--bg); }
.drawer-foot #copy { margin-left: auto; }
#note { flex-basis: 100%; margin: 0; color: var(--revise); font-size: var(--t-sm); }
#note:empty { display: none; }
textarea.out { width: 100%; min-height: 8rem; font: var(--t-sm) var(--mono); border: 1px solid var(--control); border-radius: var(--r2); padding: var(--s2); }
@container (max-width: 527px) { .board .card { grid-template-columns: minmax(0, 1fr); } .board .mini, .board .screen, .board .action { grid-column: 1; grid-row: auto; } .board .card:not(:first-child)::before { left: 12px; } }
${rowBoards()}
@media (max-width: 768px) {
  .shell { display: block; }
  .shell > nav { position: fixed; inset: 0 0 auto 0; z-index: 40; block-size: 56px; flex-direction: row; align-items: center; gap: var(--s3); padding: 0 var(--s4); border-right: 0; border-bottom: 1px solid var(--line); }
  .nav-bar { display: flex; align-items: center; justify-content: space-between; gap: var(--s3); flex: 1; min-width: 0; }
  .nav-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nav-scroll { display: none; }
  .shell > nav[data-open] .nav-scroll { display: block; position: fixed; inset: 56px 0 0 0; padding: var(--s4); background: var(--surface); }
  .nav-scroll .brand { display: none; }
  .review-foot { padding: 0; }
  .open-review { inline-size: auto; gap: var(--s3); }
  .shell > main { padding: calc(56px + var(--s4)) var(--s4) var(--s6); }
  .pair { padding: var(--s3); }
  .state .render iframe[data-platform="mobile"] { flex: 0 1 390px; min-inline-size: 0; }
}
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
  follow(frame, root);
}
function fit(frame) {
  const root = frame.contentDocument && frame.contentDocument.documentElement;
  const height = root ? Math.ceil(root.getBoundingClientRect().height) : 0;
  if (height > 0) frame.style.height = height + "px";
}
/* A frame's content reflows after it loads (a window resize, a late font, a panel shown): the height follows the root of its document, which a load replaces. */
const followed = new WeakMap();
function follow(frame, root) {
  if (typeof ResizeObserver !== "function") return;
  const own = followed.get(frame);
  if (own && own.root === root) return;
  if (own) own.observer.disconnect();
  const observer = new ResizeObserver(() => fit(frame));
  observer.observe(root);
  followed.set(frame, { root, observer });
}
window.addEventListener("resize", () => frames().forEach(fit));
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
 * the order given, and each set with a variant decided, as fenced JSON. One entry is one object, as a
 * record's page always copied it and the comparison page copied a set; several are a list of the same
 * objects. A set keeps its variants all, the undecided as null. Nothing decided copies nothing. Embedded in
 * the pages as its own source, so the test and the page run the same function. */
function copiedOf(entries) {
  const body = entries.flatMap((entry) => {
    if (entry.variants) {
      const picked = entry.picks && Object.keys(entry.picks).length ? { picks: entry.picks } : {};
      if (!entry.variants.some((each) => each.verdict) && !picked.picks) return [];
      return [Object.assign({ set: entry.set, variants: entry.variants.map((each) => ({ name: each.name, verdict: each.verdict || null, comment: String(each.comment || "").trim() })) }, picked)];
    }
    if (!entry.verdicts.length) return [];
    return [{
      record: entry.record,
      version: Number(entry.version),
      verdicts: entry.verdicts.map((each) => ({ state: each.state, verdict: each.verdict, comment: String(each.comment || "").trim() })),
    }];
  });
  if (!body.length) return "";
  return "```json\n" + JSON.stringify(body.length === 1 ? body[0] : body, null, 2) + "\n```\n";
}

/** The entries of a copy from the page's `model` and its `choices`: `model.records` each `{key, record,
 * version, states: [{state, settled}]}`, `model.sets` each `{key, set, variants: [name]}`, `choices` by key
 * then by state or variant name. A variant with no choice is null. Records come first, then sets. */
function entriesOf(model, choices) {
  const records = model.records.map((each) => ({
    record: each.record,
    version: each.version,
    verdicts: each.states.filter((one) => (choices[each.key] || {})[one.state]).map((one) => {
      const choice = choices[each.key][one.state];
      return { state: one.state, verdict: choice.verdict, comment: choice.comment || "" };
    }),
  }));
  const sets = model.sets.map((each) => {
    const picks = (choices[each.key] || {})["@picks"];
    return Object.assign({
      set: each.set,
      variants: each.variants.map((name) => {
        const choice = (choices[each.key] || {})[name];
        return { name, verdict: choice ? choice.verdict : null, comment: choice ? choice.comment || "" : "" };
      }),
    }, picks && Object.keys(picks).length ? { picks } : {});
  });
  return records.concat(sets);
}

/** The picks of a set after one more pick of `variant` for `axis`: the last pick of an axis stands, and the same
 * pick again takes it back. Picks are by axis name, kept in the set's choices under `@picks`, which no variant is named. */
function pickedOf(picks, axis, variant) {
  const next = Object.assign({}, picks);
  if (next[axis] === variant) delete next[axis];
  else next[axis] = variant;
  return next;
}

/** Whether a verdict to revise has no comment, in a state or in a variant: the copy waits for it. */
function blockedOf(entries) {
  const bare = (each) => each.verdict === "revise" && !String(each.comment || "").trim();
  return entries.some((entry) => (entry.variants || entry.verdicts).some(bare));
}

/** The states a click on a step's "all OK" marks: each state of the records of that step (of every step when none
 * is named) with no choice that is not settled already, as `{key, state}`. A variant is a choice between options,
 * never one of these. */
function remainingOf(model, choices, step) {
  return model.records.filter((each) => !step || each.step === step).flatMap((each) => each.states.filter((one) => !one.settled && !(choices[each.key] || {})[one.state]).map((one) => ({ key: each.key, state: one.state })));
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
${entriesOf.toString()}
${blockedOf.toString()}
${remainingOf.toString()}
${pickedOf.toString()}
const STORE = "aidd-ui-review";
const drawer = document.getElementById("review");
const opener = document.getElementById("open-review");
const copy = document.getElementById("copy");
const clear = document.getElementById("clear");
const note = document.getElementById("note");
const items = [...drawer.querySelectorAll("details.item")];
const stepButtons = [...drawer.querySelectorAll(".step-ok")];
const sets = [...drawer.querySelectorAll("details.choice")];
const pickers = [...document.querySelectorAll(".variants[data-set]")];
const keyOf = (item) => item.dataset.record + "@" + item.dataset.version;
const setKeyOf = (set) => "set:" + set.dataset.set + "@" + set.dataset.fingerprint;
const rowsOf = (item) => [...item.querySelectorAll("li.pstate")];
const picksOf = (holder) => (choices[setKeyOf(holder)] || {})["@picks"] || {};
const variantsOf = (set) => [...set.querySelectorAll("li.pvariant")];
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
try { choices = keptOf(JSON.parse(stored(STORE) || "{}"), items.map(keyOf).concat(sets.map(setKeyOf))); } catch (error) { choices = {}; }
const choiceOf = (key, name) => (choices[key] || {})[name];
function choose(key, name, choice) {
  const own = Object.assign({}, choices[key]);
  if (choice) own[name] = choice;
  else delete own[name];
  if (Object.keys(own).length) choices[key] = own;
  else delete choices[key];
  keep(STORE, Object.keys(choices).length ? JSON.stringify(choices) : null);
}
const settled = (row) => row.dataset.current === "ok" || row.dataset.current === "revise";
const model = () => ({
  records: items.map((item) => ({ key: keyOf(item), step: item.closest("details.step-group").dataset.step, record: item.dataset.record, version: item.dataset.version, states: rowsOf(item).map((row) => ({ state: row.dataset.state, settled: settled(row) })) })),
  sets: sets.map((set) => ({ key: setKeyOf(set), set: set.dataset.set, variants: variantsOf(set).map((row) => row.dataset.variant) })),
});
const entries = () => entriesOf(model(), choices);
const blocked = () => blockedOf(entries());
function paint() {
  let left = 0;
  for (const item of items) {
    const rows = rowsOf(item);
    let own = 0;
    for (const row of rows) {
      const choice = choiceOf(keyOf(item), row.dataset.state);
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
      const settledNow = Number(each.dataset.base) + own;
      each.textContent = settledNow + "/" + each.dataset.total;
      each.dataset.complete = String(settledNow === Number(each.dataset.total));
    });
    if (own < rows.length) left += 1;
  }
  for (const set of sets) {
    let decided = 0;
    for (const row of variantsOf(set)) {
      const choice = choiceOf(setKeyOf(set), row.dataset.variant);
      const verdict = choice ? choice.verdict : "";
      if (verdict) { row.dataset.choice = verdict; decided += 1; } else delete row.dataset.choice;
      row.querySelectorAll(".vote").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.verdict === verdict)));
      const field = row.querySelector(".comment");
      field.hidden = verdict !== "revise";
      if (document.activeElement !== field) field.value = (choice && choice.comment) || "";
    }
    if (!decided) left += 1;
    const total = set.querySelector(".done");
    total.textContent = decided + "/" + variantsOf(set).length + " " + total.dataset.label;
    const count = set.querySelector(".picked");
    const taken = Object.keys(picksOf(set)).length;
    count.hidden = !taken;
    count.textContent = taken + "/" + count.dataset.axes + " " + count.dataset.label;
  }
  for (const holder of pickers) {
    for (const column of holder.querySelectorAll(".variant")) {
      const choice = choiceOf(setKeyOf(holder), column.dataset.variant);
      column.querySelectorAll(".colvote").forEach((button) => button.setAttribute("aria-pressed", String(!!choice && button.dataset.verdict === choice.verdict)));
    }
    const own = picksOf(holder);
    holder.querySelectorAll(".take").forEach((button) => button.setAttribute("aria-pressed", String(own[button.dataset.axis] === button.dataset.variant)));
  }
  document.querySelectorAll(".tally[data-template]").forEach((each) => { each.textContent = each.dataset.template.replace("{count}", String(left)); });
  const stuck = blocked();
  copy.disabled = stuck || !copiedOf(entries());
  for (const button of stepButtons) button.disabled = remainingOf(model(), choices, button.dataset.step).length === 0;
  note.textContent = stuck ? copy.dataset.blocked : copy.disabled ? copy.dataset.hint : "";
}
/** Marks the state of the page's own record that its tabs show. */
function marked(state) {
  for (const item of items) if (item.hasAttribute("data-here")) rowsOf(item).forEach((row) => row.classList.toggle("on", row.dataset.state === state));
}
function show(on) {
  drawer.hidden = !on;
  document.body.dataset.drawer = on ? "open" : "closed";
  opener.setAttribute("aria-expanded", String(on));
}
items.forEach((item) => rowsOf(item).forEach((row) => {
  const state = row.dataset.state;
  const field = row.querySelector(".comment");
  row.querySelectorAll(".verdict").forEach((button) => button.addEventListener("click", () => {
    const now = choiceOf(keyOf(item), state);
    const again = now && now.verdict === button.dataset.verdict;
    const revise = button.dataset.verdict === "revise";
    choose(keyOf(item), state, again ? null : { verdict: button.dataset.verdict, comment: revise && now ? now.comment || "" : "" });
    paint();
    if (!again && revise) field.focus();
  }));
  field.addEventListener("input", () => {
    choose(keyOf(item), state, { verdict: "revise", comment: field.value });
    paint();
  });
  const tab = item.hasAttribute("data-here") ? document.getElementById("tab-" + state) : null;
  if (tab && typeof openTab === "function") row.querySelector(".pick").addEventListener("click", (event) => {
    event.preventDefault();
    openTab(tab);
  });
}));
/** Sets or takes back a verdict on a variant, from the drawer or from its column; true when it asks for a comment. */
function vote(key, name, verdict) {
  const now = choiceOf(key, name);
  const again = now && now.verdict === verdict;
  const revise = verdict === "revise";
  choose(key, name, again ? null : { verdict, comment: revise && now ? now.comment || "" : "" });
  paint();
  return !again && revise;
}
pickers.forEach((holder) => holder.querySelectorAll(".colvote").forEach((button) => button.addEventListener("click", () => {
  if (!vote(setKeyOf(holder), button.dataset.variant, button.dataset.verdict)) return;
  show(true);
  const own = sets.find((set) => setKeyOf(set) === setKeyOf(holder));
  const row = own && variantsOf(own).find((each) => each.dataset.variant === button.dataset.variant);
  if (row) row.querySelector(".comment").focus();
})));
sets.forEach((set) => variantsOf(set).forEach((row) => {
  const name = row.dataset.variant;
  const field = row.querySelector(".comment");
  row.querySelectorAll(".vote").forEach((button) => button.addEventListener("click", () => {
    if (vote(setKeyOf(set), name, button.dataset.verdict)) field.focus();
  }));
  field.addEventListener("input", () => {
    choose(setKeyOf(set), name, { verdict: "revise", comment: field.value });
    paint();
  });
}));
pickers.forEach((holder) => holder.querySelectorAll(".take").forEach((button) => button.addEventListener("click", () => {
  const next = pickedOf(picksOf(holder), button.dataset.axis, button.dataset.variant);
  choose(setKeyOf(holder), "@picks", Object.keys(next).length ? next : null);
  paint();
})));
opener.addEventListener("click", () => show(true));
document.getElementById("close-review").addEventListener("click", () => { show(false); opener.focus(); });
document.getElementById("scrim").addEventListener("click", () => { show(false); opener.focus(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !drawer.hidden) { show(false); opener.focus(); } });
stepButtons.forEach((button) => button.addEventListener("click", (event) => {
  event.preventDefault();
  for (const { key, state } of remainingOf(model(), choices, button.dataset.step)) choose(key, state, { verdict: "ok", comment: "" });
  paint();
}));
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

/** Whether the drawer reviews the record: one with a render, or a brand or a system, which has a version and no render. */
const reviewable = (project, record) => hasRender(project, record) || (["brand", SYSTEM_ID].includes(fm(record).kind) && fm(record).version !== undefined);

/** Whether a screen's code is at its version: its states then each need a capture. */
const isCoded = (record) => fm(record).kind === "screen" && list(fm(record).code).some((link) => parseLink(link)?.version === fm(record).version);

const link = (id, current, shown = id) => `<a href="${escaped(id)}.html"${current ? ' aria-current="page"' : ""}>${escaped(shown)}</a>`;

/** A status in the language of the page; one the table does not know is shown as written. */
const statusLabel = (labels, status) => (Object.hasOwn(labels.statuses, status) ? labels.statuses[status] : String(status));

/** Elements by the order of the categories, every record by its id. */
const byCategory = (a, b) => CATEGORIES.indexOf(categoryOf(a)) - CATEGORIES.indexOf(categoryOf(b)) || byRecordId(a, b);

/** The step a page stands on: that of its record or set, on the overview the first step with work. */
function hereOf(held, records, sets, current) {
  if (current === null) return held.find((each) => each.todo)?.step;
  if (current.startsWith(SET_CURRENT)) return setStepOf(sets.find((set) => `${SET_CURRENT}${set.id}` === current) ?? {});
  return stepOf(records.find((record) => fm(record).id === current) ?? {});
}

/** The count of what awaits review, as the button and the drawer write it: the page script rewrites it as verdicts are given. */
const pendingOf = (labels, count) => `<span class="tally pending" data-template="${escaped(labels.toReview)}">${escaped(filled(labels.toReview, { count }))}</span>`;

/** What each step holds and what in it awaits review: its records, its sets, the records with a render and a state
 * not settled, and the open sets. `todo` counts records and open sets, never states. */
function stepsOf({ project, records, rows, sets }) {
  return STEPS.map((step) => {
    const own = records.filter((record) => stepOf(record) === step);
    const ownSets = sets.filter((set) => setStepOf(set) === step);
    const awaiting = own.filter((record) => reviewable(project, record) && awaitingOf(rows, record).length).sort(byCategory);
    const open = ownSets.filter((set) => !set.problems.length);
    return { step, records: own, sets: ownSets, awaiting, open, todo: awaiting.length + open.length };
  });
}

/** The records of the screens step, grouped under the first journey whose Steps table names them, in step order;
 * the rest under an empty journey id. One group with no journey when none names any. */
function screenGroupsOf(records, journeys) {
  const byId = new Map(records.map((record) => [fm(record).id, record]));
  const placedIds = new Set();
  const groups = [];
  for (const journey of [...journeys].sort(byRecordId)) {
    const own = [];
    for (const row of table(journey.sections[STEPS_SECTION])) {
      const target = byId.get(row.Screen);
      if (target && !placedIds.has(row.Screen)) {
        placedIds.add(row.Screen);
        own.push(target);
      }
    }
    if (own.length) groups.push({ journey, records: own });
  }
  const rest = records.filter((record) => !placedIds.has(fm(record).id)).sort(byRecordId);
  if (rest.length) groups.push({ journey: null, records: rest });
  return groups;
}

/** The navigation, the same on every page: the five steps in order, each folded, the Review button at its foot. */
function navigationOf(project, records, labels, current, sets = [], rows = [], anchors = new Map()) {
  const journeys = records.filter((record) => fm(record).kind === "journey");
  const item = (record) => `<li data-id="${escaped(fm(record).id)}">${link(fm(record).id, fm(record).id === current, titleOf(project, record, labels))}</li>`;
  const named = (record, step) => `<li data-id="${escaped(fm(record).id)}">${link(fm(record).id, fm(record).id === current, labels.stepNames[step])}</li>`;
  const ul = (items) => `<ul>${items.join("")}</ul>`;
  const setsOf = (held) => (held.length ? `<section data-group="choose"><h3>${labels.choose}</h3><ul>${held.map((set) => `<li data-set="${escaped(set.id)}"><a href="${escaped(variants.setFileOf(set.id))}"${current === `${SET_CURRENT}${set.id}` ? ' aria-current="page"' : ""}>${escaped(set.id)}</a></li>`).join("")}</ul></section>` : "");
  const bodyOf = ({ step, records: own }) => {
    const sorted = [...own].sort(byRecordId);
    if (step === "identity" || step === "foundations") return ul(sorted.map((record) => named(record, step)));
    if (step === "components") return CATEGORIES.flatMap((category) => {
      const inCategory = sorted.filter((record) => categoryOf(record) === category);
      return inCategory.length ? [`<h3 data-category="${category}">${labels.categories[category]}</h3>${ul(inCategory.map(item))}`] : [];
    }).join("");
    if (step === "screens") {
      const groups = screenGroupsOf(own, journeys);
      if (!groups.some((group) => group.journey)) return ul(sorted.map(item));
      return groups.map((group) => `<h3 data-journey="${group.journey ? escaped(fm(group.journey).id) : ""}">${group.journey ? escaped(titleOf(project, group.journey)) : labels.outOfJourney}</h3>${ul(group.records.map(item))}`).join("");
    }
    return ul(sorted.map(item));
  };
  const held = stepsOf({ project, records, rows, sets });
  const here = hereOf(held, records, sets, current);
  const total = held.reduce((sum, each) => sum + each.todo, 0);
  const stepItem = (each, at) => {
    const mark = each.todo ? each.todo : each.records.length || each.sets.length ? "\u2713" : "\u2014";
    const markName = each.todo ? filled(labels.toReview, { count: each.todo }) : each.records.length || each.sets.length ? labels.stepDone : labels.stepEmpty;
    const alone = (each.step === "identity" || each.step === "foundations") && each.records.length === 1 && !each.sets.length ? each.records[0] : null;
    const name = alone
      ? `<a class="step-name" href="${escaped(fm(alone).id)}.html"${fm(alone).id === current ? ' aria-current="page"' : ""}>${labels.stepNames[each.step]}</a>`
      : `<span class="step-name">${labels.stepNames[each.step]}</span>`;
    const body = alone ? subNavigationOf(fm(alone).id, anchors.get(fm(alone).id) ?? []) : bodyOf(each) + setsOf(each.sets);
    return `<li data-step="${each.step}" data-todo="${each.todo}"><details${each.step === here ? " open" : ""}><summary><span class="stepno">${at + 1}</span>${name}<span class="step-mark" role="img" aria-label="${escaped(markName)}">${mark}</span></summary>${body}</details></li>`;
  };
  const foot = `<div class="review-foot"><button type="button" class="open-review" id="open-review" aria-controls="review" aria-expanded="false">${labels.review} ${pendingOf(labels, total)}</button></div>`;
  const bar = `<div class="nav-bar"><span class="nav-title">${labels.title}</span><button type="button" id="nav-toggle" aria-controls="nav-sheet" aria-expanded="false">${labels.contents}</button></div>`;
  return `<nav aria-label="${escaped(labels.list)}">${bar}<div class="nav-scroll" id="nav-sheet"><div class="brand"><span class="mark"></span>${labels.title}</div><p class="home"><a href="index.html"${current === null ? ' aria-current="page"' : ""}>${labels.home}</a></p><ol class="steps">${held.map(stepItem).join("")}</ol></div>${foot}</nav>`;
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
  const line = !said ? `${labels.forPersona} ${name}` : !name ? said : opensWithName ? said : filled(labels.persona, { name, said });
  return `<p class="persona">${escaped(line)}</p>`;
}

/** The address of a step of a journey: the page of its screen, the journey and the step in the query, since a
 * screen can come twice in one journey. The hash stays the tabs'. */
const stepAddress = (journey, screen, step) => `${screen}.html?journey=${encodeURIComponent(journey)}&step=${step}`;

/** A journey as a storyboard: a card per step of its Steps table, showing a miniature of the record that
 * bears the name and linking its page, the screen named under it, then the action numbered. */
function journeyOf({ project, record, recordsById, tokens, labels }) {
  const steps = table(record.sections[STEPS_SECTION]);
  if (!steps.length) return "";
  const card = (row, at) => {
    const target = recordsById.get(row.Screen);
    const face = `${miniatureOf(project, target, tokens, labels)}<span class="screen">${escaped(target ? titleOf(project, target) : row.Screen ?? "")}</span>`;
    const shown = target ? `<a class="step" href="${escaped(stepAddress(fm(record).id, row.Screen, at + 1))}">${face}</a>` : `<div class="step">${face}</div>`;
    return `<li class="card" data-step="${at + 1}">${shown}<p class="action"><span class="num">${at + 1}</span>${escaped(row.Action ?? "")}</p></li>`;
  };
  return `<section class="journey"><ol class="board" data-steps="${steps.length}" style="--steps: ${steps.length}">${steps.map(card).join("")}</ol></section>`;
}

/** The bars of a page a journey passes through, one per step that names it, hidden until the address names
 * that journey and step: the journey to go back to, where the step stands, the steps around. */
function barsOf({ project, record, journeys, recordsById, labels }) {
  const id = fm(record).id;
  const bars = [];
  for (const journey of journeys) {
    const steps = table(journey.sections[STEPS_SECTION]);
    const journeyId = fm(journey).id;
    steps.forEach((row, at) => {
      if (row.Screen !== id) return;
      const around = (to, name, caption) => {
        const target = recordsById.get(steps[to]?.Screen);
        return target ? `<a class="${name}" href="${escaped(stepAddress(journeyId, steps[to].Screen, to + 1))}"><small>${caption}</small>${escaped(titleOf(project, target))}</a>` : "";
      };
      bars.push(`<nav class="journey-bar" data-journey="${escaped(journeyId)}" data-step="${at + 1}" aria-label="${escaped(titleOf(project, journey))}" hidden><a class="journey-title" href="${escaped(journeyId)}.html">${escaped(titleOf(project, journey))}</a><span class="where">${escaped(filled(labels.stepOf, { at: at + 1, count: steps.length }))}</span>${around(at - 1, "prev", labels.previousStep)}${around(at + 1, "next", labels.nextStep)}</nav>`);
    });
  }
  return bars;
}

/** The script of the journey bars: shows the one the query of the address names. The hash is the tabs'. */
const JOURNEY_BARS = `
const query = new URLSearchParams(location.search);
for (const bar of document.querySelectorAll(".journey-bar")) {
  if (bar.dataset.journey === query.get("journey") && bar.dataset.step === query.get("step")) bar.hidden = false;
}
`;

const chipOf = (key, value) => `<span class="chip" data-key="${key}"><span class="key">${key}</span>${escaped(String(value))}</span>`;

const statusOf = (record, labels) => (fm(record).status === undefined ? "" : `<span class="chip" data-status="${escaped(fm(record).status)}">${escaped(statusLabel(labels, fm(record).status))}</span>`);

/** The status of a record with its version small beside it, stamped on the title line. */
function stampOf(record, labels) {
  const { version } = fm(record);
  const parts = [statusOf(record, labels), ...(version === undefined ? [] : [`<span class="version">v${escaped(String(version))}</span>`])].join("");
  return parts ? `<div class="stamp">${parts}</div>` : "";
}

/** The line under the description of a record: its route and code links. Its id and kind are left to
 * the navigation and the group above the title. */
function chipsOf(record) {
  const { route } = fm(record);
  const chips = [...(route === undefined ? [] : [chipOf("route", route)]), ...list(fm(record).code).map((code) => chipOf("code", code))].join("");
  return chips ? `<div class="chips">${chips}</div>` : "";
}

const linksOf = (kind, label, ids, shown = (id) => id) => (ids.length ? `<section class="links" data-links="${kind}"><h2>${label}</h2><ul>${ids.map((id) => `<li>${link(id, false, shown(id))}</li>`).join("")}</ul></section>` : "");

/** Where a record appears, at the bottom of its page: a small card per record that cites it, its title and status. */
function appearsOf({ project, ids, recordsById, labels }) {
  if (!ids.length) return "";
  const card = (id) => `<li><a class="mini-card" href="${escaped(id)}.html"><b>${escaped(titleOf(project, recordsById.get(id), labels))}</b>${statusOf(recordsById.get(id), labels)}</a></li>`;
  return `<section class="appears"><h2>${labels.appearsIn}</h2><ul>${ids.map(card).join("")}</ul></section>`;
}

/** The engine checks about a record or its render. A component the design system does not hold yet (R18) is left to the final reply. */
function checksOf(problems, record, labels) {
  const own = problems.filter((each) => each.rule !== EXPECTED_COMPONENT && (each.file === record.file || each.file === renderOf(record)));
  if (!own.length) return "";
  const items = own.map((each) => `<li data-rule="${escaped(each.rule)}"><b>${escaped(each.rule)}</b> ${escaped(each.message)} <span class="fix">${escaped(each.fix)}</span></li>`);
  return `<details class="checks"><summary>${escaped(filled(labels.checksFolded, { count: own.length }))}</summary><ul>${items.join("")}</ul></details>`;
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
  const axes = [["theme", labels.theme, list(system && fm(system).themes)], ["platform", labels.platform, list(system && fm(system).platforms)]].filter(([, , values]) => values.length > 1);
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
  const tab = ({ state, verdict }, at) => `<button type="button" role="tab" class="tab" id="${escaped(tabId(state))}" aria-controls="${escaped(panelId(state))}" aria-selected="${at === 0}" tabindex="${at === 0 ? 0 : -1}" data-tab="${escaped(state)}" data-current="${escaped(verdict.current)}"><i class="dot" aria-hidden="true"></i>${escaped(stateNameOf(labels, state))}</button>`;
  return `<div class="tabs" role="tablist" aria-label="${escaped(labels.states)}">${states.map(tab).join("")}</div>`;
}

/** The `data-platform` attribute of a frame: the first platform the system declares, none without one. */
const platformOf = (system) => (system && list(fm(system).platforms).length ? ` data-platform="${escaped(list(fm(system).platforms)[0])}"` : "");

/** The states of a record with what the review says of each: the ones still to review first, the others in the record's order. */
function orderedStates(rows, record) {
  const states = reviewStatesOf(record).map((state) => ({ state, verdict: verdictOf(rows, record, state) }));
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

/** The review panel, the same on every page but for the step of the page, which starts open: one group per step
 * with something left to review, each record awaiting review with only its states not settled, each state with a
 * link to its tab, its verdict pair and a comment field, then one copy of all that is decided. A group carries its
 * own "all OK". Opened by the button at the foot of the sidebar, which counts what awaits review. */
function drawerOf({ project, held, here, rows, labels, current, sets = [] }) {
  const item = (record) => {
    const { id, version } = fm(record);
    const wanted = awaitingOf(rows, record);
    const states = orderedStates(rows, record).filter(({ state }) => wanted.includes(state));
    const whole = Object.hasOwn(labels.kindNames, fm(record).kind);
    const row = ({ state, verdict }) => [
      `<li class="pstate" data-state="${escaped(state)}" data-current="${escaped(verdict.current)}">`,
      `<a class="pick" href="${escaped(id)}.html${whole ? "" : `#${escaped(tabId(state))}`}">${escaped(whole ? labels.whole : stateNameOf(labels, state))}</a>`,
      `<span class="choose"><button type="button" class="verdict" data-verdict="ok" aria-pressed="false">${labels.ok}</button><button type="button" class="verdict" data-verdict="revise" aria-pressed="false">${labels.revise}</button></span>`,
      verdict.comment ? `<p class="said">${escaped(verdict.comment)}</p>` : "",
      `<textarea class="comment" rows="2" placeholder="${escaped(labels.comment)}" aria-label="${escaped(labels.comment)}" hidden></textarea>`,
      "</li>",
    ].join("");
    return `<details class="item" data-record="${escaped(id)}" data-version="${escaped(String(version))}"${id === current ? " open data-here" : ""}><summary><span>${escaped(titleOf(project, record, labels))}</span><span class="done">${settledOf(states)}/${states.length}</span></summary><ol>${states.map(row).join("")}</ol></details>`;
  };
  const shown = held.reduce((sum, each) => sum + each.awaiting.length, 0);
  const group = (each) => `<details class="step-group" data-step="${each.step}"${each.step === here || shown <= FEW_ITEMS ? " open" : ""}><summary><span class="step-name">${labels.stepNames[each.step]}</span><span class="step-count">(${each.awaiting.length})</span><button type="button" class="step-ok" data-step="${each.step}">${labels.allOk}</button></summary>${each.awaiting.map(item).join("\n")}</details>`;
  const vote = ([verdict, label]) => `<button type="button" class="vote" data-verdict="${verdict}" aria-pressed="false">${label}</button>`;
  const choice = (set) => {
    const row = (variant) => `<li class="pvariant" data-variant="${escaped(variant.name)}"><span class="pick">${escaped(variant.name)}</span><span class="choose">${[["keep", labels.keep], ["revise", labels.revise], ["discard", labels.discard]].map(vote).join("")}</span><textarea class="comment" rows="2" placeholder="${escaped(labels.comment)}" aria-label="${escaped(labels.comment)}" hidden></textarea></li>`;
    return `<details class="choice" data-set="${escaped(set.id)}" data-fingerprint="${escaped(set.fingerprint)}" open><summary><span>${escaped(set.id)}</span><span class="picked" data-axes="${set.axes.length}" data-label="${escaped(labels.picks)}" hidden></span><span class="done" data-label="${escaped(labels.decided)}">0/${variants.latestOf(set.variants).length} ${escaped(labels.decided)}</span></summary><ol>${variants.latestOf(set.variants).map(row).join("")}</ol></details>`;
  };
  const open = sets.filter((set) => !set.problems.length);
  const choices = open.length ? `<section class="choices" data-group="choose"><h3>${labels.choose}</h3>${open.map(choice).join("")}</section>` : "";
  const groups = held.filter((each) => each.awaiting.length).map(group).join("\n");
  const tally = pendingOf(labels, held.reduce((sum, each) => sum + each.todo, 0));
  return [
    '<div class="scrim" id="scrim"></div>',
    `<aside class="drawer" id="review" aria-label="${escaped(labels.review)}" hidden>`,
    `<div class="drawer-head"><h2>${labels.review}</h2>${tally}<button type="button" class="close" id="close-review" aria-label="${escaped(labels.close)}">&times;</button></div>`,
    `<div class="drawer-body">${choices}${groups || (choices ? "" : `<p>${labels.nothing}</p>`)}</div>`,
    `<div class="drawer-foot"><p id="note" role="status"></p><button type="button" id="clear" hidden>${labels.clear}</button><button type="button" id="copy" data-copied="${escaped(labels.copied)}" data-blocked="${escaped(labels.blocked)}" data-hint="${escaped(labels.copyHint)}">${labels.copy}</button></div>`,
    "</aside>",
  ].join("\n");
}

const TITLE_LINE = /^# +(.+?)\s*$/;

/** The record's text without its front matter, as lines. */
function bodyLines(project, record) {
  const lines = (text(project, record.file) ?? "").split(LINE_BREAK);
  return lines.slice(frontMatterEnd(lines) + 1);
}

/** The title a page shows for a record: the brand and the system by the name of their kind in the language of `labels`,
 * any other by the first `# ` heading of its text, else its id. */
const titleOf = (project, record, labels) => (labels && Object.hasOwn(labels.kindNames, fm(record).kind) ? labels.kindNames[fm(record).kind] : bodyLines(project, record).map((line) => TITLE_LINE.exec(line)?.[1]).find(Boolean) ?? fm(record).id);

/** The `## ` sections a page already shows in its own shape, so its text leaves them out. */
const SHOWN_SECTIONS = { journey: [PERSONA_SECTION, STEPS_SECTION], system: [BREAKPOINTS_SECTION] };
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
function specLines(project, record) {
  const shown = SHOWN_SECTIONS[fm(record).kind] ?? [];
  const lines = bodyLines(project, record);
  const title = lines.findIndex((line) => TITLE_LINE.test(line));
  const description = descriptionAt(lines);
  let skipping = false;
  return lines.filter((line, at) => {
    if (at === title || (description && at >= description.start && at < description.end)) return false;
    const section = SECTION_LINE.exec(line);
    if (section) skipping = shown.includes(section[1]);
    return !skipping;
  });
}

/** The record as html under its title: its `specLines`, their headings named in the language. */
function specOf(project, record, labels) {
  const kept = specLines(project, record);
  const named = kept.map((line) => line.replace(SECTION_LINE, (whole, name) => (Object.hasOwn(labels.sections, name) ? `## ${labels.sections[name]}` : whole)));
  return documentOf(named.join(LINE_BREAK));
}

/** The heading of a record's page: its group, its title, its status and version under the title, clear of the
 * review button at the top right, then its description, a journey's persona, its route and code. */
const headOf = ({ record, title, description, persona, labels }) => `<header class="head"><p class="crumb">${labels.stepNames[stepOf(record)]}</p><h1>${escaped(title)}</h1>${stampOf(record, labels)}${description ? `<p class="lede">${escaped(description)}</p>` : ""}${persona}${chipsOf(record)}</header>`;

/** The home page: how many steps are done, what awaits review by step, then the records to rework. Links and
 * counts only, no card: what to open next is a list, not a gallery. */
/** The first thing to open of a step: the first record awaiting review, else its first record, else its first set. */
const firstOf = (each) => each.awaiting[0] ?? [...each.records].sort(byRecordId)[0] ?? null;
const hrefOf = (each) => {
  const record = firstOf(each);
  if (record) return `${fm(record).id}.html`;
  return each.sets.length ? variants.setFileOf(each.sets[0].id) : null;
};

/** The five steps as a stepper in order, each a link to the first thing to open, with its state in words. */
function stepperOf(held, labels) {
  const item = (each, at) => {
    const state = each.todo ? "todo" : each.records.length || each.sets.length ? "done" : "empty";
    const word = each.todo ? filled(labels.toReview, { count: each.todo }) : state === "done" ? labels.stepDone : labels.stepEmpty;
    const href = hrefOf(each);
    const inner = `<span class="no">${at + 1}</span><span class="name">${labels.stepNames[each.step]}</span><span class="state">${escaped(word)}</span>`;
    return `<li data-step="${each.step}" data-state="${state}">${href ? `<a href="${escaped(href)}">${inner}</a>` : `<span class="cell">${inner}</span>`}</li>`;
  };
  return `<ol class="stepper">${held.map(item).join("")}</ol>`;
}

/** The line that says what awaits review, with the way in: a primary link to the first step that has work. */
function reviewLineOf(held, labels) {
  const waiting = held.filter((each) => each.todo);
  if (!waiting.length) return `<p class="lede">${labels.nothing}</p>`;
  const text = filled(labels.overviewNext, { count: waiting.reduce((sum, each) => sum + each.todo, 0), steps: waiting.map((each) => labels.stepNames[each.step]).join(", ") });
  return `<p class="lede">${escaped(text)}</p><p class="start-row"><a class="start" href="${escaped(hrefOf(waiting[0]))}">${labels.start}</a></p>`;
}

function overviewOf({ project, held, records, rows, labels }) {
  const progressOf = (record) => {
    const states = orderedStates(rows, record);
    return `<span class="progress" data-record="${escaped(fm(record).id)}" data-base="${settledOf(states)}" data-total="${states.length}">${settledOf(states)}/${states.length}</span>`;
  };
  const entry = (record) => `<li data-id="${escaped(fm(record).id)}"><a href="${escaped(fm(record).id)}.html">${escaped(titleOf(project, record, labels))}</a>${progressOf(record)}</li>`;
  const setEntry = (set) => `<li data-set="${escaped(set.id)}"><a href="${escaped(variants.setFileOf(set.id))}">${escaped(set.id)}</a></li>`;
  const stepBlock = (each) => {
    const body = each.step === "components"
      ? CATEGORIES.flatMap((category) => {
        const inCategory = each.awaiting.filter((record) => categoryOf(record) === category);
        return inCategory.length ? [`<h4 data-category="${category}">${labels.categories[category]}</h4><ul>${inCategory.map(entry).join("")}</ul>`] : [];
      }).join("")
      : `<ul>${each.awaiting.map(entry).join("")}</ul>`;
    const open = each.open.length ? `<ul>${each.open.map(setEntry).join("")}</ul>` : "";
    return `<section class="todo-step" data-step="${each.step}"><h3>${labels.stepNames[each.step]}<span>${each.todo}</span></h3>${each.awaiting.length ? body : ""}${open}</section>`;
  };
  const todo = held.reduce((sum, each) => sum + each.todo, 0);
  const reworked = records.filter((record) => hasRender(project, record) && orderedStates(rows, record).some(({ verdict }) => verdict.current === "revise"));
  return [
    stepperOf(held, labels),
    todo
      ? `<section class="overview" data-overview="todo"><h2>${escaped(filled(labels.overviewTodo, { count: todo }))}</h2>${held.filter((each) => each.todo).map(stepBlock).join("")}</section>`
      : `<section class="overview" data-overview="todo"><p class="none">${labels.nothing}</p></section>`,
    reworked.length ? `<section class="overview" data-overview="revise"><h2>${escaped(filled(labels.overviewRevise, { count: reworked.length }))}</h2><ul>${reworked.sort(byRecordId).map(entry).join("")}</ul></section>` : "",
  ].filter(Boolean).join("\n");
}

/** The script of the navigation sheet a narrow page opens from its top bar: Escape closes it and gives the focus back to the button. */
const NAVIGATION = `
const navToggle = document.getElementById("nav-toggle");
function sheet(on) {
  navToggle.setAttribute("aria-expanded", String(on));
  navToggle.closest("nav").toggleAttribute("data-open", on);
}
const here = [...document.querySelectorAll("nav .sub a")].filter((link) => link.pathname === location.pathname);
if (here.length && "IntersectionObserver" in window) {
  const byId = new Map(here.map((link) => [link.hash.slice(1), link]));
  const observer = new IntersectionObserver((seen) => {
    for (const each of seen) {
      if (!each.isIntersecting) continue;
      here.forEach((link) => link.removeAttribute("aria-current"));
      byId.get(each.target.id).setAttribute("aria-current", "location");
    }
  }, { rootMargin: "0px 0px -70% 0px" });
  document.querySelectorAll("main section[id]").forEach((section) => { if (byId.has(section.id)) observer.observe(section); });
}
if (navToggle) {
  navToggle.addEventListener("click", () => sheet(navToggle.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || navToggle.getAttribute("aria-expanded") !== "true") return;
    sheet(false);
    navToggle.focus();
  });
}
`;

const pageOf = ({ title, lang, navigation, body, drawer, script, wide }) => ["<!doctype html>", `<html lang="${lang}">`, "<head>", '<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">', `<title>${escaped(title)}</title>`, `<style>${SHELL}${variants.STYLE}${CHARTE_STYLE}</style>`, "</head>", "<body>", '<div class="shell">', navigation, wide ? '<main class="wide">' : "<main>", body, "</main>", "</div>", drawer, `<script>${script}${NAVIGATION}</script>`, "</body>", "</html>", ""].join("\n");

/** The pages of the showcase by file name: `index.html`, one page per record that is not a review and one per set of variants.
 * `problems` are the engine's, `tokens` the stylesheet text or null, `captures` the png paths beside
 * the records, relative to the design system folder. */
function showcaseOf({ project, problems, tokens, captures, lang, sets = [] }) {
  const language = languageOf(lang);
  const labels = LABELS[language];
  const records = placed(project).filter((record) => fm(record).kind !== REVIEW_KIND && fm(record).id);
  const recordsById = new Map();
  for (const record of records) if (!recordsById.has(fm(record).id)) recordsById.set(fm(record).id, record);
  const rows = verdictRows(placed(project));
  const journeys = records.filter((record) => fm(record).kind === "journey");
  const system = project.records.find((record) => fm(record).kind === "system");
  const held = stepsOf({ project, records, rows, sets });
  const sectionsOf = (record) => {
    if (fm(record).kind === "brand") return identitySectionsOf(specLines(project, record), labels);
    if (fm(record).kind !== SYSTEM_ID) return null;
    const notes = specLines(project, record).some((line) => line.trim()) ? specOf(project, record, labels) : "";
    return charteSectionsOf({ entries: tokens === null ? [] : catalog(project), values: resolvedValues(project).get(BASE_CONTEXT) ?? new Map(), citations: citations(project), primitives: list(fm(record).primitives), rows: breakpointRows(record), notes, tokens, labels, language });
  };
  const sectionsById = new Map(records.flatMap((record) => { const own = sectionsOf(record); return own ? [[fm(record).id, own]] : []; }));
  const drawer = (current) => drawerOf({ project, held, here: hereOf(held, records, sets, current), rows, labels, current, sets });
  const home = [`<header class="head"><h1>${labels.title}</h1>${reviewLineOf(held, labels)}</header>`, overviewOf({ project, held, records, rows, labels })].join("\n");
  const pages = { "index.html": pageOf({ title: labels.title, lang: language, navigation: navigationOf(project, records, labels, null, sets, rows, sectionsById), body: home, drawer: drawer(null), script: PANEL }) };
  for (const record of records) {
    const id = fm(record).id;
    const uses = [...new Set(cited(record))].filter((each) => each !== id && recordsById.has(each)).sort(byCode);
    const usedBy = records.filter((other) => fm(other).id !== id && cited(other).includes(id)).map((other) => fm(other).id).sort(byCode);
    const reviewed = hasRender(project, record);
    const title = titleOf(project, record, labels);
    const journey = fm(record).kind === "journey";
    const bars = barsOf({ project, record, journeys, recordsById, labels });
    const body = [
      headOf({ record, title, description: descriptionOf(project, record), persona: journey ? personaOf(record, labels) : "", labels }),
      ...bars,
      journey ? "" : linksOf("uses", labels.uses, uses, (each) => titleOf(project, recordsById.get(each), labels)),
      journey ? journeyOf({ project, record, recordsById, tokens, labels }) : "",
      reviewed ? reviewOf({ project, system, record, rows, tokens, captures, labels }) : "",
      sectionsById.has(id) ? sectionsById.get(id).map(sectionHtml).join("\n") : specOf(project, record, labels),
      appearsOf({ project, ids: usedBy, recordsById, labels }),
      checksOf(problems, record, labels),
    ].filter(Boolean).join("\n");
    const script = (reviewed ? FRAMES + PANEL + TABS : id === SYSTEM_ID ? FRAMES + PANEL : PANEL) + (bars.length ? JOURNEY_BARS : "");
    pages[`${id}.html`] = pageOf({ title, lang: language, navigation: navigationOf(project, records, labels, id, sets, rows, sectionsById), body, drawer: drawer(id), script, wide: journey });
  }
  const wireframes = project.renders.filter((file) => file.startsWith(WIREFRAMES_DIR)).sort().slice(0, WIREFRAMES_SHOWN).map((file) => {
    const record = records.find((candidate) => renderOf(candidate) === file);
    return { path: file.slice(WIREFRAMES_DIR.length), title: record ? titleOf(project, record) : undefined, text: text(project, file) ?? "" };
  });
  for (const set of sets) {
    pages[variants.setFileOf(set.id)] = pageOf({ title: set.id, lang: language, navigation: navigationOf(project, records, labels, `${SET_CURRENT}${set.id}`, sets, rows, sectionsById), body: variants.setBodyOf({ set, tokens, labels, wireframes }), drawer: drawer(null), script: variants.SCRIPT + PANEL, wide: true });
  }
  return pages;
}

module.exports = { showcaseOf, copiedOf, keptOf, entriesOf, blockedOf, remainingOf, pickedOf, languageOf, LABELS };
