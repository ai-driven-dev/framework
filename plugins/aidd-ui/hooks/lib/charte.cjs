// The charte of a design system: which section of the page each token belongs to. Pure, so the page and
// its navigation read one answer. A token is judged by its type and the words of its name, in the
// order of SECTIONS; whatever no section claims is "autres". "points-de-rupture" claims no token: the page
// fills it from the breakpoints system.md declares.
const { parse, over, contrast } = require("./colour.cjs");

const PATH_SEPARATOR = ".";
const WORD_SEPARATOR = /[.-]/;

/** The sections a token can land in, in the order a page shows them and the order they claim a token. */
const SECTIONS = ["roles", "palette", "typographie", "espacements", "arrondis", "tailles", "points-de-rupture", "autres"];

const TYPE_WORDS = ["font", "type", "text"];
const SPACE_WORDS = ["space", "spacing", "gap", "inset", "padding", "margin"];
const RADIUS_WORDS = ["radius", "corner", "round"];
const SIZE_WORDS = ["size", "height", "width", "touch", "control"];
const LINE_HEIGHT = /(^|\.)line-height(\.|$)/;

const wordsOf = (name) => name.split(WORD_SEPARATOR);
const hasWord = (name, words) => wordsOf(name).some((word) => words.includes(word));
const under = (name, groups) => groups.some((group) => name === group || name.startsWith(`${group}${PATH_SEPARATOR}`));

/** The section of one token. */
function sectionOf({ name, type }, primitives) {
  if (type === "color") return under(name, primitives) ? "palette" : "roles";
  if (type === "fontFamily" || type === "fontWeight") return "typographie";
  if (type === "number" && LINE_HEIGHT.test(name)) return "typographie";
  if (type !== "dimension") return "autres";
  if (hasWord(name, TYPE_WORDS)) return "typographie";
  if (hasWord(name, SPACE_WORDS)) return "espacements";
  if (hasWord(name, RADIUS_WORDS)) return "arrondis";
  if (hasWord(name, SIZE_WORDS)) return "tailles";
  return "autres";
}

/** The entries `{name, type, property}` of a catalog by section, each in its order. A role carries `cites`, the
 * tokens `citations` (name to names) says it reads. */
function charteOf(entries, primitives, citations) {
  const held = Object.fromEntries(SECTIONS.map((id) => [id, []]));
  for (const entry of entries) {
    const id = sectionOf(entry, primitives);
    held[id].push(id === "roles" ? { ...entry, cites: citations.get(entry.name) ?? [] } : entry);
  }
  return held;
}

const COLOUR_GROUP = /^color\./;
const TEXT_ROLE = /^text([.-]|$)/;
const TEXT_ON = /^text-on-(.+)$/;
const NON_TEXT_ROLE = /^(border|focus)([.-]|$)/;
const GROUNDS = ["background", "surface"];
const TEXT_RATIO = 4.5;
const LARGE_TEXT_RATIO = 3;
const NON_TEXT_RATIO = 3;

const keyOf = (name) => name.replace(COLOUR_GROUP, "");

/** What a ratio earns: "aa", "large" (AA for large text only) or "fail"; a non-text colour has no large-text step. */
const verdictOf = (ratio, nonText) => {
  if (ratio >= (nonText ? NON_TEXT_RATIO : TEXT_RATIO)) return "aa";
  return !nonText && ratio >= LARGE_TEXT_RATIO ? "large" : "fail";
};

/** The contrast of the roles, read from their names: a `text-on-X` role on the role `X`, any other `text` role and
 * any `border` or `focus` role on the background and the surface. `roles` are the entries of the roles section, `values`
 * the colour of each by name. `{columns, rows}`: the grounds in order of appearance, each text or non-text role as `{fg, cells}`
 * with a `{ratio, verdict}` per column, null where the pair is not one or a colour cannot be read. */
function contrastOf(roles, values) {
  const byKey = new Map(roles.map(({ name }) => [keyOf(name), name]));
  const pairs = roles.flatMap(({ name }) => {
    const key = keyOf(name);
    const on = TEXT_ON.exec(key);
    if (on) return byKey.has(on[1]) ? [{ fg: name, bgs: [byKey.get(on[1])], nonText: false }] : [];
    const nonText = NON_TEXT_ROLE.test(key);
    if (!nonText && !TEXT_ROLE.test(key)) return [];
    return [{ fg: name, bgs: GROUNDS.filter((ground) => byKey.has(ground)).map((ground) => byKey.get(ground)), nonText }];
  }).filter((pair) => pair.bgs.length);
  const columns = [...new Set(pairs.flatMap((pair) => pair.bgs))];
  const rows = pairs.map(({ fg, bgs, nonText }) => ({
    fg,
    nonText,
    cells: columns.map((bg) => {
      if (!bgs.includes(bg)) return null;
      const [front, back] = [parse(values.get(fg) ?? ""), parse(values.get(bg) ?? "")];
      if (!front || !back || back.a < 1) return null;
      const ratio = contrast(over(front, back), back);
      return { ratio, verdict: verdictOf(ratio, nonText) };
    }),
  }));
  return { columns, rows };
}

module.exports = { charteOf, contrastOf, SECTIONS };
