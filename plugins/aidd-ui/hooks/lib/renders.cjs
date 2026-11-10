// V1 to V12: each component and screen has its HTML render, showing every variant, axis and state
// through the tokens its record declares alone, from the stylesheet generated out of the tokens; a
// wireframe's shows every state and zone, and no style at all. A screen's also keeps its text
// readable (V11), on its own background or on the one an ancestor lays behind it, and its controls
// large enough to touch (V12).
const path = require("node:path");
const { list, blank, lineOf, escapeRegex, LINE_BREAK } = require("./markdown.cjs");
const { placed, byId, tokensUsedBy, variantOf, systemOf, fm, TOKENED_KINDS } = require("./model.cjs");
const { PATTERNS, findLiterals, styled, painted, declaresRightToLeft } = require("./literals.cjs");
const { VAR_REFERENCE, customProperty, rulesOf } = require("./css.cjs");
const { cssNames, resolvedValues, blockers } = require("./tokens.cjs");
const { parse, over, contrast } = require("./colour.cjs");
const { platformsOf, platformEntries } = require("./code.cjs");
const { text, checkOf, RENDER_EXTENSION, CSS_FILE } = require("./project.cjs");

const STYLESHEET_HREF = `../${CSS_FILE}`; // renders sit one folder below the generated stylesheet
const STYLESHEET_LINK = `<link rel="stylesheet" href="${STYLESHEET_HREF}">`;
const LINK_TAG = /<link\b[^>]*>/g;
const STYLE_BLOCK = /<style\b[^>]*>[\s\S]*?<\/style>/gi;

