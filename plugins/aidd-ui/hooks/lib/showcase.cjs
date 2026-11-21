// The showcase: one static page per record of the design system and a home page, rendered from
// the project, the tokens stylesheet and the captures already read; the engine's checks stay with validate. Pure:
// the command reads the files and writes the pages. Each page holds the review of its record,
// handed back as one copy.
const path = require("node:path");
const { list, table, frontMatterEnd, LINE_BREAK } = require("./markdown.cjs");
const { placed, fm, BREAKPOINTS_SECTION, breakpointRows, STEPS_SECTION, PERSONA_SECTION, verdictRows, stateVerdict, reviewStatesOf, REVIEW_KIND, SYSTEM_ID, isElement } = require("./model.cjs");
const { renderOf } = require("./renders.cjs");
const { cited } = require("./graph.cjs");
const { parseLink } = require("./code.cjs");
const { text, UI_DIR } = require("./project.cjs");
const { escaped, documentOf, inlined, STYLESHEET_LINK } = require("./html.cjs");
const { catalog, citations, resolvedValues } = require("./tokens.cjs");
const { charteOf } = require("./charte.cjs");
const { charteSectionsOf, identitySectionsOf, columnsNamed, sectionHtml, subNavigationOf, CHARTE_STYLE } = require("./charte-page.cjs");
const variants = require("./variants.cjs");
const { STEPS, CATEGORIES, stepOf, categoryOf, setStepOf, awaitingOf } = require("./steps.cjs");

const WIREFRAMES_DIR = `${UI_DIR}/wireframes/`; // the screens a set of variants is shown on
const WIREFRAMES_SHOWN = 2;

const DEFAULT_LANGUAGE = "en";
const UNRESOLVED = ["none", "pending"]; // a state still to review
const BASE_CONTEXT = ""; // the key of `resolvedValues` for the base
const FEW_ITEMS = 3; // a drawer holding this many records or fewer opens every group
const SET_CURRENT = "set:"; // what a page of a set passes the navigation as its current page
const AGREE_MARK = "\u25CF"; // the mark of a step that only awaits the agreement of the assistant
const JOURNEY_PREFIX = "_journey-"; // so a journey named like another record never takes that record's page name
/** The file of a record's page: ids are unique per kind, so a journey is told apart by its prefix. Every link to a page goes through it,
 * but two that can only name a record that is no journey and so write `<id>.html` by hand: the next record of the verdict bar (the page
 * script) and the anchors under the brand and the system (`charte-page.cjs`). */
const pageName = (kind, id) => `${kind === "journey" ? JOURNEY_PREFIX : ""}${id}.html`;

