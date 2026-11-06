// The literals a render or UI code must not hold, found line by line.
const { list } = require("./markdown.cjs");
const { systemOf } = require("./model.cjs");
const { ERROR, WARNING } = require("./project.cjs");

const RIGHT_TO_LEFT = "rtl";
const VAR_CALL = /var\([^()]*\)/g; // a fallback inside var() is the token's, not a literal
const QUERY_PRELUDE = /@(?:media|container)\b[^{]*/g; // a query's lengths are breakpoints, not styles
const HAIRLINE_PX = 2; // up to 2px: a border or outline width code keeps literal
const LINE_BREAK = "\n";

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

/** Each match of `pattern` in `text`, as `{severity, message}`, lines numbered from 1. */
function findLiterals(text, pattern) {
  return text.split(LINE_BREAK).flatMap((line, index) => {
    const searched = (pattern.strip ?? []).reduce((kept, regex) => kept.replace(regex, ""), line);
    return [...searched.matchAll(pattern.regex)].map(([found]) => ({ severity: pattern.severity?.(found) ?? ERROR, message: `line ${index + 1}: ${pattern.message(found)}` }));
  });
}

/** Whether the design system declares a right-to-left direction. */
const declaresRightToLeft = (project) => list(systemOf(project)?.frontMatter.directions).includes(RIGHT_TO_LEFT);

module.exports = { PATTERNS, findLiterals, declaresRightToLeft };