const NOT_MARKUP = /<!--[\s\S]*?-->|<(style|script)\b[\s\S]*?<\/\1\s*>/gi; // copy and code, not tags
const TAG = /<([a-z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
const TAG_OR_END = /<(\/?)([a-z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
const VOID_TAGS = ["meta", "link", "input", "img"]; // the ones renders use: they close nothing
const BODY = "body";
const PSEUDO = /:+[\w-]+/g; // a pseudo-class or pseudo-element restricts nothing here
const PSEUDO_ELEMENT = "::";
const STATE = /[[:]/; // a selector that holds only in a state
const QUOTED_VALUE = /"[^"]*"|'[^']*'/g;
const SWITCH_ATTRIBUTE = /\sdata-(theme|platform)(?![\w-])/gi; // what shows another theme or platform
const SWITCHED_ELEMENT = "html";

const DECLARED_PROPERTY = /(--[\w-]+)\s*:/g; // a property the render sets itself, not a token
const WIREFRAME = "wireframe";
// What dresses a render, each with the excerpt it names: a wireframe is structure only.
const STYLES = [
  [/<style\b/i, "<style"],
  [/<link\b[^>]*\brel\s*=\s*["']?stylesheet\b/i, "<link"],
  [/\sstyle\s*=/i, "style="],
];
const COMMENT = /<!--[\s\S]*?-->/g;

const CONTRAST_MINIMUM = 4.5;
const TOUCH_FLOOR = 24; // px
const TOUCH_KEY = "touch-target";
const REM = 16; // px, the browser's default
const DEFAULT_PLATFORM = "default";
const BASE_CONTEXT = ""; // the key of `resolvedValues` for the base
const SIZES = ["height", "min-height", "block-size", "min-block-size"];
const INTERACTIVE = ["button", "a", "input", "select", "textarea"];
const STYLE_TAGS = /^<style\b[^>]*>|<\/style>$/gi;
const DECLARATION = /([\w-]+)\s*:\s*([^;]+)/g;
const VAR_CALL = /var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g;
const LENGTH = /^(-?\d*\.?\d+)(px|rem)?$/;
const CLASS_ATTRIBUTE = /\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const ROLE_ATTRIBUTE = /\srole\s*=\s*["']?([a-z]+)/i;
const CONTROL_ROLES = ["link", "radio", "switch", "tab"];
const SELECTOR_FILTERS = /\[[^\]]*\]|"[^"]*"/g; // an attribute filter restricts nothing here

const renderOf = (record) => `${path.dirname(record.file)}/${record.frontMatter.id}${RENDER_EXTENSION}`;
const shownBy = (kinds) => (project) => placed(project).filter((record) => kinds.includes(record.frontMatter.kind) && record.frontMatter.id === record.name);
const rendered = shownBy(TOKENED_KINDS);
const shown = shownBy([...TOKENED_KINDS, WIREFRAME]); // every record with a render
const wireframeRenders = (project) => shownBy([WIREFRAME])(project).map(renderOf).filter((file) => project.renders.includes(file));
/** A render's text; empty when unreadable, which the loader reports once. */
const readRender = (project, file) => text(project, file) ?? "";

function presenceProblems(project) {
  return shown(project)
    .filter((record) => !project.renders.includes(renderOf(record)))
    .map((record) => ({ file: record.file, message: `no render beside it, expected ${path.basename(renderOf(record))}`, fix: "write the render beside it", excerpt: path.basename(renderOf(record)) }));
}

/** The attribute that shows a `variants` item on an element. */
function variantAttribute(item) {
  const { axis, value } = variantOf(item);
  return `data-${axis}="${value}"`;
}

function coverageProblems(project) {
  return shown(project)
    .filter((record) => project.renders.includes(renderOf(record)))
    .flatMap((record) => {
      const html = text(project, renderOf(record))?.split(STYLE_BLOCK).join(""); // a selector in a style block shows nothing
      if (html === undefined) return [];
      const wanted = [...list(record.frontMatter.variants).map(variantAttribute), ...list(record.frontMatter.states).map((value) => `data-state="${value}"`), ...list(record.frontMatter.zones).map((value) => `data-zone="${value}"`)];
      return wanted.filter((attribute) => !html.includes(attribute)).map((attribute) => ({ file: renderOf(record), message: `no ${attribute}`, fix: "add an element carrying it to the render", excerpt: attribute }));
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
          .map((match) => ({ file, message: `line ${index + 1}: var(${match[1]}) names no token`, fix: "cite a token that exists, or add the token", excerpt: `var(${match[1]})` }))
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
            .map((match) => ({ file: renderOf(record), message: `line ${index + 1}: var(${match[1]}) is a token ${record.frontMatter.id} does not declare`, fix: "add the token to the record's tokens", excerpt: `var(${match[1]})` }))
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
          fix: "set it on <html> alone",
          excerpt: `data-${kind.toLowerCase()}`,
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
    .map((file) => ({ file, message: `does not load ${STYLESHEET_HREF}, add ${STYLESHEET_LINK}`, fix: `add ${STYLESHEET_LINK}`, excerpt: STYLESHEET_HREF }));
}

function styleProblems(project) {
  return wireframeRenders(project).flatMap((file) =>
    readRender(project, file)
      .replace(COMMENT, blank)
      .split(LINE_BREAK)
      .flatMap((line, index) => STYLES.filter(([pattern]) => pattern.test(line)).map(([, excerpt]) => ({ file, message: `line ${index + 1}: a wireframe holds no style, remove it`, fix: "remove the style: the screen dressing the wireframe carries it", excerpt })))
  );
}

const literalProblems = (pattern, { applies = () => true, scanned = styled } = {}) => (project) =>
  applies(project) ? project.renders.flatMap((file) => findLiterals(scanned(readRender(project, file)), pattern).map(({ literal, ...found }) => ({ file, ...found }))) : [];

/** The screens whose render exists, with its text. */
const screenRenders = (project) =>
  shownBy(["screen"])(project)
    .filter((record) => project.renders.includes(renderOf(record)))
    .map((record) => ({ record, file: renderOf(record), html: readRender(project, renderOf(record)) }));

/** The rules of a render's style blocks outside any query, as `{selector, declarations}`. */
function rulesIn(html) {
  const css = [...html.matchAll(STYLE_BLOCK)].map(([block]) => block.replace(STYLE_TAGS, "")).join("\n");
  return rulesOf(css)
    .rules.filter(({ media }) => media === null)
    .map(({ selector, body }) => ({ selector, declarations: new Map([...body.matchAll(DECLARATION)].map(([, name, value]) => [name.toLowerCase(), value.trim()])) }));
}

/** Every token's resolved values; none while the tokens cannot generate a stylesheet, which T1 to T10 already name. */
const resolvedOf = (project) => (blockers(project).length ? new Map() : resolvedValues(project));

/** The values of the tokens in force in `context`, by custom property. */
const propertiesIn = (resolved, context) => new Map([...(resolved.get(context) ?? resolved.get(BASE_CONTEXT) ?? [])].map(([name, value]) => [customProperty(name), value]));
const withValues = (value, properties) => value.replace(VAR_CALL, (call, name) => properties.get(name) ?? call);
const backgroundOf = (declarations) => declarations.get("background-color") ?? declarations.get("background");
const selectorsOf = (selector) => selector.split(",").map((each) => each.trim());
const classesOf = (attributes) => (CLASS_ATTRIBUTE.exec(attributes)?.slice(1).find(Boolean) ?? "").split(/\s+/).filter(Boolean);

/** The elements of a render as `{tag, classes, parent}`, nested by their tags alone: a closing tag
 * closes the last one open. */
function elementsIn(html) {
  const open = [];
  const elements = [];
  for (const [, closing, tag, attributes] of html.replace(NOT_MARKUP, blank).matchAll(TAG_OR_END)) {
    if (closing) open.pop();
    else {
      const element = { tag: tag.toLowerCase(), classes: classesOf(attributes), parent: open.at(-1) };
      elements.push(element);
      if (!VOID_TAGS.includes(element.tag)) open.push(element);
    }
  }
  return elements;
}

/** A selector's chains, each from its outermost compound to the one it targets, as `{tag, classes}`.
 * `>` reads as a descendant. */
const chainsOf = (selector) =>
  selectorsOf(selector.replace(SELECTOR_FILTERS, "").replace(PSEUDO, "")).map((each) =>
    each.split(/\s*>\s*|\s+/).map((compound) => ({ tag: /^[a-z][\w-]*/i.exec(compound)?.[0].toLowerCase(), classes: [...compound.matchAll(/\.([\w-]+)/g)].map(([, name]) => name) }))
  );

const fits = ({ tag, classes }, element) => (tag === undefined || tag === element.tag) && classes.every((name) => element.classes.includes(name));

/** Whether an element is the target of a chain: each compound before the last fits an ancestor. */
function reaches(chain, element) {
  if (!fits(chain.at(-1), element)) return false;
  let above = element.parent;
  for (const compound of chain.slice(0, -1).reverse()) {
    while (above && !fits(compound, above)) above = above.parent;
    if (!above) return false;
    above = above.parent;
  }
  return true;
}

/** What a value reads as once its tokens are resolved, beside what the render wrote. */
const shownAs = (written, value) => (written === value ? written : `${written} (${value})`);

/** The colour behind a render: its `body` background, when opaque. */
function backdropOf(rules, properties) {
  const written = rules.filter(({ selector }) => selectorsOf(selector).includes("body")).map(({ declarations }) => backgroundOf(declarations)).filter(Boolean).at(-1);
  const colour = written === undefined ? null : parse(withValues(written, properties));
  return colour?.a === 1 ? colour : null;
}

/** The ratio of a text over a background, the background composed over the body's when translucent;
 * null when it has nothing to lie on. */
function ratioOf(top, below, backdrop) {
  const back = below.a === 1 ? below : backdrop && over(below, backdrop);
  return back ? contrast(over(top, back), back) : null;
}

/** The backgrounds behind an element, nearest first, read from itself up to `body`. A state's is
 * read and the walk goes on; a transparent one is passed over; the first base one is the last read;
 * one in another notation ends the walk unread. */
function backgroundsBehind(element, rules, properties) {
  const found = [];
  for (let each = element; each; each = each.parent) {
    let stop = each.tag === BODY;
    for (const rule of rules.filter(({ chains }) => chains.some((chain) => reaches(chain, each)))) {
      const written = backgroundOf(rule.declarations);
      const value = withValues(written, properties);
      const colour = parse(value);
      if (colour === null) stop = true;
      else if (colour.a > 0) {
        found.push({ rule, written, value, colour });
        if (!STATE.test(rule.selector)) stop = true;
      }
    }
    if (stop) break;
  }
  return found;
}

/** A pair's text and background are read once their tokens are resolved, a translucent background
 * over the body's. A text with a colour alone is read on each background behind the elements its
 * rule targets, one finding per background rule, except one a base pair targets: that pair reads
 * it alone. Any other notation leaves it unchecked. */
function contrastProblems(project) {
  const resolved = resolvedOf(project);
  const themes = list(systemOf(project)?.frontMatter.themes);
  return screenRenders(project).flatMap(({ file, html }) => {
    const rules = rulesIn(html);
    const elements = elementsIn(html);
    const grounded = rules.filter(({ selector, declarations }) => !selector.includes(PSEUDO_ELEMENT) && backgroundOf(declarations) !== undefined).map((rule) => ({ ...rule, chains: chainsOf(rule.selector) }));
    const pairs = grounded.filter(({ selector, declarations }) => declarations.has("color") && !STATE.test(selector));
    return (themes.length ? themes : [null]).flatMap((theme) => {
      const properties = propertiesIn(resolved, `:root[data-theme="${theme}"]`);
      const backdrop = backdropOf(rules, properties);
      const found = (selector, said, ratio) => [{ file, message: `${theme ?? "base"}: ${selector}: ${said} is ${ratio.toFixed(2)}:1, below ${CONTRAST_MINIMUM}`, fix: `use tokens whose contrast reaches ${CONTRAST_MINIMUM}:1`, excerpt: selector }];
      return rules.flatMap(({ selector, declarations }) => {
        const [written, behind] = [declarations.get("color"), backgroundOf(declarations)];
        if (written === undefined) return [];
        const text = withValues(written, properties);
        const top = parse(text);
        if (top === null) return [];
        if (behind === undefined) {
          if (selector.includes(PSEUDO_ELEMENT)) return [];
          const chains = chainsOf(selector);
          const backgrounds = new Map(elements.filter((element) => chains.some((chain) => reaches(chain, element)) && !pairs.some((pair) => pair.chains.some((chain) => reaches(chain, element)))).flatMap((element) => backgroundsBehind(element, grounded, properties)).map((each) => [each.rule, each]));
          return [...backgrounds.values()].flatMap(({ rule, written: shown, value, colour }) => {
            const ratio = ratioOf(top, colour, backdrop);
            return ratio === null || ratio >= CONTRAST_MINIMUM ? [] : found(selector, `${shownAs(written, text)} on ${shownAs(shown, value)} behind ${rule.selector}`, ratio);
          });
        }
        const background = withValues(behind, properties);
        const below = parse(background);
        const ratio = below === null ? null : ratioOf(top, below, backdrop);
        return ratio === null || ratio >= CONTRAST_MINIMUM ? [] : found(selector, `${shownAs(written, text)} on ${shownAs(behind, background)}`, ratio);
      });
    });
  });
}

/** The interactive elements of a render, as `{tag, classes}`. */
function interactiveIn(html) {
  return [...html.replace(NOT_MARKUP, blank).matchAll(TAG)]
    .map(({ 1: tag, 2: attributes }) => ({ tag: tag.toLowerCase(), classes: classesOf(attributes), role: CONTROL_ROLES.includes(ROLE_ATTRIBUTE.exec(attributes)?.[1].toLowerCase()) }))
    .filter(({ tag, role }) => role || INTERACTIVE.includes(tag));
}

/** Whether a selector names an element's tag or one of its classes. */
function targets(selector, { tag, classes }) {
  return selectorsOf(selector.replace(SELECTOR_FILTERS, "")).some((each) => new RegExp(`(?<![\\w.#:-])${escapeRegex(tag)}(?![\\w-])`).test(each) || classes.some((name) => new RegExp(`\\.${escapeRegex(name)}(?![\\w-])`).test(each)));
}

/** A length in px; null for a unit or a notation it does not read. A bare number is px. */
function pixels(value) {
  const found = LENGTH.exec(value);
  return found === null ? null : Number(found[1]) * (found[2] === "rem" ? REM : 1);
}

/** The floor of a screen: the highest of its platforms' as a pair `[platform, px]`. */
function floorOf(project, record) {
  const raised = new Map(platformEntries(project, TOUCH_KEY).map(({ platform, path: floor }) => [platform, Number(floor)]));
  const own = list(fm(record).platforms);
  const floors = (own.length ? own : platformsOf(project)).map((platform) => [platform, Math.max(TOUCH_FLOOR, raised.get(platform) ?? 0)]);
  return floors.reduce((best, each) => (each[1] > best[1] ? each : best), floors[0] ?? [DEFAULT_PLATFORM, TOUCH_FLOOR]);
}

/** A target is read from its rule's declared height alone: an undeclared size is not checked. */
function targetProblems(project) {
  const properties = propertiesIn(resolvedOf(project), BASE_CONTEXT);
  return screenRenders(project).flatMap(({ record, file, html }) => {
    const [platform, floor] = floorOf(project, record);
    const elements = interactiveIn(html);
    return rulesIn(html).flatMap(({ selector, declarations }) => {
      const sizes = SIZES.filter((name) => declarations.has(name)).map((name) => [name, pixels(withValues(declarations.get(name), properties))]).filter(([, size]) => size !== null);
      const [name, size] = sizes.reduce((best, each) => (each[1] > best[1] ? each : best), sizes[0] ?? [null, Infinity]);
      const element = elements.find((each) => targets(selector, each));
      if (size >= floor || element === undefined) return [];
      return [{ file, message: `${element.tag} (${selector}): ${name} ${size}px is below the ${floor}px floor of ${platform}`, fix: `give it at least ${floor}px`, excerpt: selector }];
    });
  });
}

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
  V10: styleProblems,
  V11: contrastProblems,
  V12: targetProblems,
};

/** Every broken render rule, in rule order. */
const check = checkOf(RULES);

module.exports = { check, renderOf };
