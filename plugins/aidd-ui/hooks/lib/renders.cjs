// V1 to V9: each component and screen has its HTML render, showing every variant, axis and state
// through the tokens its record declares alone, from the stylesheet generated out of the tokens.
const path = require("node:path");
const { list, blank, lineOf, LINE_BREAK } = require("./markdown.cjs");
const { placed, byId, tokensUsedBy, variantOf, TOKENED_KINDS } = require("./model.cjs");
const { PATTERNS, findLiterals, styled, painted, declaresRightToLeft } = require("./literals.cjs");
const { VAR_REFERENCE, customProperty } = require("./css.cjs");
const { cssNames } = require("./tokens.cjs");
const { text, checkOf, RENDER_EXTENSION, CSS_FILE } = require("./project.cjs");

const STYLESHEET_HREF = `../${CSS_FILE}`; // renders sit one folder below the generated stylesheet
const STYLESHEET_LINK = `<link rel="stylesheet" href="${STYLESHEET_HREF}">`;
const LINK_TAG = /<link\b[^>]*>/g;
const STYLE_BLOCK = /<style\b[^>]*>[\s\S]*?<\/style>/gi;

const NOT_MARKUP = /<!--[\s\S]*?-->|<(style|script)\b[\s\S]*?<\/\1\s*>/gi; // copy and code, not tags
const TAG = /<([a-z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
const QUOTED_VALUE = /"[^"]*"|'[^']*'/g;
const SWITCH_ATTRIBUTE = /\sdata-(theme|platform)(?![\w-])/gi; // what shows another theme or platform
const SWITCHED_ELEMENT = "html";

const DECLARED_PROPERTY = /(--[\w-]+)\s*:/g; // a property the render sets itself, not a token

const renderOf = (record) => `${path.dirname(record.file)}/${record.frontMatter.id}${RENDER_EXTENSION}`;
const rendered = (project) => placed(project).filter((record) => TOKENED_KINDS.includes(record.frontMatter.kind) && record.frontMatter.id === record.name);
/** A render's text; empty when unreadable, which the loader reports once. */
const readRender = (project, file) => text(project, file) ?? "";

function presenceProblems(project) {
  return rendered(project)
    .filter((record) => !project.renders.includes(renderOf(record)))
    .map((record) => ({ file: record.file, message: `no render beside it, expected ${path.basename(renderOf(record))}` }));
}

/** The attribute that shows a `variants` item on an element. */
function variantAttribute(item) {
  const { axis, value } = variantOf(item);
  return `data-${axis}="${value}"`;
}

function coverageProblems(project) {
  return rendered(project)
    .filter((record) => project.renders.includes(renderOf(record)))
    .flatMap((record) => {
      const html = text(project, renderOf(record))?.split(STYLE_BLOCK).join(""); // a selector in a style block shows nothing
      if (html === undefined) return [];
      const wanted = [...list(record.frontMatter.variants).map(variantAttribute), ...list(record.frontMatter.states).map((value) => `data-state="${value}"`)];
      return wanted.filter((attribute) => !html.includes(attribute)).map((attribute) => ({ file: renderOf(record), message: `no ${attribute}` }));
    });
}

function referenceProblems(project) {
  const tokens = cssNames(project);
  if (tokens === null) return [];
  return project.renders.flatMap((file) => {
    const html = readRender(project, file);
    const names = new Set([...tokens, ...[...html.matchAll(DECLARED_PROPERTY)].map((match) => match[1])]);
    return html
      .split(LINE_BREAK)
      .flatMap((line, index) =>
        [...line.matchAll(VAR_REFERENCE)]
          .filter((match) => !names.has(match[1]))
          .map((match) => ({ file, message: `line ${index + 1}: var(${match[1]}) names no token` }))
      );
  });
}

/** A render uses only the tokens its record declares, or the elements it shows declare, so an
 * impact report read from the records misses none of them. */
function declaredProblems(project) {
  const tokens = cssNames(project);
  if (tokens === null) return [];
  const index = byId(project);
  return rendered(project)
    .filter((record) => project.renders.includes(renderOf(record)))
    .flatMap((record) => {
      const declared = new Set(tokensUsedBy(index, record).map(customProperty));
      return readRender(project, renderOf(record))
        .split(LINE_BREAK)
        .flatMap((line, index) =>
          [...line.matchAll(VAR_REFERENCE)]
            .filter((match) => tokens.has(match[1]) && !declared.has(match[1]))
            .map((match) => ({ file: renderOf(record), message: `line ${index + 1}: var(${match[1]}) is a token ${record.frontMatter.id} does not declare` }))
        );
    });
}

/** A theme or a platform is shown by the document's own attribute, so it is set on `<html>` alone. */
function switchProblems(project) {
  return project.renders.flatMap((file) => {
    const markup = readRender(project, file).replace(NOT_MARKUP, blank);
    return [...markup.matchAll(TAG)]
      .filter(([, tag]) => tag.toLowerCase() !== SWITCHED_ELEMENT)
      .flatMap(({ 1: tag, 2: attributes, index }) =>
        [...attributes.replace(QUOTED_VALUE, "").matchAll(SWITCH_ATTRIBUTE)].map(([, kind]) => ({
          file,
          message: `line ${lineOf(markup, index)}: data-${kind.toLowerCase()} on <${tag.toLowerCase()}>, set it on <html> alone`,
        }))
      );
  });
}

/** Whether a render has a `<link>` that loads the generated stylesheet. */
const loadsStylesheet = (html) => (html.match(LINK_TAG) ?? []).some((tag) => tag.includes(`href="${STYLESHEET_HREF}"`));

/** A render takes its token values from the generated stylesheet, so a token change reaches it. */
function stylesheetProblems(project) {
  return rendered(project)
    .map(renderOf)
    .filter((file) => project.renders.includes(file) && text(project, file) !== null && !loadsStylesheet(text(project, file)))
    .map((file) => ({ file, message: `does not load ${STYLESHEET_HREF}, add ${STYLESHEET_LINK}` }));
}

const literalProblems = (pattern, { applies = () => true, scanned = styled } = {}) => (project) =>
  applies(project) ? project.renders.flatMap((file) => findLiterals(scanned(readRender(project, file)), pattern).map((found) => ({ file, ...found }))) : [];

const RULES = {
  V1: presenceProblems,
  V2: coverageProblems,
  V3: referenceProblems,
  V4: literalProblems(PATTERNS.colour, { scanned: painted }),
  V5: literalProblems(PATTERNS.physical, { applies: declaresRightToLeft }),
  V6: literalProblems(PATTERNS.unit),
  V7: declaredProblems,
  V8: stylesheetProblems,
  V9: switchProblems,
};

/** Every broken render rule, in rule order. */
const check = checkOf(RULES);

module.exports = { check, renderOf };