/** The words of the page chrome, one table per language: the same keys in each. */
const LABELS = {
  en: {
    title: "Showcase",
    choose: "Variants",
    checks: "Checks",
    kindNames: { brand: "Brand identity", system: "Design system" },
    whole: "Whole",
    stepNames: { journeys: "Journeys", identity: "Identity", foundations: "Foundations", components: "Elements", screens: "Screens" },
    categories: { input: "Input", action: "Actions", display: "Display", navigation: "Navigation", group: "Groups", asset: "Assets" },
    outOfJourney: "Out of journey",
    wireframe: "Wireframe",
    twin: "View",
    width: "Width",
    desktop: "Desktop",
    phone: "Phone",
    toReview: "{count} to review",
    toCopy: "{count} to copy",
    decisions: "My decisions",
    proposedCount: "{count} awaiting your agreement",
    agreeInChat: "Agree with the assistant in the conversation.",
    stepDone: "complete",
    stepEmpty: "no content",
    decided: "chosen",
    picks: "axes picked",
    pickedFrom: "taken from {variant}",
    round: "Round {round}",
    changed: "Changed from {parent}",
    mobile: "Mobile",
    same: "Same in all: {sections}",
    full: "Full text",
    sample: "Sample button",
    specimenHeading: "Heading",
    specimenBody: "A line of text to judge the letters.",
    identical: "same",
    take: "Take",
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
    myReview: "My review",
    ok: "OK",
    revise: "Revise",
    comment: "What should change?",
    outdated: "outdated, v{version}",
    noCapture: "No capture of the app yet",
    noAssetFile: "No file yet",
    capture: "Capture of {state}",
    copy: "Finish and copy",
    copied: "Copied",
    clear: "Clear",
    allOk: "All OK",
    confirmAll: "Confirm {count} states?",
    confirmAllOne: "Confirm 1 state?",
    cancel: "Cancel",
    reviewed: "{done}/{total} states reviewed",
    nextState: "Next state \u2192",
    nextRecord: "Next item \u2192",
    backToOverview: "Back to the overview \u2192",
    close: "Close",
    nothing: "Nothing to review.",
    overviewNext: "{count} to review, in {steps}.",
    overviewAgree: "{count} awaiting your agreement, in {steps}.",
    overviewProposed: "Nothing to review here. {count} awaiting your agreement, in {steps}. Agree with the assistant in the conversation.",
    start: "Start the review",
    toReviewMark: "To review",
    toReworkMark: "To rework",
    awaitingAgreement: "Awaiting your agreement",
    variantsToChoose: "Variants to choose",
    stepsCount: "{count} steps",
    sketchesCount: "Wireframes ({count})",
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
    themeNames: {},
    columns: {},
    noRender: "No render",
    statuses: { proposed: "proposed", validated: "validated", deprecated: "deprecated" },
    stepOf: "Step {at} of {count}",
    previousStep: "Previous step",
    nextStep: "Next step",
  },
  fr: {
    title: "La vitrine",
    choose: "Variantes",
    checks: "V\u00e9rifications",
    kindNames: { brand: "Identité visuelle", system: "Charte graphique" },
    whole: "L'ensemble",
    stepNames: { journeys: "Parcours", identity: "Identité", foundations: "Charte", components: "Éléments", screens: "Écrans" },
    categories: { input: "Saisie", action: "Actions", display: "Affichage", navigation: "Navigation", group: "Ensembles", asset: "Ressources" },
    outOfJourney: "Hors parcours",
    wireframe: "Maquette",
    twin: "Vue",
    width: "Largeur",
    desktop: "Ordinateur",
    phone: "Téléphone",
    toReview: "{count} à relire",
    toCopy: "{count} à copier",
    decisions: "Mes décisions",
    proposedCount: "{count} en attente de votre accord",
    agreeInChat: "À valider avec l'assistant dans la conversation.",
    stepDone: "terminé",
    stepEmpty: "vide",
    decided: "choisies",
    picks: "axes pris",
    pickedFrom: "pris de {variant}",
    round: "Tour {round}",
    changed: "Changé depuis {parent}",
    mobile: "Mobile",
    same: "Identique dans toutes : {sections}",
    full: "Texte complet de la piste",
    sample: "Exemple de bouton",
    specimenHeading: "Titre",
    specimenBody: "Une ligne de texte pour juger les lettres.",
    identical: "identique",
    take: "Prendre",
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
    myReview: "Ma revue",
    ok: "OK",
    revise: "À revoir",
    comment: "Que faut-il changer ?",
    outdated: "obsolète, v{version}",
    noCapture: "Pas encore de capture de l'app",
    noAssetFile: "Pas encore de fichier",
    capture: "Capture de {state}",
    copy: "Terminer et copier",
    copied: "Copié",
    clear: "Effacer",
    allOk: "Tout OK",
    confirmAll: "Valider les {count} \u00e9tats\u202f?",
    confirmAllOne: "Valider 1 \u00e9tat\u202f?",
    cancel: "Annuler",
    reviewed: "{done}/{total} \u00e9tats revus",
    nextState: "\u00c9tat suivant \u2192",
    nextRecord: "\u00c9l\u00e9ment suivant \u2192",
    backToOverview: "Retour \u00e0 l'aper\u00e7u \u2192",
    close: "Fermer",
    nothing: "Rien à relire.",
    overviewNext: "{count} à relire, dans {steps}.",
    overviewAgree: "{count} en attente de votre accord, dans {steps}.",
    overviewProposed: "Rien à relire ici. {count} en attente de votre accord, dans {steps}. À valider avec l'assistant dans la conversation.",
    start: "Commencer la revue",
    toReviewMark: "À relire",
    toReworkMark: "À reprendre",
    awaitingAgreement: "En attente de votre accord",
    variantsToChoose: "Variantes à choisir",
    stepsCount: "{count} étapes",
    sketchesCount: "Maquettes ({count})",
    blocked: "Écrivez ce qu'il faut changer sur chaque état à revoir.",
    copyHint: "Donnez un avis sur au moins un état.",
    theme: "Thème",
    themeNames: { light: "clair", dark: "sombre" },
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
    stateNames: { default: "par défaut", empty: "vide", loading: "chargement", error: "erreur", hover: "survol", focus: "focus clavier", disabled: "désactivé", pressed: "appuyé", selected: "sélectionné", checked: "coché", "no-rights": "sans droits" },
    columns: { Word: "Mot", Forbidden: "Interdit" },
    sections: { Usage: "Utilisation", Keyboard: "Clavier", Steps: "Étapes", Persona: "Persona", Users: "Utilisateurs", Domain: "Domaine", "Personality and tone": "Personnalité et ton", "Anti-references": "Anti-références", References: "Références", "Imposed charter": "Charte imposée", Breakpoints: "Points de rupture", Project: "Projet", Glossary: "Glossaire" },
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
const chevron = (stroke) => `url("data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23${stroke}' stroke-width='1.5'/%3E%3C/svg%3E")`;
const rowBoards = () => Array.from({ length: ROW_MAX_STEPS - 1 }, (_, at) => {
  const n = at + 2;
  const board = `.board[data-steps="${n}"]`;
  return `@container (min-width: ${n * CARD_MIN + (n - 1) * CARD_GAP}px) { ${board} { display: grid; grid-template-columns: repeat(var(--steps), minmax(0, ${CARD_MAX}px)); column-gap: ${CARD_GAP}px; } ${board} .card { display: flex; flex-direction: column; gap: var(--s2); } ${board} .screen { align-self: stretch; } ${board} .card:not(:first-child)::before { left: auto; right: 100%; top: 0; inline-size: ${CARD_GAP}px; padding-top: 62.5%; background: var(--line-strong); mask: ${ARROW_RIGHT} center / 20px 12px no-repeat; } }`;
}).join("\n");

/** The look of the showcase: a graphite instrument, the project's own design the only saturated thing on screen.
 * One scale for space, type, radius and motion, one set of role tokens in a light and a dark scheme, the system
 * fonts only. The stage behind a render is a mid neutral, so a dark shell does not glare against light renders;
 * a render keeps its own paper in both schemes. Colour is written once, in the tokens. */
const SHELL = `
:root { color-scheme: light;
  --bg: #f7f7f5; --surface: #ffffff; --sunken: #f0f0ed; --stage: #e9e9e5; --stage-dot: #d3d3cd; --line: #e5e5e0; --line-strong: #d3d3cd; --control: #8a8a83;
  --text: #1b1b19; --text-2: #3a3a36; --muted: #55554e; --faint: #6b6b64;
  --accent: #1b1b19; --accent-hover: #33332f; --on-accent: #ffffff; --accent-soft: #ecece8;
  --ok: #166534; --ok-soft: #e7f3ec; --revise: #92400e; --revise-soft: #fbf0e1;
  --focus: #1b1b19; --focus-halo: var(--bg); --scrim: rgba(20, 20, 18, 0.4); --paper: #ffffff; --mask: #000000;
  --shadow-1: 0 1px 2px rgba(20, 20, 18, 0.06);
  --shadow-2: 0 1px 2px rgba(20, 20, 18, 0.06), 0 8px 24px rgba(20, 20, 18, 0.1);
  --shadow-frame: 0 0 0 1px rgba(20, 20, 18, 0.08), 0 12px 32px -8px rgba(20, 20, 18, 0.22);
  --shadow-drawer: -1px 0 0 var(--line), -16px 0 40px -12px rgba(20, 20, 18, 0.18);
  --chevron: ${chevron("55554e")};
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px; --s8: 64px;
  --r1: 4px; --r2: 6px; --r3: 10px; --r-pill: 999px; --drawer: 400px;
  --h-control: 32px; --h-control-lg: 36px; --h-touch: 44px;
  --t-xs: 12px; --t-sm: 13px; --t-md: 14px; --t-lg: 16px; --t-xl: 20px; --t-2xl: 28px;
  --lh-ui: 1.4; --lh-prose: 1.6; --lh-tight: 1.15;
  --d1: 120ms; --d2: 180ms; --d3: 240ms; --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --font: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
@media (prefers-color-scheme: dark) {
  :root { color-scheme: dark;
    --bg: #151514; --surface: #1d1d1b; --sunken: #262623; --stage: #2b2b28; --stage-dot: #3a3a36; --line: #2e2e2b; --line-strong: #3d3d39; --control: #6f6f68;
    --text: #ededea; --text-2: #cfcfca; --muted: #a8a8a0; --faint: #8f8f87;
    --accent: #ededea; --accent-hover: #d4d4ce; --on-accent: #151514; --accent-soft: #2a2a27;
    --ok: #6cc48b; --ok-soft: #16271c; --revise: #e3a75f; --revise-soft: #2c2114;
    --focus: #ededea; --scrim: rgba(0, 0, 0, 0.6);
    --shadow-1: 0 0 0 1px var(--line);
    --shadow-2: 0 0 0 1px var(--line-strong), 0 12px 32px rgba(0, 0, 0, 0.5);
    --shadow-frame: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 16px 40px -8px rgba(0, 0, 0, 0.6);
    --shadow-drawer: -1px 0 0 var(--line), -16px 0 40px -12px rgba(0, 0, 0, 0.6);
    --chevron: ${chevron("a8a8a0")}; } }
@media (prefers-reduced-motion: reduce) { *, ::before, ::after { transition-duration: .01ms !important; animation-duration: .01ms !important; scroll-behavior: auto !important; } }
* { box-sizing: border-box; }
[hidden]:not(.drawer) { display: none !important; }
body { margin: 0; background: var(--bg); color: var(--text); font: var(--t-md)/var(--lh-ui) var(--font); font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
a { color: var(--text); text-decoration: none; }
a:hover { text-decoration: underline; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; box-shadow: 0 0 0 4px var(--focus-halo); }
.choose :focus-visible, .tabs :focus-visible, .twin :focus-visible, .compare :focus-visible { outline-offset: -2px; box-shadow: none; }
code { font: var(--t-sm) var(--mono); background: var(--sunken); border-radius: var(--r1); padding: 1px 5px; }
button { font: 500 var(--t-sm)/1 var(--font); color: var(--text); background: var(--surface); border: 1px solid var(--control); border-radius: var(--r2); height: var(--h-control); padding: 0 var(--s3); cursor: pointer; transition: background-color var(--d1) var(--ease), border-color var(--d1) var(--ease), color var(--d1) var(--ease); }
button:hover { background: var(--sunken); }
button:disabled { background: var(--sunken); border-color: var(--line); color: var(--muted); cursor: default; }
#copy { height: var(--h-control-lg); background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
#copy:hover:not(:disabled) { background: var(--accent-hover); }
#copy:disabled { background: var(--sunken); border-color: var(--line); color: var(--muted); }
select { appearance: none; font: inherit; font-size: var(--t-sm); color: var(--text); background: var(--surface) var(--chevron) right 8px center / 10px no-repeat; border: 1px solid var(--control); border-radius: var(--r2); height: var(--h-control); padding: 0 var(--s5) 0 var(--s2); }
.shell { display: grid; grid-template-columns: 248px minmax(0, 1fr); min-height: 100vh; }
.shell > nav { position: sticky; top: 0; height: 100vh; overflow: hidden; display: flex; flex-direction: column; background: var(--surface); border-right: 1px solid var(--line); padding: var(--s4); }
.nav-scroll { flex: 1; min-height: 0; overflow: auto; padding-block: var(--s4); margin-block: calc(var(--s4) * -1); mask-image: linear-gradient(to bottom, transparent, var(--mask) var(--s4), var(--mask) calc(100% - var(--s4)), transparent); }
.nav-bar { display: none; }
.shell > main { min-width: 0; padding: var(--s6) var(--s7); display: flex; flex-direction: column; gap: var(--s5); max-width: 1320px; }
.shell > main.wide { max-width: none; }
main, main.wide { padding-bottom: calc(var(--s5) + var(--h-touch) + var(--s6)); }
nav .brand { display: flex; align-items: center; gap: var(--s1); padding: var(--s1) 0 var(--s4); font-size: var(--t-sm); font-weight: 600; }
nav .brand-mark { inline-size: 20px; block-size: 20px; border-radius: var(--r1); background: var(--text); flex: none; }
nav .home { margin: 0; }
nav .steps { list-style: none; margin: var(--s3) 0 var(--s4); padding: 0; }
nav .steps > li { display: block; }
nav summary { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: var(--s2); padding: 6px var(--s2) 6px var(--s5); background: var(--surface); cursor: pointer; font-size: var(--t-md); font-weight: 600; border-radius: var(--r2); list-style: none; }
nav summary::-webkit-details-marker { display: none; }
nav summary:hover { background: var(--bg); }
nav .stepno { position: absolute; left: 0; inline-size: 20px; block-size: 20px; border-radius: var(--r-pill); background: var(--sunken); color: var(--muted); font-size: var(--t-xs); text-align: center; line-height: 20px; }
nav .steps > li:has([aria-current="page"]) .stepno { background: var(--accent); color: var(--on-accent); }
nav .step-name { flex: 1; }
nav summary a.step-name { padding: 0; font-weight: 600; color: inherit; }
nav .step-mark { color: var(--faint); font-size: var(--t-xs); }
nav .step-mark.agree { color: var(--faint); font-size: 0.6rem; }
nav h2 { font-size: var(--t-xs); font-weight: 500; color: var(--faint); margin: var(--s5) 0 var(--s1); padding-left: var(--s5); }
nav h3 { font-size: var(--t-xs); font-weight: 500; color: var(--faint); margin: var(--s3) 0 var(--s1); padding-left: var(--s5); }
nav ul, .links ul, .appears ul, .drawer ol { list-style: none; margin: 0; padding: 0; }
nav li, nav .home { display: flex; align-items: center; gap: var(--s2); border-radius: var(--r2); }
nav li a, nav .home a { flex: 1; min-width: 0; padding: 6px var(--s2) 6px var(--s5); color: var(--muted); font-size: var(--t-md); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
nav li > a:not([aria-current="page"]):hover, nav .home a:not([aria-current="page"]):hover { background: var(--bg); color: var(--text); }
nav a:hover { text-decoration: none; }
nav li:has(> a[aria-current="page"]), nav .home:has(> a[aria-current="page"]) { background: var(--accent-soft); }
nav a[aria-current="page"] { color: var(--text); font-weight: 500; }
.head { display: flex; flex-direction: column; gap: var(--s2); }
.head > .stamp { display: flex; align-items: center; gap: var(--s2); }
.crumb { margin: 0; font-size: var(--t-sm); font-weight: 500; color: var(--faint); }
.head h1, main > h1 { margin: 0; font-size: var(--t-2xl); line-height: var(--lh-tight); font-weight: 600; letter-spacing: -0.015em; }
.lede { margin: 0; color: var(--text); font-size: var(--t-lg); max-width: 72ch; }
.head .persona { margin: 0; color: var(--text-2); max-width: 72ch; }
.version { color: var(--faint); font-size: var(--t-sm); font-weight: 500; }
.chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--surface); border-radius: var(--r-pill); padding: 0 10px; line-height: 22px; font-size: var(--t-sm); color: var(--text); }
.chip[data-status] { border-color: transparent; background: var(--sunken); color: var(--muted); font-weight: 500; }
.chip[data-status="proposed"]::before { color: var(--revise); }
.chip[data-status="validated"]::before { color: var(--ok); }
.chip[data-status]::before { content: ""; inline-size: 6px; block-size: 6px; border-radius: 50%; background: currentColor; }
.links { display: flex; gap: var(--s3); flex-wrap: wrap; align-items: center; }
.links h2, .bar-top h2, .appears h2 { font-size: var(--t-md); font-weight: 600; margin: 0; }
.links h2 { font-size: var(--t-sm); color: var(--muted); font-weight: 500; min-width: 4rem; }
.links ul { display: flex; gap: 6px; flex-wrap: wrap; }
.links a { display: inline-block; padding: 2px 10px; border-radius: var(--r-pill); background: var(--accent-soft); font-size: var(--t-sm); }
.doc { color: var(--text); max-width: 68ch; }
.doc:empty { display: none; }
.doc h1, .doc h2, .doc h3 { margin: var(--s5) 0 var(--s2); line-height: 1.3; }
.doc h2 { font-size: var(--t-lg); }
.doc h3 { font-size: var(--t-md); }
.doc > :first-child { margin-top: 0; }
.doc > :last-child { margin-bottom: 0; }
.doc p, .doc ul { margin: 0 0 var(--s3); color: var(--text-2); line-height: var(--lh-prose); }
.doc .scroll { overflow-x: auto; }
.doc table { border-collapse: collapse; width: 100%; font-size: var(--t-md); }
.doc th { text-align: left; font-weight: 600; color: var(--muted); border-bottom: 1px solid var(--line-strong); padding: 6px 10px; }
.doc td { border-bottom: 1px solid var(--line); padding: 8px 10px; vertical-align: top; }
.twin { display: flex; inline-size: fit-content; margin: 0 0 var(--s4); padding: 2px; gap: 2px; background: var(--bg); border: 1px solid var(--line); border-radius: var(--r2); font-size: var(--t-md); }
.twin a { padding: var(--s1) var(--s4); border-radius: var(--r1); color: var(--muted); text-decoration: none; }
.twin a[aria-current="page"] { background: var(--surface); color: var(--text); box-shadow: var(--shadow-1); }
.review > .twin { margin: var(--s3) var(--s4) 0; }
.twin button { height: auto; padding: var(--s1) var(--s4); border: 0; border-radius: var(--r1); background: none; color: var(--muted); font: inherit; }
.twin button[aria-pressed="true"] { background: var(--surface); color: var(--text); box-shadow: var(--shadow-1); }
.journey-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2) var(--s5); padding: var(--s3) var(--s4); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r3); font-size: var(--t-md); }
.journey-bar .journey-title { font-weight: 600; }
.journey-bar .where { color: var(--muted); }
.journey-bar .prev, .journey-bar .next { display: inline-flex; flex-direction: column; justify-content: center; gap: 1px; min-width: 0; min-block-size: var(--h-control-lg); }
.journey-bar .next { margin-left: auto; align-items: flex-end; text-align: right; }
.journey-bar small { color: var(--faint); font-size: var(--t-xs); }
.journey { padding: var(--s2) 0 var(--s4); container-type: inline-size; }
.board { list-style: none; margin: 0; padding: 0 0 var(--s4); display: flex; flex-direction: column; gap: var(--s5); }
.board .card { position: relative; display: grid; grid-template-columns: 280px minmax(0, 1fr); grid-template-rows: auto 1fr; column-gap: var(--s4); row-gap: var(--s1); align-items: start; }
.board .card:not(:first-child)::before { content: ""; position: absolute; left: 134px; top: calc(var(--s5) * -1); inline-size: 12px; block-size: var(--s5); background: var(--line-strong); mask: ${ARROW_DOWN} center / contain no-repeat; }
.board .step { display: contents; }
.board .mini { grid-column: 1; grid-row: 1 / span 2; align-self: start; }
.board .screen { grid-column: 2; grid-row: 1; align-self: end; }
.board .action { grid-column: 2; grid-row: 2; }
.step { display: flex; flex-direction: column; gap: var(--s2); color: var(--text); }
.step:hover { text-decoration: none; }
.step:hover .mini { border-color: var(--line-strong); box-shadow: var(--shadow-2); }
.screen { font-size: var(--t-md); font-weight: 600; padding: 0 2px; }
.action { display: flex; gap: var(--s2); margin: 0; font-size: var(--t-md); line-height: 1.45; color: var(--text-2); }
.num { flex: none; display: grid; place-content: center; inline-size: 20px; block-size: 20px; border-radius: 50%; background: var(--accent); color: var(--on-accent); font-size: var(--t-xs); font-weight: 600; line-height: 1; }
.mini { position: relative; display: block; overflow: hidden; inline-size: 100%; aspect-ratio: 8 / 5; border: 1px solid var(--line); border-radius: var(--r2); background: var(--paper); box-shadow: var(--shadow-1); transition: border-color var(--d1) var(--ease), box-shadow var(--d1) var(--ease); }
.mini iframe { position: absolute; top: 0; left: 0; inline-size: 400%; block-size: 400%; border: 0; transform: scale(0.25); transform-origin: 0 0; pointer-events: none; }
.mini.empty { display: grid; place-content: center; border-style: dashed; border-color: var(--line-strong); box-shadow: none; background: var(--sunken); color: var(--muted); font-size: var(--t-sm); }
.review { display: flex; flex-direction: column; gap: 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r3); overflow: clip; }
.bar-top { display: flex; gap: var(--s3); align-items: center; flex-wrap: wrap; padding: var(--s2) var(--s4); border: 0; }
.bar-top h2 { font-size: var(--t-sm); color: var(--muted); }
.toolbar { display: flex; gap: var(--s2) var(--s3); align-items: center; flex-wrap: wrap; padding: var(--s2) var(--s4); border-bottom: 1px solid var(--line); background: var(--surface); }
.review fieldset { border: 0; display: flex; gap: var(--s2); align-items: center; padding: 0; margin: 0; }
legend { float: left; margin-right: var(--s2); font-size: var(--t-sm); font-weight: 600; color: var(--muted); }
label { font-size: var(--t-sm); color: var(--muted); }
#sides[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); color: var(--text); }
.tabs { display: flex; gap: var(--s1); padding: 0 var(--s4); border-bottom: 1px solid var(--line); overflow-x: auto; }
.tab { display: inline-flex; align-items: center; gap: var(--s2); height: 40px; white-space: nowrap; flex: none; padding: 0 var(--s3); border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent; color: var(--muted); font: 500 var(--t-sm)/1 var(--font); transition: color var(--d2) var(--ease), border-color var(--d2) var(--ease); }
.tab:hover { background: transparent; color: var(--text); }
.tab[aria-selected="true"] { color: var(--text); border-bottom-color: var(--accent); }
.tab .dot { inline-size: 8px; block-size: 8px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--faint); }
.tab[data-current="ok"] .dot { background: var(--ok); box-shadow: none; }
.tab[data-current="revise"] .dot { background: var(--revise); box-shadow: none; }
.tab[data-current="pending"] .dot { box-shadow: inset 0 0 0 1.5px var(--revise); }
.tab[data-choice="ok"] .dot { background: var(--ok); box-shadow: none; }
.tab[data-choice="revise"] .dot { background: var(--revise); box-shadow: none; }
.state { display: flex; flex-direction: column; }
.state-bar { display: flex; gap: var(--s3); align-items: center; flex-wrap: wrap; padding: var(--s3) var(--s5); }
.outdated, .said { margin: 0; font-size: var(--t-sm); color: var(--muted); }
.outdated { padding: 0 var(--s2); border-radius: var(--r-pill); background: var(--sunken); line-height: 20px; }
.said { padding-left: var(--s2); border-left: 2px solid var(--revise); }
.choose { display: inline-flex; margin-left: auto; padding: 2px; gap: 2px; background: var(--sunken); border-radius: var(--r2); }
.choose .verdict { height: 28px; padding: 0 var(--s3); border: 0; background: transparent; color: var(--muted); font-size: var(--t-xs); }
.choose .verdict:hover { color: var(--text); }
.verdict[data-verdict="ok"][aria-pressed="true"] { background: var(--surface); color: var(--ok); }
.verdict[data-verdict="revise"][aria-pressed="true"] { background: var(--surface); color: var(--revise); }
.column-head .choose { display: flex; margin-left: 0; }
.choose .colvote { flex: 1; height: var(--h-control); padding: 0 var(--s3); border: 0; border-radius: var(--r2); background: transparent; color: var(--muted); font-size: var(--t-xs); cursor: pointer; }
.colvote:hover { color: var(--text); }
.colvote[aria-pressed="true"] { background: var(--surface); color: var(--ok); }
.colvote[data-verdict="keep"][aria-pressed="true"] { background: var(--ok-soft); box-shadow: inset 0 0 0 1.5px var(--ok); color: var(--ok); }
.colvote[data-verdict="revise"][aria-pressed="true"] { background: var(--revise-soft); box-shadow: inset 0 0 0 1.5px var(--revise); color: var(--revise); }
.colvote[data-verdict="discard"][aria-pressed="true"] { background: var(--sunken); color: var(--muted); }
.verdict-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s3); position: sticky; bottom: 0; z-index: 2; padding: var(--s3) var(--s4); background: var(--surface); border-top: 1px solid var(--line); }
.verdict-bar .choose { margin-left: 0; padding: 0; gap: 0; background: transparent; }
.verdict-bar .verdict { height: var(--h-control-lg); padding: 0 var(--s5); border: 1px solid var(--control); border-radius: 0; background: var(--surface); color: var(--text); font-size: var(--t-md); }
.verdict-bar .verdict:first-child { border-radius: var(--r2) 0 0 var(--r2); }
.verdict-bar .verdict:last-child { border-radius: 0 var(--r2) var(--r2) 0; }
.verdict-bar .verdict + .verdict { margin-inline-start: -1px; }
.verdict-bar .verdict:hover { background: var(--sunken); color: var(--text); }
.verdict-bar .verdict[aria-pressed="true"]::before { content: "\\2713\\00a0"; }
.verdict-bar .verdict[data-verdict="revise"][aria-pressed="true"]::before { content: "\\270E\\00a0"; }
.verdict-bar .verdict[data-verdict="ok"][aria-pressed="true"] { position: relative; background: var(--ok-soft); border-color: var(--ok); box-shadow: inset 0 0 0 1px var(--ok); color: var(--ok); }
.verdict-bar .verdict[data-verdict="revise"][aria-pressed="true"] { position: relative; background: var(--revise-soft); border-color: var(--revise); box-shadow: inset 0 0 0 1px var(--revise); color: var(--revise); }
.verdict-bar .reviewed { color: var(--muted); font-size: var(--t-sm); }
.verdict-bar .next-state, .verdict-bar .next-record { display: inline-flex; align-items: center; height: var(--h-control-lg); padding: 0 var(--s4); border-radius: var(--r2); font-size: var(--t-md); font-weight: 500; }
.verdict-bar .next-state { border: 1px solid var(--control); color: var(--text); transition: background-color var(--d1) var(--ease), color var(--d1) var(--ease); }
.verdict-bar:has(.verdict[aria-pressed="true"]) .next-state { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.verdict-bar .next-record { background: var(--accent); color: var(--on-accent); }
.verdict-bar .next-record:hover { background: var(--accent-hover); text-decoration: none; }
.verdict-bar textarea.comment { max-inline-size: 520px; }
textarea.comment, textarea.colcomment { display: block; flex-basis: 100%; inline-size: 100%; font: inherit; font-size: var(--t-md); color: var(--text); background: var(--surface); border: 1px solid var(--control); border-radius: var(--r2); padding: var(--s2) var(--s3); resize: vertical; }
textarea.comment:focus, textarea.colcomment:focus { border-color: var(--accent); }
.pair { display: flex; gap: var(--s5); flex-wrap: wrap; justify-content: center; align-items: center; min-block-size: clamp(280px, 44vh, 560px); padding: var(--s7); background: var(--stage) radial-gradient(var(--stage-dot) 1px, transparent 1.2px) 0 0 / 20px 20px; border-top: 1px solid var(--line); }
.render { display: flex; justify-content: center; gap: var(--s5); flex: 1 1 24rem; min-width: 0; align-items: flex-start; }
.render iframe { box-sizing: content-box; flex: 1; min-width: 0; width: 100%; height: 240px; border: 0; border-radius: var(--r2); box-shadow: var(--shadow-frame); background: var(--paper); }
.state .render iframe[data-platform="mobile"] { flex: 0 0 390px; inline-size: 390px; }
.review[data-width="phone"] .state .render iframe[data-platform="web"] { flex: 0 0 390px; inline-size: 390px; }
.capture { flex: 1 1 24rem; margin: 0; min-width: 0; }
.capture img { display: block; max-width: 100%; margin-inline: auto; border-radius: var(--r2); box-shadow: var(--shadow-frame); }
.asset-image { margin: 0; }
.asset-image img { display: block; max-width: 100%; max-height: 70vh; border-radius: var(--r2); box-shadow: var(--shadow-frame); background: var(--sunken); }
.capture.missing, .asset-image.missing { display: flex; align-items: center; justify-content: center; min-block-size: 160px; border: 1px dashed var(--line-strong); border-radius: var(--r2); background: var(--sunken); color: var(--muted); padding: var(--s4); font-size: var(--t-sm); text-align: center; }
.overview { display: flex; flex-direction: column; gap: var(--s6); margin-top: var(--s5); }
.ov-step h3 { display: flex; align-items: center; gap: var(--s2); margin: 0 0 var(--s3); font-size: var(--t-lg); }
.ov-step h3 span { font-size: var(--t-xs); font-weight: 500; color: var(--muted); background: var(--sunken); border-radius: var(--r-pill); padding: 0 7px; line-height: 18px; }
.ov-step h4 { display: flex; align-items: center; gap: var(--s3); margin: var(--s4) 0 var(--s2); font-size: var(--t-md); font-weight: 600; }
.ov-step h4 .sum { margin-left: auto; color: var(--faint); font-weight: 500; }
.ov-step h4 .bar { flex: none; inline-size: 96px; block-size: 4px; border-radius: var(--r-pill); background: var(--sunken); overflow: hidden; }
.ov-step h4 .bar i { display: block; block-size: 100%; background: var(--ok); transition: inline-size var(--d2) var(--ease); }
.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.rows li { display: flex; align-items: center; gap: var(--s2); min-block-size: 36px; padding: 4px var(--s2); border-bottom: 1px solid var(--line); }
.rows li:hover { background: var(--sunken); }
.rows li a { flex: 1; min-width: 0; }
.ovcards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--s4); }
.ovcards > li { display: block; min-width: 0; }
.ovcards.comps { grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr)); gap: var(--s3); }
.ovcards.journeys { grid-template-columns: repeat(auto-fill, minmax(min(100%, 440px), 1fr)); }
.ov-step, .overview { min-width: 0; }
.ovcard { display: flex; flex-direction: column; gap: var(--s2); block-size: 100%; min-width: 0; padding: var(--s3); border: 1px solid var(--line); border-radius: var(--r3); background: var(--surface); box-shadow: var(--shadow-1); color: var(--text); text-decoration: none; transition: border-color var(--d1) var(--ease), box-shadow var(--d1) var(--ease); }
.ovcard:hover { border-color: var(--line-strong); box-shadow: var(--shadow-2); text-decoration: none; }
.ovcard .title { font-weight: 600; }
.ovcard .meta { display: flex; align-items: center; flex-wrap: wrap; gap: var(--s2); margin-top: auto; color: var(--muted); font-size: var(--t-sm); }
.mark { padding: 0 8px; border-radius: var(--r-pill); font-size: var(--t-xs); font-weight: 600; line-height: 18px; }
.mark.todo { background: var(--revise-soft); color: var(--revise); }
.mark.rework { background: var(--sunken); color: var(--text); }
.thumb { position: relative; display: block; flex: none; overflow: hidden; margin-inline: auto; border: 1px solid var(--line); border-radius: var(--r2); background: var(--paper); box-shadow: var(--shadow-1); }
.thumb.s { --k: 0.22; --w: 390px; --h: 520px; }
.thumb.m { --k: 0.42; --w: 320px; --h: 240px; }
.thumb.l { --k: 0.5; --w: 390px; --h: 520px; }
.thumb { inline-size: calc(var(--w) * var(--k)); block-size: calc(var(--h) * var(--k)); }
.thumb iframe { position: absolute; top: 0; left: 0; inline-size: var(--w); block-size: var(--h); border: 0; transform: scale(var(--k)); transform-origin: 0 0; pointer-events: none; }
.thumb.blank { background: var(--sunken); border: 1px dashed var(--line-strong); box-shadow: none; }
.thumb.sets { display: grid; place-content: center; background: var(--sunken); }
.thumb.sets b { font-size: var(--t-2xl); color: var(--muted); }
.strip { display: flex; gap: var(--s1); overflow-x: auto; padding-bottom: var(--s2); }
.strip .thumb { margin-inline: 0; }
.sketches { margin-top: var(--s4); }
.sketches summary { cursor: pointer; color: var(--muted); }
.sketches .rows { margin-top: var(--s2); }
.palette { display: flex; block-size: 56px; border-radius: var(--r2); overflow: hidden; border: 1px solid var(--line); }
.palette i { flex: 1; }
.stepper { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0; border: 1px solid var(--line); border-radius: var(--r3); background: var(--surface); overflow: clip; }
.stepper li > a, .stepper li > .cell { display: flex; align-items: center; gap: var(--s3); min-block-size: var(--h-touch); padding: var(--s2) var(--s4); border: 0; border-top: 1px solid var(--line); border-radius: 0; background: var(--surface); color: var(--text); text-decoration: none; }
.stepper li:first-child > a, .stepper li:first-child > .cell { border-top: 0; }
.stepper li > a:hover { background: var(--sunken); }
.stepper li[data-state="todo"] > a { box-shadow: inset 0 -2px 0 var(--revise); }
.stepper li[data-state="done"] > a { box-shadow: inset 0 -2px 0 var(--ok); }
.stepper .no { flex: none; inline-size: 24px; block-size: 24px; display: grid; place-items: center; border-radius: var(--r-pill); background: var(--sunken); font-size: var(--t-xs); font-weight: 600; }
.stepper .name { font-weight: 600; }
.stepper .state { margin-left: auto; color: var(--text); font-size: var(--t-sm); font-weight: 600; }
.stepper li[data-state="done"] .state { color: var(--muted); font-weight: 500; }
.stepper li[data-state="empty"] > .cell { color: var(--muted); background: var(--sunken); }
.stepper li[data-state="empty"] .state { color: var(--muted); font-weight: 500; }
.start-row { margin: var(--s3) 0 0; }
.start { display: inline-flex; align-items: center; min-block-size: var(--h-touch); padding: 0 var(--s5); border-radius: var(--r2); background: var(--accent); color: var(--on-accent); font-weight: 600; text-decoration: none; }
.start:hover { background: var(--accent-hover); }
@media (min-width: 900px) { .stepper { flex-direction: row; } .stepper li { flex: 1 1 0; min-width: 0; } .stepper li > a, .stepper li > .cell { flex-direction: column; align-items: flex-start; block-size: 100%; gap: var(--s2); border-top: 0; border-inline-start: 1px solid var(--line); } .stepper li:first-child > a, .stepper li:first-child > .cell { border-inline-start: 0; } .stepper .state { margin-left: 0; } }
.progress { margin-left: auto; color: var(--faint); }
.progress[data-complete="true"] { color: var(--ok); }
.appears { display: flex; flex-direction: column; gap: var(--s3); padding-top: var(--s5); border-top: 1px solid var(--line); }
.appears ul { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0 var(--s5); }
.mini-card { display: flex; flex-direction: row; justify-content: space-between; align-items: center; gap: var(--s3); min-block-size: 36px; padding: var(--s2) 0; color: var(--text); border: 0; border-bottom: 1px solid var(--line); border-radius: 0; background: none; transition: background-color var(--d1) var(--ease); }
.mini-card:hover { text-decoration: none; background: var(--sunken); }
.mini-card b { font-size: var(--t-md); font-weight: 500; }
.mini-card .chip { line-height: 18px; padding: 0 8px; font-size: var(--t-xs); }
.open-review { position: fixed; right: var(--s4); bottom: var(--s4); z-index: 20; display: flex; align-items: center; gap: var(--s3); height: var(--h-touch); padding: 0 var(--s5); border-radius: var(--r-pill); box-shadow: var(--shadow-2); background: var(--accent); border-color: var(--accent); color: var(--on-accent); font-size: var(--t-md); font-weight: 600; }
.open-review:hover { background: var(--accent-hover); }
.open-review .pending { padding: 0 7px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--on-accent) 22%, transparent); color: var(--on-accent); font-size: var(--t-xs); line-height: 18px; }
.open-review[aria-expanded="true"] { display: none; }
.review-foot { flex: none; }
@media (min-width: 769px) { .shell > nav { z-index: 15; } }
.tally { padding: 0 7px; border-radius: var(--r-pill); background: var(--sunken); color: var(--muted); font-size: var(--t-xs); line-height: 18px; }
.scrim { display: none; opacity: 0; transition: opacity var(--d3) var(--ease), display var(--d3) allow-discrete; }
body[data-drawer="open"] .scrim { display: block; opacity: 1; position: fixed; inset: 0; z-index: 25; background: var(--scrim); @starting-style { opacity: 0; } }
@media (min-width: 1680px) {
  .scrim { display: none !important; }
  body[data-drawer="open"] .shell > main { padding-right: calc(var(--s7) + var(--drawer)); max-width: calc(1320px + var(--drawer)); }
}
.drawer { position: fixed; max-inline-size: 100vw; top: 0; right: 0; bottom: 0; z-index: 30; inline-size: var(--drawer); display: flex; flex-direction: column; background: var(--surface); box-shadow: var(--shadow-drawer); transition: transform var(--d3) var(--ease), display var(--d3) allow-discrete; @starting-style { transform: translateX(100%); } }
.drawer[hidden] { display: none; transform: translateX(100%); }
.drawer-head { display: flex; align-items: center; gap: var(--s2); padding: var(--s3) var(--s3) var(--s3) var(--s5); border-bottom: 1px solid var(--line); }
.drawer-head h2 { margin: 0; font-size: var(--t-md); font-weight: 600; }
.drawer-head .close { margin-left: auto; inline-size: var(--h-control); padding: 0; border-color: transparent; background: transparent; color: var(--muted); font-size: var(--t-lg); }
.drawer-body { flex: 1; overflow: auto; padding: var(--s2) 0; }
.drawer-body > p { margin: var(--s4) var(--s5); color: var(--muted); font-size: var(--t-md); }
.decisions { margin: 0 var(--s4) var(--s3); padding: var(--s3); border: 1px solid var(--line); border-radius: var(--r2); background: var(--sunken); }
.decisions h3 { margin: 0 0 var(--s2); font-size: var(--t-sm); font-weight: 600; color: var(--muted); }
.decisions ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s1); font-size: var(--t-md); }
.decisions li[data-verdict="ok"] { color: var(--ok); }
.decisions li[data-verdict="revise"] { color: var(--revise); }
.step-group > summary { position: sticky; top: 0; z-index: 3; display: flex; align-items: center; gap: var(--s2); min-block-size: var(--h-touch); padding: var(--s2) var(--s5); cursor: pointer; font-size: var(--t-md); font-weight: 600; list-style: none; background: var(--surface); border-bottom: 1px solid var(--line); }
.step-group > summary::-webkit-details-marker { display: none; }
.step-group .step-count { color: var(--faint); font-weight: 500; }
.step-group .step-ok { margin-left: auto; height: 28px; background: transparent; border-color: transparent; }
.step-group .step-ok[data-asking] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.step-group .step-cancel { height: 28px; }
.agreeing { padding: var(--s3) var(--s5); border-bottom: 1px solid var(--line); font-size: var(--t-md); }
.agreeing ul { margin: 0 0 var(--s2); padding-left: var(--s4); }
.agreeing .note { margin: 0; color: var(--muted); font-size: var(--t-sm); }
.item { border-bottom: 1px solid var(--line); }
.entry .item + .item { margin-inline-start: var(--s4); border-top: 1px solid var(--line); }
.entry .item + .item summary { font-weight: 500; color: var(--muted); }
.item summary { display: flex; align-items: center; gap: var(--s2); padding: var(--s3) var(--s5); cursor: pointer; font-size: var(--t-md); font-weight: 600; list-style: none; }
.item summary::-webkit-details-marker { display: none; }
.item summary::before { content: ""; flex: none; inline-size: 6px; block-size: 6px; border: solid var(--faint); border-width: 0 1.5px 1.5px 0; transform: rotate(-45deg); transition: transform var(--d2) var(--ease); }
.item[open] summary::before { transform: rotate(45deg); }
.item summary:hover { background: var(--bg); }
.item[data-here] summary { color: var(--text); }
.item .done { margin-left: auto; color: var(--faint); font-weight: 500; font-size: var(--t-xs); }
.item ol { padding: 0 var(--s3) var(--s3); }
.pstate { min-block-size: var(--h-touch); display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); padding: 6px var(--s2); border-radius: var(--r2); }
.pstate.on { background: var(--accent-soft); }
.pstate::before { content: ""; flex: none; inline-size: 8px; block-size: 8px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--faint); }
.pstate[data-current="ok"]::before, .pstate[data-choice="ok"]::before { background: var(--ok); box-shadow: none; }
.pstate[data-current="revise"]::before, .pstate[data-choice="revise"]::before { background: var(--revise); box-shadow: none; }
.pstate .pick { min-width: 0; flex: 1; color: var(--text); font-size: var(--t-md); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pstate .said { flex-basis: 100%; margin-left: var(--s4); font-size: var(--t-xs); }
.drawer-foot { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); padding: var(--s3) var(--s5); border-top: 1px solid var(--line); background: var(--surface); }
.drawer-foot #copy { margin-left: auto; }
#note { flex-basis: 100%; margin: 0; color: var(--revise); font-size: var(--t-sm); }
#note:empty { display: none; }
textarea.out { width: 100%; min-height: 8rem; font: var(--t-sm) var(--mono); border: 1px solid var(--control); border-radius: var(--r2); padding: var(--s2); }
@container (max-width: 527px) { .board .card { grid-template-columns: minmax(0, 1fr); } .board .mini, .board .screen, .board .action { grid-column: 1; grid-row: auto; } .board .card:not(:first-child)::before { left: 12px; } }
${rowBoards()}
@media (max-width: 768px) {
  .tabs { padding-right: var(--s6); scroll-snap-type: x proximity; scroll-padding-inline: var(--s4); mask-image: linear-gradient(to right, black calc(100% - 32px), transparent); }
  .verdict-bar { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); }
  .verdict-bar .choose { grid-column: 1 / -1; }
  .verdict-bar .choose .verdict { flex: 1; }
  .verdict-bar .reviewed { align-self: center; }
  .verdict-bar .next-state, .verdict-bar .next-record { justify-content: center; block-size: var(--h-touch); }
  .shell { display: block; }
  .shell > nav { position: fixed; inset: 0 0 auto 0; z-index: 40; block-size: 56px; flex-direction: row; align-items: center; gap: var(--s3); padding: 0 var(--s4); border-right: 0; border-bottom: 1px solid var(--line); }
  .nav-bar { display: flex; align-items: center; justify-content: space-between; gap: var(--s3); flex: 1; min-width: 0; }
  .nav-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nav-scroll { display: none; }
  .shell > nav[data-open] .nav-scroll { display: block; position: fixed; inset: 56px 0 0 0; padding: var(--s4); margin: 0; background: var(--surface); mask-image: none; transition: transform var(--d2) var(--ease), opacity var(--d2) var(--ease), display var(--d2) allow-discrete; @starting-style { transform: translateY(-8px); opacity: 0; } }
  .nav-scroll .brand { display: none; }
  .review-foot { padding: 0; }
  .open-review { position: static; height: var(--h-control-lg); padding: 0 var(--s4); border-radius: var(--r2); box-shadow: none; font-size: var(--t-sm); }
  .shell > main { padding: calc(56px + var(--s4)) var(--s4) var(--s6); }
  .pair { padding: var(--s4); min-block-size: 200px; }
  .state .render iframe[data-platform="mobile"] { flex: 0 1 390px; min-inline-size: 0; }
  .review[data-width="phone"] .state .render iframe[data-platform="web"] { flex: 0 1 390px; min-inline-size: 0; }
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

/** The script of the width switch of a review: the choice pressed, and set on the review for the style to size its web frames. */
const WIDTH = `
const widthSwitch = document.getElementById("width");
if (widthSwitch) widthSwitch.addEventListener("click", (event) => {
  const choice = event.target.closest("[data-width]");
  if (!choice) return;
  widthSwitch.querySelectorAll("[data-width]").forEach((each) => each.setAttribute("aria-pressed", String(each === choice)));
  widthSwitch.closest(".review").dataset.width = choice.dataset.width;
});
`;

/** The switch between a web render at the width of a desktop and at a phone's, shown only for a system whose first platform is web. */
function widthOf(system, labels) {
  if (!system || list(fm(system).platforms)[0] !== "web") return "";
  return `<div class="twin" id="width" role="group" aria-label="${escaped(labels.width)}"><button type="button" data-width="desktop" aria-pressed="true">${escaped(labels.desktop)}</button><button type="button" data-width="phone" aria-pressed="false">${escaped(labels.phone)}</button></div>`;
}

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
 * the order given, and each set with a variant decided, as fenced JSON: always a list, even of one entry, so
 * what reads it never tells an object from a list. A set keeps its variants all, the undecided as null. Nothing decided copies nothing. Embedded in
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
  return "```json\n" + JSON.stringify(body, null, 2) + "\n```\n";
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

/** What the copy will hold, one line per decided state, per decided variant and per axis picked, from the page's
 * `model` (each record and set with its `title`, each state with its `name`) and its `choices`: what the drawer lists
 * so a verdict given is seen before it is copied. Records come first, then sets, as in the copy. */
function decisionsOf(model, choices) {
  const records = model.records.flatMap((each) => each.states.filter((one) => (choices[each.key] || {})[one.state]).map((one) => {
    const choice = choices[each.key][one.state];
    return { title: each.title, name: one.name, verdict: choice.verdict, comment: choice.comment || "" };
  }));
  const sets = (model.sets || []).flatMap((each) => {
    const own = choices[each.key] || {};
    const labelOf = (name) => (each.labels || {})[name] || name;
    const voted = each.variants.filter((name) => own[name]).map((name) => ({ title: each.title, name: labelOf(name), verdict: own[name].verdict, comment: own[name].comment || "" }));
    const picked = Object.entries(own["@picks"] || {}).map(([axis, variant]) => ({ title: each.title, name: axis, verdict: "pick", comment: "", variant: labelOf(variant) }));
    return voted.concat(picked);
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

/** The next record to review after `id` in the review's `order`: the first, wrapping at the end and never `id` itself,
 * with a state that is neither settled nor given a verdict in `choices`, as `{record, state}` with its first such state;
 * null when none is left. A page the order does not hold starts from its head. */
function nextToReviewOf(order, known, choices, id) {
  const at = order.indexOf(id);
  const after = order.slice(at + 1).concat(order.slice(0, Math.max(at, 0)));
  for (const record of after) {
    const entry = known.find((each) => each.record === record);
    const open = entry && entry.states.find((one) => !one.settled && !(choices[entry.record + "@" + entry.version] || {})[one.state]);
    if (open) return { record, state: open.state };
  }
  return null;
}

/** The next state of a record with no verdict, after `shown` in the order of `states` and wrapping, never `shown`:
 * `states` are `{state, settled}`, `decided` the verdicts given by state. Null when none is left. */
function nextOpenOf(states, decided, shown) {
  const at = states.findIndex((one) => one.state === shown);
  const after = states.slice(at + 1).concat(states.slice(0, Math.max(at, 0)));
  const open = after.find((one) => one.state !== shown && !one.settled && !decided[one.state]);
  return open ? open.state : null;
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
const AGREE_MARK = ${JSON.stringify(AGREE_MARK)};
${copiedOf.toString()}
${keptOf.toString()}
${entriesOf.toString()}
${blockedOf.toString()}
${remainingOf.toString()}
${decisionsOf.toString()}
${pickedOf.toString()}
${nextToReviewOf.toString()}
${nextOpenOf.toString()}
const STORE = "aidd-ui-review";
const drawer = document.getElementById("review");
const opener = document.getElementById("open-review");
const copy = document.getElementById("copy");
const clear = document.getElementById("clear");
const note = document.getElementById("note");
const items = [...drawer.querySelectorAll("details.item")];
const stepButtons = [...drawer.querySelectorAll(".step-ok")];
const stepCancels = [...drawer.querySelectorAll(".step-cancel")];
const sets = [...drawer.querySelectorAll("details.choice")];
const reviews = [...document.querySelectorAll("section.review[data-record]")];
const pickers = [...document.querySelectorAll(".variants[data-set]")];
const keyOf = (item) => item.dataset.record + "@" + item.dataset.version;
const reviewKeyOf = (review) => review.dataset.record + "@" + review.dataset.version;
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
const known = (() => { try { return JSON.parse(document.getElementById("review-records").textContent); } catch (error) { return []; } })();
const knownKeyOf = (each) => each.record + "@" + each.version;
const order = (() => { try { return JSON.parse(document.getElementById("review-order").textContent); } catch (error) { return []; } })();
let choices = {};
try { choices = keptOf(JSON.parse(stored(STORE) || "{}"), items.map(keyOf).concat(reviews.map(reviewKeyOf), sets.map(setKeyOf), known.map(knownKeyOf))); } catch (error) { choices = {}; }
const choiceOf = (key, name) => (choices[key] || {})[name];
function choose(key, name, choice) {
  unconfirm();
  const own = Object.assign({}, choices[key]);
  if (choice) own[name] = choice;
  else delete own[name];
  if (Object.keys(own).length) choices[key] = own;
  else delete choices[key];
  keep(STORE, Object.keys(choices).length ? JSON.stringify(choices) : null);
}
const settled = (row) => row.dataset.current === "ok" || row.dataset.current === "revise";
/** The records the page holds a verdict for: the drawer's, then every record of the project (the drawer's data), each
 * with the states of its tabs the drawer holds no row for added: a verdict given on another page still belongs to the copy. */
function recordsOf() {
  const records = items.map((item) => ({ key: keyOf(item), step: item.closest("details.step-group").dataset.step, record: item.dataset.record, version: item.dataset.version, states: rowsOf(item).map((row) => ({ state: row.dataset.state, settled: settled(row) })) }));
  for (const review of reviews) {
    const key = reviewKeyOf(review);
    let own = records.find((each) => each.key === key);
    if (!own) { own = { key, step: "", record: review.dataset.record, version: review.dataset.version, states: [] }; records.push(own); }
    for (const tab of review.querySelectorAll('[role="tab"]')) if (!own.states.some((one) => one.state === tab.dataset.tab)) own.states.push({ state: tab.dataset.tab, settled: tab.dataset.current === "ok" || tab.dataset.current === "revise" });
  }
  for (const each of known) {
    const key = knownKeyOf(each);
    let own = records.find((one) => one.key === key);
    if (!own) { own = { key, step: "", record: each.record, version: String(each.version), states: [] }; records.push(own); }
    for (const one of each.states) if (!own.states.some((other) => other.state === one.state)) own.states.push({ state: one.state, settled: one.settled });
  }
  for (const own of records) {
    const named = known.find((each) => knownKeyOf(each) === own.key);
    own.title = named ? named.title : own.record;
    for (const one of own.states) one.name = (named && (named.states.find((each) => each.state === one.state) || {}).name) || one.state;
  }
  return records;
}
const model = () => ({
  records: recordsOf(),
  sets: sets.map((set) => ({ key: setKeyOf(set), set: set.dataset.set, title: set.dataset.title, variants: variantsOf(set).map((row) => row.dataset.variant), labels: Object.fromEntries(variantsOf(set).map((row) => [row.dataset.variant, row.dataset.label])) })),
});
const entries = () => entriesOf(model(), choices);
const decided = document.getElementById("decisions");
/** The decisions to copy, listed in the drawer with their verdict and comment; the "nothing to review" line gives way to them. */
function paintDecisions(list) {
  const nothing = drawer.querySelector(".nothing");
  if (nothing) nothing.hidden = list.length > 0;
  if (!decided) return;
  const words = JSON.parse(decided.dataset.words);
  decided.querySelector("ul").replaceChildren(...list.map((each) => {
    const line = document.createElement("li");
    line.dataset.verdict = each.verdict;
    line.textContent = each.title + " \u00b7 " + each.name + " \u00b7 " + words[each.verdict].replace("{variant}", each.variant || "") + (each.comment.trim() ? " : " + each.comment.trim() : "");
    return line;
  }));
  decided.hidden = list.length === 0;
}
const blocked = () => blockedOf(entries());
function paint() {
  let left = 0;
  const stepOf = (node) => node.closest("details.step-group").dataset.step;
  const leftBy = Object.fromEntries([...items, ...sets].map((node) => [stepOf(node), 0]));
  const unsettled = [];
  const firstBy = {};
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
    }
    item.querySelector(".done").textContent = own + "/" + rows.length;
    document.querySelectorAll('.progress[data-record="' + item.dataset.record + '"]').forEach((each) => {
      const settledNow = Number(each.dataset.base) + own;
      each.textContent = settledNow + "/" + each.dataset.total;
      each.dataset.complete = String(settledNow === Number(each.dataset.total));
      document.querySelectorAll('.mark.todo[data-record="' + item.dataset.record + '"]').forEach((mark) => { mark.hidden = settledNow === Number(each.dataset.total); });
    });
    if (own < rows.length) unsettled.push(item);
  }
  document.querySelectorAll(".group[data-sum]").forEach((group) => {
    let done = 0;
    let total = 0;
    group.querySelectorAll(".progress[data-record]").forEach((each) => { const parts = each.textContent.split("/"); done += Number(parts[0]); total += Number(parts[1]); });
    const sum = group.querySelector(".sum");
    if (!sum || !total) return;
    sum.textContent = done + "/" + total;
    group.querySelector(".bar i").style.inlineSize = Math.round((100 * done) / total) + "%";
  });
  const rankOf = (item) => { const at = order.indexOf(item.dataset.record); return at < 0 ? Infinity : at; };
  for (const item of unsettled) {
    if (item.dataset.dressedBy) continue;
    left += 1;
    const step = stepOf(item);
    leftBy[step] += 1;
    if (!firstBy[step] || rankOf(item) < rankOf(firstBy[step])) firstBy[step] = item;
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
    if (!decided) { left += 1; leftBy[stepOf(set)] += 1; }
    const total = set.querySelector(".done");
    total.textContent = decided + "/" + variantsOf(set).length + " " + total.dataset.label;
    document.querySelectorAll('.progress[data-set="' + set.dataset.set + '"]').forEach((each) => { each.textContent = decided + "/" + each.dataset.total + " " + each.dataset.label; });
    const count = set.querySelector(".picked");
    const taken = Object.keys(picksOf(set)).length;
    count.hidden = !taken;
    count.textContent = taken + "/" + count.dataset.axes + " " + count.dataset.label;
  }
  for (const holder of pickers) {
    for (const column of holder.querySelectorAll(".variant")) {
      const choice = choiceOf(setKeyOf(holder), column.dataset.variant);
      column.querySelectorAll(".colvote").forEach((button) => button.setAttribute("aria-pressed", String(!!choice && button.dataset.verdict === choice.verdict)));
      const field = column.querySelector(".colcomment");
      if (!field) continue;
      field.hidden = !choice || choice.verdict !== "revise";
      if (document.activeElement !== field) field.value = (choice && choice.comment) || "";
    }
    const own = picksOf(holder);
    holder.querySelectorAll(".take").forEach((button) => button.setAttribute("aria-pressed", String(own[button.dataset.axis] === button.dataset.variant)));
  }
  const words = (document.querySelectorAll(".tally[data-template]")[0] || { dataset: {} }).dataset;
  const filled = (template, count) => String(template).replace("{count}", String(count));
  for (const [step, todo] of Object.entries(leftBy)) {
    const marks = document.querySelectorAll('.steps > li[data-step="' + step + '"] .step-mark');
    const own = marks.length ? marks[0].dataset : {};
    const proposed = Number(own.proposed || 0);
    const count = todo || proposed;
    const say = todo ? filled(words.template, todo) : proposed ? own.proposedWord : own.restWord;
    const mark = todo ? String(todo) : proposed ? AGREE_MARK : own.restMark;
    const write = (selector, text) => document.querySelectorAll(selector).forEach((each) => { each.textContent = text; });
    write('.stepper li[data-step="' + step + '"] .state', say);
    document.querySelectorAll('.stepper li[data-step="' + step + '"]').forEach((each) => { each.dataset.state = count ? "todo" : own.restState; });
    marks.forEach((each) => {
      each.textContent = mark;
      each.setAttribute("aria-label", say);
      each.classList.toggle("agree", !todo && proposed > 0);
    });
    document.querySelectorAll('.ov-step[data-step="' + step + '"] h3 span').forEach((each) => { each.textContent = count ? String(count) : ""; each.hidden = !count; });
    write('.step-group[data-step="' + step + '"] .step-count', "(" + count + ")");
  }
  const lede = document.querySelectorAll("p.lede[data-next]")[0];
  if (lede) {
    const fill = (template, values) => template.replace("{count}", String(values.count)).replace("{steps}", values.steps);
    const stepsOfPage = JSON.parse(lede.dataset.steps).map((each) => ({ ...each, todo: leftBy[each.step] || 0 }));
    const waiting = stepsOfPage.filter((each) => each.todo);
    const agreeing = stepsOfPage.filter((each) => each.proposed);
    const agree = (template) => fill(template, { count: agreeing.reduce((sum, each) => sum + each.proposed, 0), steps: agreeing.map((each) => each.name).join(", ") });
    const review = waiting.length ? fill(lede.dataset.next, { count: waiting.reduce((sum, each) => sum + each.todo, 0), steps: waiting.map((each) => each.name).join(", ") }) : "";
    lede.textContent = waiting.length ? (agreeing.length ? review + " " + agree(lede.dataset.agree) : review) : agreeing.length ? agree(lede.dataset.only) : lede.dataset.nothing;
    const row = document.querySelectorAll(".start-row")[0];
    if (row) {
      const first = stepsOfPage.find((each) => each.todo || each.proposed);
      row.hidden = !waiting.length;
      if (first) row.querySelector("a.start").setAttribute("href", first.todo && firstBy[first.step] ? firstBy[first.step].dataset.href : first.rest);
    }
  }
  paintBars();
  const list = decisionsOf(model(), choices);
  paintDecisions(list);
  document.querySelectorAll(".tally[data-template]").forEach((each) => { each.textContent = (left || !list.length || !decided ? each.dataset.template : decided.dataset.copy).replace("{count}", String(left || list.length)); });
  const stuck = blocked();
  copy.disabled = stuck || !copiedOf(entries());
  for (const button of stepButtons) button.disabled = remainingOf(model(), choices, button.dataset.step).length === 0;
  note.textContent = stuck ? copy.dataset.blocked : copy.disabled ? copy.dataset.hint : "";
}
/** The state a record's tabs show, or null without tabs. */
const shownOf = (review) => { const tab = review.querySelector('[role="tab"][aria-selected="true"]'); return tab ? tab.dataset.tab : null; };
/** The tabs of a record as the order of their states, each settled or not by the review file. */
const statesOf = (review) => [...review.querySelectorAll('[role="tab"]')].map((tab) => ({ state: tab.dataset.tab, settled: tab.dataset.current === "ok" || tab.dataset.current === "revise" }));
/** The verdict bar of each record on the page, showing the verdict of the state its tabs show, and each tab its own,
 * with the count of states reviewed and the way on: the next state, else the next record, once every state has a verdict. */
function paintBars() {
  for (const review of reviews) {
    const key = reviewKeyOf(review);
    for (const tab of review.querySelectorAll('[role="tab"]')) {
      const choice = choiceOf(key, tab.dataset.tab);
      if (choice) tab.dataset.choice = choice.verdict;
      else delete tab.dataset.choice;
    }
    const bar = review.querySelector(".verdict-bar");
    const state = shownOf(review);
    if (!bar || state === null) continue;
    const choice = choiceOf(key, state);
    const verdict = choice ? choice.verdict : "";
    bar.querySelectorAll(".verdict").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.verdict === verdict)));
    const field = bar.querySelector(".comment");
    field.hidden = verdict !== "revise";
    if (document.activeElement !== field) field.value = (choice && choice.comment) || "";
    const states = statesOf(review);
    const own = choices[key] || {};
    const open = states.filter((one) => !one.settled && !own[one.state]);
    const bare = Object.values(own).some((each) => each.verdict === "revise" && !String(each.comment || "").trim());
    const reviewed = bar.querySelector(".reviewed");
    if (reviewed) reviewed.textContent = reviewed.dataset.template.replace("{done}", String(states.length - open.length)).replace("{total}", reviewed.dataset.total);
    const nextState = bar.querySelector(".next-state");
    if (nextState) {
      nextState.hidden = nextOpenOf(states, own, state) === null;
      nextState.disabled = verdict === "revise" && !String(choice.comment || "").trim();
    }
    const nextRecord = bar.querySelector(".next-record");
    if (nextRecord) {
      nextRecord.hidden = open.length > 0 || bare;
      const target = nextToReviewOf(order, known, choices, review.dataset.record);
      // the order holds records with a render, never a journey: its ids name plain pages
      nextRecord.href = target ? target.record + ".html#tab-" + target.state : "index.html";
      nextRecord.textContent = target ? nextRecord.dataset.next : nextRecord.dataset.overview;
    }
  }
}
/** Opens the next state of the record with no verdict, from the one shown; false when there is none or no tabs to open. */
function advance(review) {
  const next = nextOpenOf(statesOf(review), choices[reviewKeyOf(review)] || {}, shownOf(review));
  const tab = [...review.querySelectorAll('[role="tab"]')].find((each) => each.dataset.tab === next);
  if (!tab || typeof openTab !== "function") return false;
  openTab(tab);
  return true;
}
/** Marks the state of the page's own record that its tabs show, in the drawer and beside the tabs. */
function marked(state) {
  for (const item of items) if (item.hasAttribute("data-here")) rowsOf(item).forEach((row) => row.classList.toggle("on", row.dataset.state === state));
  paintBars();
}
function show(on) {
  if (!on) unconfirm();
  drawer.hidden = !on;
  document.body.dataset.drawer = on ? "open" : "closed";
  opener.setAttribute("aria-expanded", String(on));
}
items.forEach((item) => rowsOf(item).forEach((row) => {
  const state = row.dataset.state;
  const field = row.querySelector(".comment");
  row.querySelectorAll(".verdict").forEach((button) => button.addEventListener("click", () => {
    if (vote(keyOf(item), state, button.dataset.verdict)) field.focus();
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
/** Sets or takes back a verdict on a state or a variant, from the drawer or in place; true when it asks for a comment. */
function vote(key, name, verdict) {
  const now = choiceOf(key, name);
  const again = now && now.verdict === verdict;
  const revise = verdict === "revise";
  choose(key, name, again ? null : { verdict, comment: revise && now ? now.comment || "" : "" });
  paint();
  return !again && revise;
}
pickers.forEach((holder) => holder.querySelectorAll(".variant").forEach((column) => {
  const name = column.dataset.variant;
  const field = column.querySelector(".colcomment");
  if (!field) return;
  column.querySelectorAll(".colvote").forEach((button) => button.addEventListener("click", () => {
    if (vote(setKeyOf(holder), name, button.dataset.verdict)) field.focus();
  }));
  field.addEventListener("input", () => {
    choose(setKeyOf(holder), name, { verdict: "revise", comment: field.value });
    paint();
  });
}));
reviews.forEach((review) => {
  const bar = review.querySelector(".verdict-bar");
  if (!bar) return;
  const field = bar.querySelector(".comment");
  const nextState = bar.querySelector(".next-state");
  bar.querySelectorAll(".verdict").forEach((button) => button.addEventListener("click", () => {
    if (vote(reviewKeyOf(review), shownOf(review), button.dataset.verdict)) field.focus();
    else if ((choiceOf(reviewKeyOf(review), shownOf(review)) || {}).verdict === "ok") advance(review);
  }));
  if (nextState) nextState.addEventListener("click", () => advance(review));
  field.addEventListener("input", () => {
    choose(reviewKeyOf(review), shownOf(review), { verdict: "revise", comment: field.value });
    paint();
  });
});
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
/** Takes back the question of every "all OK" of the drawer, each button with its own words again; true when one was asked. */
function unconfirm() {
  const asked = stepButtons.filter((button) => button.dataset.asking);
  stepButtons.forEach((button, at) => {
    delete button.dataset.asking;
    button.textContent = button.dataset.label;
    if (!stepCancels[at]) return;
    if (document.activeElement === stepCancels[at]) button.focus();
    stepCancels[at].hidden = true;
  });
  return asked.length > 0;
}
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || drawer.hidden || unconfirm()) return;
  show(false);
  opener.focus();
});
stepButtons.forEach((button, at) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    const asked = button.dataset.asking;
    const left = remainingOf(model(), choices, button.dataset.step);
    unconfirm();
    if (!asked) {
      button.dataset.asking = "1";
      button.textContent = (left.length === 1 ? button.dataset.confirmOne : button.dataset.confirm).replace("{count}", String(left.length));
      if (stepCancels[at]) stepCancels[at].hidden = false;
      return;
    }
    for (const { key, state } of left) choose(key, state, { verdict: "ok", comment: "" });
    paint();
  });
  if (stepCancels[at]) stepCancels[at].addEventListener("click", (event) => { event.preventDefault(); unconfirm(); });
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

/** Whether the record is still proposed: one the drawer cannot review (an asset, a journey) is validated elsewhere,
 * so the step holding it is not done. */
const unvalidated = (record) => fm(record).status === "proposed";

/** Whether a screen's code is at its version: its states then each need a capture. */
const isCoded = (record) => fm(record).kind === "screen" && list(fm(record).code).some((link) => parseLink(link)?.version === fm(record).version);

const pageNameOf = (record) => pageName(fm(record).kind, fm(record).id);

const link = (record, current, shown = fm(record).id) => `<a href="${escaped(pageNameOf(record))}"${current ? ' aria-current="page"' : ""}>${escaped(shown)}</a>`;

/** A status in the language of the page; one the table does not know is shown as written. */
const statusLabel = (labels, status) => (Object.hasOwn(labels.statuses, status) ? labels.statuses[status] : String(status));

/** Elements by the order of the categories, every record by its id. */
const byCategory = (a, b) => CATEGORIES.indexOf(categoryOf(a)) - CATEGORIES.indexOf(categoryOf(b)) || byRecordId(a, b);

/** The step a page stands on: that of its record or set, on the overview the first step with work. */
function hereOf(held, records, sets, current) {
  if (current === null) return held.find((each) => each.count)?.step;
  if (current.startsWith(SET_CURRENT)) return setStepOf(sets.find((set) => `${SET_CURRENT}${set.id}` === current) ?? {});
  return stepOf(records.find((record) => pageNameOf(record) === current) ?? {});
}

/** The count of what awaits review, as the button and the drawer write it: the page script rewrites it as verdicts are given. */
const pendingOf = (labels, count) => `<span class="tally pending" data-template="${escaped(labels.toReview)}">${escaped(filled(labels.toReview, { count }))}</span>`;

/** A record as a line: its title linking its page, then whatever follows it on the line. */
const recordLine = (record, title, after = "") => `<li data-id="${escaped(fm(record).id)}"><a href="${escaped(pageNameOf(record))}">${escaped(title)}</a>${after}</li>`;

/** What a step still asks, in words: the records to review, else the records awaiting agreement. */
const leftWordOf = (labels, each) => (each.todo ? filled(labels.toReview, { count: each.count }) : filled(labels.proposedCount, { count: each.count }));

/** What a step says once nothing is left to review and nothing is proposed: complete when it holds something, else empty.
 * The page script writes the same words when verdicts bring a step to nothing. */
const restOf = (labels, each) => (each.records.length || each.sets.length ? { state: "done", word: labels.stepDone, mark: "\u2713" } : { state: "empty", word: labels.stepEmpty, mark: "\u2014" });

/** What each step holds and what in it awaits review: its records, its sets, the records with a render and a state
 * not settled, the open sets, and the records the drawer cannot review that are still proposed. `todo` counts records
 * and open sets, never states, a wireframe awaiting beside the awaiting screen that dresses it once (`dressedBy` names
 * that screen, `counted` is what is left), and leaves the proposed ones out: the drawer cannot clear them. A wireframe
 * leaves the review once one screen that dresses it has nothing left awaiting. `count` is the one number a step
 * shows wherever it is shown: what the drawer reviews, else the records still proposed. `listed` is what that
 * number counts, record by record: one row per screen, the proposed ones when nothing is left to review. */
function stepsOf({ project, records, rows, sets }) {
  const settledWireframes = new Set(records.filter((record) => fm(record).kind === "screen" && fm(record).wireframe && reviewable(project, record) && !awaitingOf(rows, record).length).map((record) => fm(record).wireframe));
  return STEPS.map((step) => {
    const own = records.filter((record) => stepOf(record) === step);
    const ownSets = sets.filter((set) => setStepOf(set) === step);
    const awaiting = own.filter((record) => reviewable(project, record) && awaitingOf(rows, record).length && !settledWireframes.has(fm(record).id)).sort(byCategory);
    const open = ownSets.filter((set) => !set.problems.length);
    const dressedBy = new Map(awaiting.filter((record) => fm(record).kind === "screen" && fm(record).wireframe).map((record) => [fm(record).wireframe, fm(record).id]));
    const counted = awaiting.filter((record) => !(fm(record).kind === "wireframe" && dressedBy.has(fm(record).id)));
    const proposed = own.filter((record) => !reviewable(project, record) && unvalidated(record));
    const todo = counted.length + open.length;
    return { step, records: own, sets: ownSets, awaiting, counted, dressedBy, open, proposed, todo, count: todo || proposed.length, listed: todo ? counted : proposed };
  });
}

/** The records of the screens step, grouped under the first journey whose Steps table names them, in step order;
 * the rest under an empty journey id. One group with no journey when none names any. A step that names a wireframe
 * is held by the screens that dress it, the wireframe a `sketches` record the navigation leaves out, so a step reads once. */
function screenGroupsOf(records, journeys) {
  const byId = new Map(records.map((record) => [fm(record).id, record]));
  const placedIds = new Set();
  const groups = [];
  for (const journey of [...journeys].sort(byRecordId)) {
    const own = [];
    const sketches = new Set();
    const place = (record) => {
      placedIds.add(fm(record).id);
      own.push(record);
    };
    for (const row of table(journey.sections[STEPS_SECTION])) {
      const target = byId.get(row.Screen);
      if (!target || placedIds.has(row.Screen)) continue;
      const dressers = records.filter((record) => fm(record).kind === "screen" && fm(record).wireframe === row.Screen && !placedIds.has(fm(record).id)).sort(byRecordId);
      dressers.forEach(place);
      if (dressers.length || own.some((record) => fm(record).wireframe === row.Screen)) sketches.add(row.Screen);
      place(target);
    }
    if (own.length) groups.push({ journey, records: own, sketches });
  }
  const rest = records.filter((record) => !placedIds.has(fm(record).id)).sort(byRecordId);
  if (rest.length) groups.push({ journey: null, records: rest, sketches: new Set() });
  return groups;
}

/** The ids of the records to review, in the order the sidebar lists them: step by step, a step's records as it lists them,
 * the screens by journey. Only what a step counts is in it: a wireframe a screen dresses is reviewed through that screen. */
function reviewOrderOf(held, journeys) {
  const counted = new Set(held.flatMap((each) => each.counted));
  const ordered = ({ step, records: own }) => {
    if (step === "screens") return screenGroupsOf(own, journeys).flatMap((group) => group.records.filter((record) => !group.sketches.has(fm(record).id)));
    return [...own].sort(step === "components" ? byCategory : byRecordId);
  };
  return held.flatMap(ordered).filter((record) => counted.has(record)).map((record) => fm(record).id);
}

/** The navigation, the same on every page: the five steps in order, each folded, the Review button at its foot. */
function navigationOf(project, records, labels, current, sets = [], rows = [], anchors = new Map()) {
  const journeys = records.filter((record) => fm(record).kind === "journey");
  const item = (record) => `<li data-id="${escaped(fm(record).id)}">${link(record, pageNameOf(record) === current || (fm(record).wireframe !== undefined && pageName("wireframe", fm(record).wireframe) === current), titleOf(project, record, labels))}</li>`;
  const named = (record, step) => `<li data-id="${escaped(fm(record).id)}">${link(record, pageNameOf(record) === current, labels.stepNames[step])}</li>`;
  const ul = (items) => `<ul>${items.join("")}</ul>`;
  const setsOf = (held) => (held.length ? `<section data-group="choose"><h3>${labels.choose}</h3><ul>${held.map((set) => `<li data-set="${escaped(set.id)}"><a href="${escaped(variants.setFileOf(set.id))}"${current === `${SET_CURRENT}${set.id}` ? ' aria-current="page"' : ""}>${escaped(set.title)}</a></li>`).join("")}</ul></section>` : "");
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
      return groups.map((group) => `<h3 data-journey="${group.journey ? escaped(fm(group.journey).id) : ""}">${group.journey ? escaped(titleOf(project, group.journey)) : labels.outOfJourney}</h3>${ul(group.records.filter((record) => !group.sketches.has(fm(record).id)).map(item))}`).join("");
    }
    return ul(sorted.map(item));
  };
  const held = stepsOf({ project, records, rows, sets });
  const here = hereOf(held, records, sets, current);
  const total = held.reduce((sum, each) => sum + each.todo, 0);
  const stepItem = (each, at) => {
    const agree = each.count && !each.todo;
    const rest = restOf(labels, each);
    const mark = agree ? AGREE_MARK : each.count ? each.count : rest.mark;
    const markName = each.count ? leftWordOf(labels, each) : rest.word;
    const alone = (each.step === "identity" || each.step === "foundations") && each.records.length === 1 && !each.sets.length ? each.records[0] : null;
    const name = alone
      ? `<a class="step-name" href="${escaped(pageNameOf(alone))}"${pageNameOf(alone) === current ? ' aria-current="page"' : ""}>${labels.stepNames[each.step]}</a>`
      : `<span class="step-name">${labels.stepNames[each.step]}</span>`;
    const body = alone ? subNavigationOf(fm(alone).id, anchors.get(fm(alone).id) ?? []) : bodyOf(each) + setsOf(each.sets);
    return `<li data-step="${each.step}" data-todo="${each.todo}"><details${each.step === here ? " open" : ""}><summary><span class="stepno">${at + 1}</span>${name}<span class="step-mark${agree ? " agree" : ""}" role="img" aria-label="${escaped(markName)}" data-proposed="${each.proposed.length}" data-proposed-word="${escaped(filled(labels.proposedCount, { count: each.proposed.length }))}" data-rest-state="${rest.state}" data-rest-word="${escaped(rest.word)}" data-rest-mark="${rest.mark}">${mark}</span></summary>${body}</details></li>`;
  };
  const foot = `<div class="review-foot"><button type="button" class="open-review" id="open-review" aria-controls="review" aria-expanded="false"><span class="label">${labels.myReview}</span>${pendingOf(labels, total)}</button></div>`;
  const bar = `<div class="nav-bar"><span class="nav-title">${labels.title}</span><button type="button" id="nav-toggle" aria-controls="nav-sheet" aria-expanded="false">${labels.contents}</button></div>`;
  return `<nav aria-label="${escaped(labels.list)}">${bar}<div class="nav-scroll" id="nav-sheet"><div class="brand"><span class="brand-mark"></span>${labels.title}</div><p class="home"><a href="index.html"${current === null ? ' aria-current="page"' : ""}>${labels.home}</a></p><ol class="steps">${held.map(stepItem).join("")}</ol></div>${foot}</nav>`;
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
const stepAddress = (journey, screen, step) => `${pageNameOf(screen)}?journey=${encodeURIComponent(journey)}&step=${step}`;

/** A journey as a storyboard: a card per step of its Steps table, showing a miniature of the record that
 * bears the name and linking its page, the screen named under it, then the action numbered. */
function journeyOf({ project, record, recordsById, tokens, labels }) {
  const steps = table(record.sections[STEPS_SECTION]);
  if (!steps.length) return "";
  const card = (row, at) => {
    const target = recordsById.get(row.Screen);
    const face = `${miniatureOf(project, target, tokens, labels)}<span class="screen">${escaped(target ? titleOf(project, target) : row.Screen ?? "")}</span>`;
    const shown = target ? `<a class="step" href="${escaped(stepAddress(fm(record).id, target, at + 1))}">${face}</a>` : `<div class="step">${face}</div>`;
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
        return target ? `<a class="${name}" href="${escaped(stepAddress(journeyId, target, to + 1))}"><small>${caption}</small>${escaped(titleOf(project, target))}</a>` : "";
      };
      bars.push(`<nav class="journey-bar" data-journey="${escaped(journeyId)}" data-step="${at + 1}" aria-label="${escaped(titleOf(project, journey))}" hidden><a class="journey-title" href="${escaped(pageNameOf(journey))}">${escaped(titleOf(project, journey))}</a><span class="where">${escaped(filled(labels.stepOf, { at: at + 1, count: steps.length }))}</span>${around(at - 1, "prev", labels.previousStep)}${around(at + 1, "next", labels.nextStep)}</nav>`);
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

const statusOf = (record, labels) => (fm(record).status === undefined ? "" : `<span class="chip" data-status="${escaped(fm(record).status)}">${escaped(statusLabel(labels, fm(record).status))}</span>`);

/** The status of a record with its version small beside it, stamped on the title line. */
function stampOf(record, labels) {
  const { version } = fm(record);
  const parts = [statusOf(record, labels), ...(version === undefined ? [] : [`<span class="version">v${escaped(String(version))}</span>`])].join("");
  return parts ? `<div class="stamp">${parts}</div>` : "";
}

/** The two-way switch between a screen and the wireframe it dresses, on the page of either; empty for any other record. */
function twinOf(record, records, labels) {
  const { id, kind } = fm(record);
  const pair = kind === "screen" ? [record, records.find((other) => fm(other).kind === "wireframe" && fm(other).id === fm(record).wireframe)] : kind === "wireframe" ? [records.filter((other) => fm(other).kind === "screen" && fm(other).wireframe === id).sort(byRecordId)[0], record] : [];
  if (!pair[0] || !pair[1]) return "";
  const side = (each, label) => (fm(each).id === id ? `<a aria-current="page">${escaped(label)}</a>` : `<a href="${escaped(pageNameOf(each))}">${escaped(label)}</a>`);
  return `<nav class="twin" aria-label="${escaped(labels.twin)}">${side(pair[0], labels.screen)}${side(pair[1], labels.wireframe)}</nav>`;
}

const linksOf = (kind, label, targets, shown = (target) => fm(target).id) => (targets.length ? `<section class="links" data-links="${kind}"><h2>${label}</h2><ul>${targets.map((target) => `<li>${link(target, false, shown(target))}</li>`).join("")}</ul></section>` : "");

/** Where a record appears, at the bottom of its page: a small card per record that cites it, its title and status. */
function appearsOf({ project, ids, recordsById, labels }) {
  if (!ids.length) return "";
  const card = (id) => `<li><a class="mini-card" href="${escaped(pageNameOf(recordsById.get(id)))}"><b>${escaped(titleOf(project, recordsById.get(id), labels))}</b>${statusOf(recordsById.get(id), labels)}</a></li>`;
  return `<section class="appears"><h2>${labels.appearsIn}</h2><ul>${ids.map(card).join("")}</ul></section>`;
}

/** How a wireframe looks in the showcase: a lo-fi sketch on paper. Text in a readable scale, buttons as
 * grey rounded blocks, fields as outlined boxes, tables with light rules, links as plain dark text,
 * emphasis as a pill, images as crossed boxes, each zone a faint outline named small in its corner.
 * Fixed colours, so the paper stays light whatever the reader's scheme. The record stays unstyled. */
const GREY_BOX = `
:root { color-scheme: light; background: #fbfbfa; }
body { margin: 0; padding: 24px 28px 28px; font: 14px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #45453f; background: #fbfbfa; }
[data-zone] { position: relative; box-sizing: border-box; min-height: 48px; margin: 0 0 12px; padding: 24px 16px 14px; border: 1px solid #e7e7e2; border-radius: 10px; background: #ffffff; }
[data-zone]::before { content: attr(data-zone-label); position: absolute; top: 6px; left: 12px; font: 500 10px/1 system-ui, sans-serif; letter-spacing: 0.02em; color: #b4b4ad; }
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

/** Each zone of a sketch carries the name it shows: the label its element declares, else its slug as words. */
const labelled = (doc, sketch) => (sketch ? doc.replace(/<[a-z][^<>]*? data-zone="([^"]*)"[^<>]*>/gi, (tag, zone) => tag.replace(/>$/, ` data-zone-label="${tag.match(/ data-label="([^"]*)"/)?.[1] ?? escaped(variants.titleOf(zone))}">`)) : doc);

/** The document of one state of a render: the tokens inline, every other state hidden with the caption standing right before it. A render without `</head>` keeps every state visible in each frame: a known limit. */
function stateDocument(render, tokens, state, sketch) {
  const other = `[data-state]:not([data-state=${JSON.stringify(state)}])`;
  const hide = `<style>${other} { display: none !important; }:not([data-state]):not(:has([data-state])):has(+ ${other}) { display: none !important; }${sketch ? GREY_BOX : ""}</style>`;
  const doc = labelled(inlined(render, tokens), sketch);
  return doc.replace(/<\/head>/i, () => `${hide}</head>`);
}

/** The options of a picker: each value kept as written for the script, shown by its name in the language when it has one. */
const optionsOf = (values, second, names = {}) => values.map((value, at) => `<option value="${escaped(value)}"${second && at === 1 ? " selected" : ""}>${escaped(Object.hasOwn(names, value) ? names[value] : value)}</option>`).join("");

/** The theme and platform pickers: a combination A, a combination B shown beside it on request. */
function toolbarOf(system, labels) {
  const axes = [["theme", labels.theme, list(system && fm(system).themes), labels.themeNames], ["platform", labels.platform, list(system && fm(system).platforms)]].filter(([, , values]) => values.length > 1);
  if (!axes.length) return "";
  const combo = (name, second) => `<fieldset data-combo="${name}"${second ? " hidden" : ""}><legend>${labels.combination} ${name.toUpperCase()}</legend>${axes.map(([axis, label, values, names]) => `<label>${label} <select data-axis="${axis}">${optionsOf(values, second, names)}</select></label>`).join("")}</fieldset>`;
  return `<div class="toolbar">${combo("a", false)}${combo("b", true)}<button type="button" id="sides" aria-pressed="false">${labels.sides}</button></div>`;
}

/** The id of a state's tab and of its panel. */
const tabId = (state) => `tab-${state}`;
const panelId = (state) => `panel-${state}`;

/** One state of a record, as the panel of its tab: an older verdict or a comment already given, then its
 * render on the canvas, the capture beside it for a coded screen. Only the first panel starts open. The
 * verdicts are chosen in the review panel. */
function stateOf({ record, title, state, verdict, render, tokens, captures, labels, platform, first }) {
  const { id, version } = fm(record);
  const file = `${record.folder}/${id}.${state}@${version}.png`;
  const capture = !isCoded(record) ? "" : captures.has(file) ? `<figure class="capture" data-file="${escaped(file)}"><img src="../${escaped(file)}" alt="${escaped(filled(labels.capture, { state: stateNameOf(labels, state) }))}"></figure>` : `<div class="capture missing" data-file="${escaped(file)}">${escaped(labels.noCapture)}</div>`;
  const notes = [
    verdict.outdated === null ? "" : `<p class="outdated" data-version="${escaped(verdict.outdated)}">${escaped(filled(labels.outdated, { version: verdict.outdated }))}</p>`,
    verdict.comment ? `<p class="said">${escaped(verdict.comment)}</p>` : "",
  ].join("");
  return [
    `<article class="state" data-state="${escaped(state)}" data-current="${escaped(verdict.current)}" role="tabpanel" id="${escaped(panelId(state))}" aria-labelledby="${escaped(tabId(state))}"${first ? "" : " hidden"}>`,
    notes ? `<div class="state-bar">${notes}</div>` : "",
    `<div class="pair"><div class="render"><iframe data-combo="a"${platform} title="${escaped(`${title} ${stateNameOf(labels, state)}`)}" srcdoc="${escaped(stateDocument(render, tokens, state, fm(record).kind === "wireframe"))}"></iframe></div>${capture}</div>`,
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

/** The verdict of the state the tabs show, given after the states it judges: the same choice, key and values as the drawer's row,
 * its comment asked in place, with the count of states reviewed and the way on, which the page script shows as the review goes. */
const verdictBarOf = (labels, states) => `<div class="verdict-bar"><span class="choose"><button type="button" class="verdict" data-verdict="ok" aria-pressed="false">${labels.ok}</button><button type="button" class="verdict" data-verdict="revise" aria-pressed="false">${labels.revise}</button></span><span class="reviewed" data-template="${escaped(labels.reviewed)}" data-total="${states.length}">${escaped(filled(labels.reviewed, { done: settledOf(states), total: states.length }))}</span><button type="button" class="next-state" hidden>${labels.nextState}</button><a class="next-record" href="index.html" data-next="${escaped(labels.nextRecord)}" data-overview="${escaped(labels.backToOverview)}" hidden>${labels.nextRecord}</a><textarea class="comment" rows="2" placeholder="${escaped(labels.comment)}" aria-label="${escaped(labels.comment)}" hidden></textarea></div>`;

/** The review of a record: each state as a tab, the ones still to review first. */
function reviewOf({ project, system, record, rows, tokens, captures, labels }) {
  const render = text(project, renderOf(record));
  const ordered = orderedStates(rows, record);
  return [
    `<section class="review" data-record="${escaped(fm(record).id)}" data-version="${escaped(String(fm(record).version))}">`,
    `<div class="bar-top"><h2>${labels.states}</h2></div>`,
    fm(record).kind === "wireframe" ? "" : toolbarOf(system, labels), // a wireframe holds no style for a theme to change
    widthOf(system, labels),
    tabsOf(ordered, labels),
    ...ordered.map(({ state, verdict }, at) => stateOf({ record, title: titleOf(project, record, labels), state, verdict, render, tokens, captures, labels, platform: platformOf(system), first: at === 0 })),
    verdictBarOf(labels, ordered),
    "</section>",
  ].join("\n");
}

/** The review panel, the same on every page but for the step of the page, which starts open: one group per step
 * with something left to review, each record awaiting review with only its states not settled, each state with a
 * link to its tab, its verdict pair and a comment field, then one copy of all that is decided. A group carries its
 * own "all OK". Opened by the button at the foot of the sidebar, which counts what awaits review. */
function drawerOf({ project, held, here, rows, labels, current, order }) {
  const item = (record) => {
    const { id, version } = fm(record);
    const wanted = awaitingOf(rows, record);
    const states = orderedStates(rows, record).filter(({ state }) => wanted.includes(state));
    const whole = Object.hasOwn(labels.kindNames, fm(record).kind);
    const row = ({ state, verdict }) => [
      `<li class="pstate" data-state="${escaped(state)}" data-current="${escaped(verdict.current)}">`,
      `<a class="pick" href="${escaped(pageNameOf(record))}${whole ? "" : `#${escaped(tabId(state))}`}">${escaped(whole ? labels.whole : stateNameOf(labels, state))}</a>`,
      `<span class="choose"><button type="button" class="verdict" data-verdict="ok" aria-pressed="false">${labels.ok}</button><button type="button" class="verdict" data-verdict="revise" aria-pressed="false">${labels.revise}</button></span>`,
      verdict.comment ? `<p class="said">${escaped(verdict.comment)}</p>` : "",
      `<textarea class="comment" rows="2" placeholder="${escaped(labels.comment)}" aria-label="${escaped(labels.comment)}" hidden></textarea>`,
      "</li>",
    ].join("");
    const screen = held.map((each) => each.dressedBy.get(id)).find(Boolean);
    return `<details class="item" data-record="${escaped(id)}" data-version="${escaped(String(version))}"${screen ? ` data-dressed-by="${escaped(screen)}"` : ""} data-href="${escaped(pageNameOf(record))}"${pageNameOf(record) === current ? " open data-here" : ""}><summary><span>${escaped(titleOf(project, record, labels))}${screen ? ` \u00b7 ${escaped(labels.wireframe)}` : ""}</span><span class="done">${settledOf(states)}/${states.length}</span></summary><ol>${states.map(row).join("")}</ol></details>`;
  };
  const shown = held.reduce((sum, each) => sum + each.awaiting.length + each.open.length, 0);
  const known = held.flatMap((each) => each.records).filter((record) => reviewable(project, record)).map((record) => ({
    record: fm(record).id,
    version: String(fm(record).version),
    title: titleOf(project, record, labels),
    states: orderedStates(rows, record).map(({ state, verdict }) => ({ state, name: Object.hasOwn(labels.kindNames, fm(record).kind) ? labels.whole : stateNameOf(labels, state), settled: !UNRESOLVED.includes(verdict.current) })),
  }));
  const vote = ([verdict, label]) => `<button type="button" class="vote" data-verdict="${verdict}" aria-pressed="false">${label}</button>`;
  const choice = (set) => {
    const row = (variant) => `<li class="pvariant" data-variant="${escaped(variant.name)}" data-label="${escaped(variants.titleOf(variant.name))}"><span class="pick">${escaped(variants.titleOf(variant.name))}</span><span class="choose">${[["keep", labels.keep], ["revise", labels.revise], ["discard", labels.discard]].map(vote).join("")}</span><textarea class="comment" rows="2" placeholder="${escaped(labels.comment)}" aria-label="${escaped(labels.comment)}" hidden></textarea></li>`;
    return `<details class="choice" data-set="${escaped(set.id)}" data-title="${escaped(set.title)}" data-fingerprint="${escaped(set.fingerprint)}" open><summary><span>${escaped(set.title)}</span><span class="picked" data-axes="${set.axes.length}" data-label="${escaped(labels.picks)}" hidden></span><span class="done" data-label="${escaped(labels.decided)}">0/${variants.latestOf(set.variants).length} ${escaped(labels.decided)}</span></summary><ol>${variants.latestOf(set.variants).map(row).join("")}</ol></details>`;
  };
  const choices = (each) => (each.open.length ? `<section class="choices" data-group="choose"><h3>${labels.choose}</h3>${each.open.map(choice).join("")}</section>` : "");
  const agreeing = (each) => (each.todo ? "" : `<section class="agreeing"><ul>${each.listed.map((record) => recordLine(record, titleOf(project, record, labels))).join("")}</ul><p class="note">${labels.agreeInChat}</p></section>`);
  const ok = (each) => (each.awaiting.length ? `<button type="button" class="step-ok" data-step="${each.step}" data-label="${escaped(labels.allOk)}" data-confirm="${escaped(labels.confirmAll)}" data-confirm-one="${escaped(labels.confirmAllOne)}">${labels.allOk}</button><button type="button" class="step-cancel" data-step="${each.step}" hidden>${labels.cancel}</button>` : "");
  const entry = (each, record) => `<div class="entry">${[record, ...each.awaiting.filter((other) => each.dressedBy.get(fm(other).id) === fm(record).id)].map(item).join("")}</div>`;
  const group = (each) => `<details class="step-group" data-step="${each.step}"${each.step === here || shown <= FEW_ITEMS ? " open" : ""}><summary><span class="step-name">${labels.stepNames[each.step]}</span><span class="step-count">(${each.count})</span>${ok(each)}</summary>${choices(each)}${each.counted.map((record) => entry(each, record)).join("\n")}${agreeing(each)}</details>`;
  const groups = held.filter((each) => each.count).map(group).join("\n");
  const tally = pendingOf(labels, held.reduce((sum, each) => sum + each.todo, 0));
  return [
    '<div class="scrim" id="scrim"></div>',
    `<script type="application/json" id="review-order">${JSON.stringify(order).replaceAll("<", "\\u003c")}</script>`,
    `<script type="application/json" id="review-records">${JSON.stringify(known).replaceAll("<", "\\u003c")}</script>`,
    `<aside class="drawer" id="review" aria-label="${escaped(labels.myReview)}" hidden>`,
    `<div class="drawer-head"><h2>${labels.myReview}</h2>${tally}<button type="button" class="close" id="close-review" aria-label="${escaped(labels.close)}">&times;</button></div>`,
    `<div class="drawer-body"><section class="decisions" id="decisions" hidden data-copy="${escaped(labels.toCopy)}" data-words="${escaped(JSON.stringify({ ok: labels.ok, revise: labels.revise, keep: labels.keep, discard: labels.discard, pick: labels.pickedFrom }))}"><h3>${labels.decisions}</h3><ul></ul></section>${groups || `<p class="nothing">${labels.nothing}</p>`}</div>`,
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

/** The record as html under its title: its `specLines`, their headings and table columns named in the language. */
function specOf(project, record, labels) {
  const kept = specLines(project, record);
  const named = columnsNamed(kept, labels).map((line) => line.replace(SECTION_LINE, (whole, name) => (Object.hasOwn(labels.sections, name) ? `## ${labels.sections[name]}` : whole)));
  return documentOf(named.join(LINE_BREAK));
}

/** The image of an asset, under its heading: its `file` beside the record, at most its natural size, else a note naming
 * where to save it. Nothing for another kind, for an asset without a `file`, or one whose file lies outside the design system folder. */
function assetImageOf({ project, record, labels }) {
  const file = fm(record).file;
  if (fm(record).kind !== "asset" || typeof file !== "string" || !file.trim()) return "";
  const resolved = path.posix.normalize(path.posix.join(record.folder, file.trim()));
  if (resolved === ".." || resolved.startsWith("../")) return "";
  if (text(project, `${UI_DIR}/${resolved}`) === null) return `<div class="asset-image missing" data-file="${escaped(resolved)}">${escaped(labels.noAssetFile)}</div>`;
  return `<figure class="asset-image" data-file="${escaped(resolved)}"><img src="../${escaped(resolved)}" alt="${escaped(String(fm(record).alt ?? ""))}"></figure>`;
}

/** The heading of a record's page: its group, its title, its status and version under the title, clear of the
 * review button at the top right, then its description and a journey's persona. */
const headOf = ({ record, title, description, persona, labels }) => `<header class="head"><p class="crumb">${labels.stepNames[stepOf(record)]}</p><h1>${escaped(title)}</h1>${stampOf(record, labels)}${description ? `<p class="lede">${escaped(description)}</p>` : ""}${persona}</header>`;

const PALETTE_SHOWN = 10;

/** The colours of the charter's palette, as the stylesheet resolves them, for the card that stands for it. None without a system or a stylesheet. */
function paletteOf(project, system, tokens) {
  if (!system || tokens === null) return [];
  const values = resolvedValues(project).get(BASE_CONTEXT) ?? new Map();
  const { palette, roles } = charteOf(catalog(project), list(fm(system).primitives), citations(project));
  return (palette.length ? palette : roles).map((entry) => values.get(entry.name)).filter(Boolean).slice(0, PALETTE_SHOWN);
}

/** The first thing to open of a step: the first record the step counts in the review order, else the first still proposed, else its first record, else its first set. */
const firstOf = (each, order) => each.counted.filter((record) => order.includes(fm(record).id)).sort((a, b) => order.indexOf(fm(a).id) - order.indexOf(fm(b).id))[0] ?? each.counted[0] ?? each.proposed[0] ?? [...each.records].sort(byRecordId)[0] ?? null;
const hrefOf = (each, order) => {
  const record = firstOf(each, order);
  if (record) return pageNameOf(record);
  return each.sets.length ? variants.setFileOf(each.sets[0].id) : null;
};

/** The five steps as a stepper in order, each a link to the first thing to open, with its state in words. */
function stepperOf(held, labels, order) {
  const item = (each, at) => {
    const rest = restOf(labels, each);
    const state = each.count ? "todo" : rest.state;
    const word = each.count ? leftWordOf(labels, each) : rest.word;
    const href = hrefOf(each, order);
    const inner = `<span class="no">${at + 1}</span><span class="name">${labels.stepNames[each.step]}</span><span class="state">${escaped(word)}</span>`;
    return `<li data-step="${each.step}" data-state="${state}">${href ? `<a href="${escaped(href)}">${inner}</a>` : `<span class="cell">${inner}</span>`}</li>`;
  };
  return `<ol class="stepper">${held.map(item).join("")}</ol>`;
}

/** The line that says what awaits review, with the way in: a primary link to the first step that has work.
 * The lede carries its words as templates, and each step its name, its proposed count and where to open it with no
 * record left to review, so the page script words and aims it again as verdicts are given. */
function reviewLineOf(held, labels, order) {
  const waiting = held.filter((each) => each.todo);
  const proposed = held.filter((each) => each.proposed.length);
  const agreeing = (template) => filled(template, { count: proposed.reduce((sum, each) => sum + each.proposed.length, 0), steps: proposed.map((each) => labels.stepNames[each.step]).join(", ") });
  const steps = held.map((each) => ({ step: each.step, name: labels.stepNames[each.step], proposed: each.proposed.length, rest: hrefOf({ ...each, counted: [] }, order) }));
  const words = ` data-next="${escaped(labels.overviewNext)}" data-agree="${escaped(labels.overviewAgree)}" data-only="${escaped(labels.overviewProposed)}" data-nothing="${escaped(labels.nothing)}" data-steps="${escaped(JSON.stringify(steps))}"`;
  if (!waiting.length && proposed.length) return `<p class="lede"${words}>${escaped(agreeing(labels.overviewProposed))}</p>`;
  if (!waiting.length) return `<p class="lede"${words}>${labels.nothing}</p>`;
  const review = filled(labels.overviewNext, { count: waiting.reduce((sum, each) => sum + each.todo, 0), steps: waiting.map((each) => labels.stepNames[each.step]).join(", ") });
  const text = proposed.length ? `${review} ${agreeing(labels.overviewAgree)}` : review;
  const first = held.find((each) => each.count);
  return `<p class="lede"${words}>${escaped(text)}</p><p class="start-row"><a class="start" href="${escaped(hrefOf(first, order))}">${labels.start}</a></p>`;
}

/** A static thumbnail of a record's shown state, sketched for a wireframe: no script runs in it, it loads when scrolled near,
 * and assistive technology skips it. A record with no render is a plain blank box. `size` is `s` for a strip, `l` for a card. */
function thumbOf(project, record, tokens, labels, size) {
  if (!record || !hasRender(project, record)) return `<span class="thumb ${size} blank" aria-hidden="true"></span>`;
  const doc = stateDocument(text(project, renderOf(record)), tokens, shownState(record), fm(record).kind === "wireframe");
  return `<span class="thumb ${size}" aria-hidden="true"><iframe tabindex="-1" loading="lazy" sandbox title="${escaped(titleOf(project, record, labels))}" srcdoc="${escaped(doc)}"></iframe></span>`;
}

/** The overview: under the stepper, a section per step that holds something, in step order. Journeys are cards with a strip of
 * their screens, the identity and the charter one card each, the elements small cards by category, the screens a grid of
 * thumbnails. Every number is the drawer's: `counted` marks what the step counts, `orderedStates` the progress. */
function overviewOf({ project, held, records, rows, labels, tokens, palette, order }) {
  const recordOf = (id) => records.find((record) => fm(record).id === id);
  const dresserOf = (id) => records.filter((record) => fm(record).kind === "screen" && fm(record).wireframe === id).sort(byRecordId)[0];
  const dressed = new Set(records.filter((record) => fm(record).kind === "screen" && fm(record).wireframe).map((record) => fm(record).wireframe));
  const counted = new Set(held.flatMap((each) => each.counted).map((record) => fm(record).id));
  const progressOf = (record) => {
    const states = orderedStates(rows, record);
    const done = settledOf(states);
    return states.length ? `<span class="progress" data-record="${escaped(fm(record).id)}" data-base="${done}" data-total="${states.length}">${done}/${states.length}</span>` : "";
  };
  const markOf = (record) => {
    const id = fm(record).id;
    const todo = counted.has(id) ? `<span class="mark todo" data-record="${escaped(id)}">${labels.toReviewMark}</span>` : "";
    const rework = orderedStates(rows, record).some(({ verdict }) => verdict.current === "revise") ? `<span class="mark rework" data-record="${escaped(id)}">${labels.toReworkMark}</span>` : "";
    return todo + rework;
  };
  const tile = (record, visual) => `<li data-id="${escaped(fm(record).id)}"><a class="ovcard" href="${escaped(pageNameOf(record))}">${visual}<span class="title">${escaped(titleOf(project, record, labels))}</span><span class="meta">${markOf(record)}${progressOf(record)}</span></a></li>`;
  const journeyTile = (record) => {
    const steps = table(record.sections[STEPS_SECTION]);
    const faces = steps.map((row) => {
      const target = recordOf(row.Screen);
      return thumbOf(project, target && fm(target).kind === "wireframe" ? dresserOf(fm(target).id) ?? target : target, tokens, labels, "s");
    });
    const waiting = unvalidated(record);
    const status = `<span class="chip" data-status="${escaped(fm(record).status ?? "")}">${escaped(waiting ? labels.awaitingAgreement : statusLabel(labels, fm(record).status))}</span>`;
    return `<li data-id="${escaped(fm(record).id)}"><a class="ovcard" href="${escaped(pageNameOf(record))}"><span class="strip" aria-hidden="true">${faces.join("")}</span><span class="title">${escaped(titleOf(project, record, labels))}</span><span class="meta">${status}<span>${escaped(filled(labels.stepsCount, { count: steps.length }))}</span></span></a></li>`;
  };
  const charterTile = (record) => tile(record, palette.length ? `<span class="palette" aria-hidden="true">${palette.map((colour) => `<i style="background: ${escaped(colour)}"></i>`).join("")}</span>` : "");
  const setProgress = (set) => `<span class="progress" data-set="${escaped(set.id)}" data-label="${escaped(labels.decided)}" data-total="${variants.latestOf(set.variants).length}">0/${variants.latestOf(set.variants).length} ${escaped(labels.decided)}</span>`;
  const setTile = (set) => `<li data-set="${escaped(set.id)}"><a class="ovcard" href="${escaped(variants.setFileOf(set.id))}"><span class="thumb l sets" aria-hidden="true"><b>${variants.latestOf(set.variants).length}</b></span><span class="title">${escaped(set.title)}</span><span class="meta"><span class="mark todo">${labels.variantsToChoose}</span>${setProgress(set)}</span></a></li>`;
  const setRow = (set) => `<li data-set="${escaped(set.id)}"><a href="${escaped(variants.setFileOf(set.id))}">${escaped(set.title)}</a><span class="mark todo">${labels.variantsToChoose}</span>${setProgress(set)}</li>`;
  const listRow = (record) => recordLine(record, titleOf(project, record, labels), markOf(record) + progressOf(record));
  const group = (category, own) => {
    const states = own.flatMap((record) => orderedStates(rows, record));
    const done = settledOf(states);
    const sum = states.length ? `<span class="sum">${done}/${states.length}</span><span class="bar" aria-hidden="true"><i style="inline-size: ${Math.round((100 * done) / states.length)}%"></i></span>` : "";
    return `<div class="group" data-sum><h4 data-category="${category}"><span>${labels.categories[category]}</span>${sum}</h4><ul class="ovcards comps">${own.map((record) => tile(record, thumbOf(project, record, tokens, labels, "m"))).join("")}</ul></div>`;
  };
  const body = (each) => {
    if (each.step === "journeys") return `<ul class="ovcards journeys">${[...each.records].sort(byRecordId).map(journeyTile).join("")}</ul>`;
    if (each.step === "identity") return `<ul class="ovcards">${[...each.records].sort(byRecordId).map((record) => tile(record, "")).join("")}</ul>`;
    if (each.step === "foundations") return `<ul class="ovcards">${[...each.records].sort(byRecordId).map(charterTile).join("")}</ul>`;
    if (each.step === "components") return CATEGORIES.flatMap((category) => { const own = each.records.filter((record) => categoryOf(record) === category).sort(byRecordId); return own.length ? [group(category, own)] : []; }).join("") + (each.open.length ? `<ul class="rows">${each.open.map(setRow).join("")}</ul>` : "");
    const groups = screenGroupsOf(each.records, records.filter((record) => fm(record).kind === "journey")).map((own) => ({ ...own, records: own.records.filter((record) => !own.sketches.has(fm(record).id) && !dressed.has(fm(record).id)) })).filter((own) => own.records.length);
    const named = groups.some((own) => own.journey);
    const grids = groups.map((own) => `${named ? `<h4 data-journey="${own.journey ? escaped(fm(own.journey).id) : ""}">${own.journey ? escaped(titleOf(project, own.journey)) : labels.outOfJourney}</h4>` : ""}<ul class="ovcards screens">${own.records.map((record) => tile(record, thumbOf(project, record, tokens, labels, "l"))).join("")}</ul>`);
    const sketches = each.records.filter((record) => dressed.has(fm(record).id)).sort(byRecordId);
    const apart = sketches.length ? `<details class="sketches"><summary>${escaped(filled(labels.sketchesCount, { count: sketches.length }))}</summary><ul class="rows">${sketches.map(listRow).join("")}</ul></details>` : "";
    return grids.join("") + apart + (each.open.length ? `<ul class="ovcards screens">${each.open.map(setTile).join("")}</ul>` : "");
  };
  const section = (each) => `<section class="ov-step" data-step="${each.step}"><h3>${labels.stepNames[each.step]}${each.count ? `<span>${each.count}</span>` : ""}</h3>${body(each)}</section>`;
  return [stepperOf(held, labels, order), `<div class="overview">${held.filter((each) => each.records.length || each.open.length).map(section).join("")}</div>`].join("\n");
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
 * `tokens` is the stylesheet text or null, `captures` the png paths beside
 * the records, relative to the design system folder. */
function showcaseOf({ project, tokens, captures, lang, sets: found = [] }) {
  const language = languageOf(lang);
  const labels = LABELS[language];
  const records = placed(project).filter((record) => fm(record).kind !== REVIEW_KIND && fm(record).id);
  const recordsById = new Map();
  // an id cited by a record names what a journey passes through, so a journey sharing it comes last
  for (const record of [...records].sort((a, b) => (fm(a).kind === "journey") - (fm(b).kind === "journey"))) if (!recordsById.has(fm(record).id)) recordsById.set(fm(record).id, record);
  const sets = found.map((set) => ({ ...set, title: recordsById.has(set.id) ? titleOf(project, recordsById.get(set.id), labels) : variants.setTitleOf(set) }));
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
  const order = reviewOrderOf(held, journeys);
  const drawer = (current) => drawerOf({ project, held, here: hereOf(held, records, sets, current), rows, labels, current, order });
  const palette = paletteOf(project, system, tokens);
  const home = [`<header class="head"><h1>${labels.title}</h1>${reviewLineOf(held, labels, order)}</header>`, overviewOf({ project, held, records, rows, labels, tokens, palette, order })].join("\n");
  const pages = { "index.html": pageOf({ title: labels.title, lang: language, navigation: navigationOf(project, records, labels, null, sets, rows, sectionsById), body: home, drawer: drawer(null), script: PANEL }) };
  for (const record of records) {
    const id = fm(record).id;
    const uses = [...new Set(cited(record))].filter((each) => each !== id && recordsById.has(each)).sort(byCode);
    const element = isElement(record) && fm(record).kind !== "screen"; // a component's page names only what builds on it, not what replaces it or what a journey cites
    const usedBy = [...new Set(records.filter((other) => fm(other).id !== id && (element ? list(fm(other).uses) : cited(other)).includes(id)).map((other) => fm(other).id))].filter((each, _, all) => !(element && fm(recordsById.get(each)).kind === "wireframe" && all.some((other) => fm(recordsById.get(other)).wireframe === each))).sort(byCode);
    const reviewed = hasRender(project, record);
    const title = titleOf(project, record, labels);
    const journey = fm(record).kind === "journey";
    const bars = barsOf({ project, record, journeys, recordsById, labels });
    const body = [
      headOf({ record, title, description: descriptionOf(project, record), persona: journey ? personaOf(record, labels) : "", labels }),
      assetImageOf({ project, record, labels }),
      twinOf(record, records, labels),
      ...bars,
      journey ? "" : linksOf("uses", labels.uses, uses.map((each) => recordsById.get(each)), (each) => titleOf(project, each, labels)),
      journey ? journeyOf({ project, record, recordsById, tokens, labels }) : "",
      reviewed ? reviewOf({ project, system, record, rows, tokens, captures, labels }) : "",
      sectionsById.has(id) ? sectionsById.get(id).map(sectionHtml).join("\n") : specOf(project, record, labels),
      appearsOf({ project, ids: usedBy, recordsById, labels }),
    ].filter(Boolean).join("\n");
    const script = (reviewed ? FRAMES + PANEL + TABS + (widthOf(system, labels) ? WIDTH : "") : id === SYSTEM_ID ? FRAMES + PANEL : PANEL) + (bars.length ? JOURNEY_BARS : "");
    pages[pageNameOf(record)] = pageOf({ title, lang: language, navigation: navigationOf(project, records, labels, pageNameOf(record), sets, rows, sectionsById), body, drawer: drawer(pageNameOf(record)), script, wide: journey });
  }
  const wireframes = project.renders.filter((file) => file.startsWith(WIREFRAMES_DIR)).sort().slice(0, WIREFRAMES_SHOWN).map((file) => {
    const record = records.find((candidate) => renderOf(candidate) === file);
    return { path: file.slice(WIREFRAMES_DIR.length), title: record ? titleOf(project, record) : undefined, text: text(project, file) ?? "" };
  });
  for (const set of sets) {
    pages[variants.setFileOf(set.id)] = pageOf({ title: set.title, lang: language, navigation: navigationOf(project, records, labels, `${SET_CURRENT}${set.id}`, sets, rows, sectionsById), body: variants.setBodyOf({ set, tokens, labels, wireframes }), drawer: drawer(null), script: variants.SCRIPT + PANEL, wide: true });
  }
  return pages;
}

module.exports = { showcaseOf, stateDocument, copiedOf, decisionsOf, keptOf, WIDTH, entriesOf, blockedOf, remainingOf, pickedOf, nextToReviewOf, nextOpenOf, languageOf, LABELS };
