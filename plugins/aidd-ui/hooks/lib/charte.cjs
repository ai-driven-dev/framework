// The charte of a design system: which section of the page each token belongs to. Pure, so the page and
// its navigation read one answer. A token is judged by its type and the words of its name, in the
// order of SECTIONS; whatever no section claims is "autres".
const PATH_SEPARATOR = ".";
const WORD_SEPARATOR = /[.-]/;

/** The sections a token can land in, in the order a page shows them and the order they claim a token. */
const SECTIONS = ["palette", "roles", "typographie", "espacements", "arrondis", "tailles", "autres"];

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

module.exports = { charteOf, SECTIONS };
