// V1 to V6: each component and screen has its HTML render, showing every variant and state
// through tokens alone.
const path = require("node:path");
const { list } = require("./markdown.cjs");
const { placed, systemOf, COMPONENT_KINDS } = require("./records.cjs");
const { cssNames } = require("./tokens.cjs");
const { text, RENDER_EXTENSION } = require("./project.cjs");

const RENDERED_KINDS = [...COMPONENT_KINDS, "screen"];
const RIGHT_TO_LEFT = "rtl";
const LINE_BREAK = "\n";

const CUSTOM_PROPERTY = /var\(\s*(--[\w-]+)/g;
const VAR_CALL = /var\([^()]*\)/g; // a fallback inside var() is the token's, not a literal
const QUERY_PRELUDE = /@(?:media|container)\b[^{]*/g; // a query's lengths are breakpoints, not styles

/** Literals a render or UI code must not hold, each with the message it earns. */
const PATTERNS = {
  colour: {
    regex: /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?)\(/g,
    message: (found) => `colour literal "${found}", use a token`,
  },
  unit: {
    regex: /(?<![\w#.-])-?(?:\d*\.)?\d+(?:px|rem|em|ms|s)\b/g,
    message: (found) => `literal "${found}", only tokens carry values`,
    strip: [VAR_CALL, QUERY_PRELUDE],
  },
  physical: {
    regex: /\b(?:margin|padding|border)-(?:left|right)\b|(?<![\w-])(?:left|right)(?=\s*:)|\btext-align\s*:\s*(?:left|right)\b|\bfloat\s*:\s*(?:left|right)\b/g,
    message: (found) => `physical property "${found}", use its logical form`,
  },
};

/** Each match of `pattern` in `text`, as `{line, message}`, lines numbered from 1. */
function findLiterals(text, pattern) {
  return text.split(LINE_BREAK).flatMap((line, index) => {
    const searched = (pattern.strip ?? []).reduce((kept, regex) => kept.replace(regex, ""), line);
    return [...searched.matchAll(pattern.regex)].map((match) => ({ line: index + 1, message: `line ${index + 1}: ${pattern.message(match[0])}` }));
  });
}

/** Whether the design system declares a right-to-left direction. */
const declaresRightToLeft = (project) => list(systemOf(project)?.frontMatter.directions).includes(RIGHT_TO_LEFT);

const renderOf = (record) => `${path.dirname(record.file)}/${record.frontMatter.id}${RENDER_EXTENSION}`;
const rendered = (project) => placed(project).filter((record) => RENDERED_KINDS.includes(record.frontMatter.kind) && record.frontMatter.id === record.name);
/** A render's text; empty when unreadable, which the loader reports once. */
const readRender = (project, file) => text(project, file) ?? "";

function presenceProblems(project) {
  return rendered(project)
    .filter((record) => !project.renders.includes(renderOf(record)))
    .map((record) => ({ file: record.file, message: `no render beside it, expected ${path.basename(renderOf(record))}` }));
}

function coverageProblems(project) {
  return rendered(project)
    .filter((record) => project.renders.includes(renderOf(record)))
    .flatMap((record) => {
      const html = text(project, renderOf(record));
      if (html === null) return [];
      const wanted = [...list(record.frontMatter.variants).map((value) => `data-variant="${value}"`), ...list(record.frontMatter.states).map((value) => `data-state="${value}"`)];
      return wanted.filter((attribute) => !html.includes(attribute)).map((attribute) => ({ file: renderOf(record), message: `no ${attribute}` }));
    });
}

function referenceProblems(project) {
  const names = cssNames(project);
  if (names === null) return [];
  return project.renders.flatMap((file) =>
    readRender(project, file)
      .split(LINE_BREAK)
      .flatMap((line, index) =>
        [...line.matchAll(CUSTOM_PROPERTY)]
          .filter((match) => !names.has(match[1]))
          .map((match) => ({ file, message: `line ${index + 1}: var(${match[1]}) names no token` }))
      )
  );
}

const literalProblems = (pattern, applies = () => true) => (project) =>
  applies(project) ? project.renders.flatMap((file) => findLiterals(readRender(project, file), pattern).map(({ message }) => ({ file, message }))) : [];

const RULES = [
  presenceProblems, // V1
  coverageProblems, // V2
  referenceProblems, // V3
  literalProblems(PATTERNS.colour), // V4
  literalProblems(PATTERNS.physical, declaresRightToLeft), // V5
  literalProblems(PATTERNS.unit), // V6
];

/** Every broken render rule, as `{file, message}`, in rule order. */
const check = (project) => RULES.flatMap((rule) => rule(project));

module.exports = { check, PATTERNS, findLiterals, declaresRightToLeft };
