// The literals a render or UI code must not hold, found line by line.
const { list, blank, LINE_BREAK } = require("./markdown.cjs");
const { systemOf } = require("./model.cjs");
const { ERROR, WARNING } = require("./project.cjs");

const RIGHT_TO_LEFT_LANGUAGES = ["ar", "he", "fa", "ur"]; // the languages of a locale written right to left
const LOCALE_SEPARATOR = /[-_]/;
const VAR_CALL = /var\([^()]*\)/g; // a fallback inside var() is the token's, not a literal
const QUERY_PRELUDE = /@(?:media|container)\b[^{]*/g; // a query's lengths are breakpoints, not styles
const HAIRLINE_PX = 2; // up to 2px: a border or outline width code keeps literal
const STYLE = /<style\b[^>]*>([\s\S]*?)<\/style>|\sstyle\s*=\s*"([^"]*)"|\sstyle\s*=\s*'([^']*)'/gid; // a style block, or a style attribute's value
const PAINT = /\s(?:fill|stroke|color|bgcolor)\s*=\s*(?:"([^"]*)"|'([^']*)')/gid; // an attribute's value that may hold a colour
const TOKEN_VALUE = /^\s*var\(/;

/** Literals a render or UI code must not hold, each with the message it earns. */
const PATTERNS = {
  colour: {
    regex: /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?)\(/g,
    message: (found) => `colour literal "${found}", use a token`,
  },
  unit: {
    regex: /(?<![\w#.-])-?(?:\d*\.)?\d+(?:px|rem|em|ms|s)\b/g,
    message: (found) => `literal "${found}", only tokens carry values`,
    severity: (found) => (found.endsWith("px") && Math.abs(parseFloat(found)) <= HAIRLINE_PX ? WARNING : ERROR),
    strip: [VAR_CALL, QUERY_PRELUDE],
  },
  physical: {
    regex: /\b(?:margin|padding|border)-(?:left|right)\b|(?<![\w-])(?:left|right)(?=\s*:)|\btext-align\s*:\s*(?:left|right)\b|\bfloat\s*:\s*(?:left|right)\b/g,
    message: (found) => `physical property "${found}", use its logical form`,
  },
};

/** `source` with what `regex` captures passed through `own` and the rest through `other`; lines are kept. */
function split(source, regex, other, own = (kept) => kept) {
  let kept = "";
  let at = 0;
  for (const match of source.matchAll(regex)) {
    const [start, end] = match.indices.slice(1).find(Boolean);
    kept += other(source.slice(at, start)) + own(source.slice(start, end));
    at = end;
  }
  return kept + other(source.slice(at));
}

/** `source` with its style blocks and style attribute values kept and the rest passed through
 * `other`, blanked by default, so the patterns read styles and not copy. */
const styled = (source, other = blank) => split(source, STYLE, other);

/** A render as the colour pattern reads it: its styles, plus the values of its colour attributes
 * that are no token. */
const painted = (source) => styled(source, (rest) => split(rest, PAINT, blank, (value) => (TOKEN_VALUE.test(value) ? blank(value) : value)));

/** Each match of `pattern` in `text`, as `{severity, message}`, lines numbered from 1. */
function findLiterals(text, pattern) {
  return text.split(LINE_BREAK).flatMap((line, index) => {
    const searched = (pattern.strip ?? []).reduce((kept, regex) => kept.replace(regex, ""), line);
    return [...searched.matchAll(pattern.regex)].map(([found]) => ({ severity: pattern.severity?.(found) ?? ERROR, message: `line ${index + 1}: ${pattern.message(found)}` }));
  });
}

/** Whether a locale of the design system is written right to left, as its language says. */
const declaresRightToLeft = (project) =>
  list(systemOf(project)?.frontMatter.locales).some((locale) => RIGHT_TO_LEFT_LANGUAGES.includes(locale.split(LOCALE_SEPARATOR)[0].toLowerCase()));

module.exports = { PATTERNS, findLiterals, styled, painted, declaresRightToLeft };
