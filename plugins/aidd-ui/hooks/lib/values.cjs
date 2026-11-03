// A token value of the code, a CSS string or a number of a script, as the DTCG token it stands for.
// The inverse of css.cjs's writers, for the few shapes real token files hold: a hex or numeric
// rgb() colour, a length in px or rem, a duration, a lone var(). Anything else is raw CSS, which
// the stylesheet writes back verbatim; it carries a `$type` only when it is a colour function or a
// font stack, since DTCG has no value for those.
const { VAR_REFERENCE } = require("./css.cjs");

const NUMBER = "[+-]?(?:\\d+\\.?\\d*|\\.\\d+)";
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB = new RegExp(`^rgba?\\(\\s*(${NUMBER})(?:\\s*,\\s*|\\s+)(${NUMBER})(?:\\s*,\\s*|\\s+)(${NUMBER})(?:\\s*[,/]\\s*(${NUMBER}))?\\s*\\)$`, "i");
const LENGTH = new RegExp(`^(${NUMBER})(px|rem)$`);
const TIME = new RegExp(`^(${NUMBER})(ms|s)$`);
const LONE_VAR = /^var\(\s*(--[\w-]+)\s*\)$/;
const COLOUR_FUNCTION = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i;
const FONT_STACK_ITEM = /^(?:"[^"]*"|'[^']*'|[A-Za-z_-][\w -]*)$/;
const GENERIC_FAMILIES = ["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "emoji", "math", "fangsong"];
const SIZE_WORDS = ["size", "radius", "space", "spacing"]; // a bare number of a script is a px length when its key holds one of these
const WORD_SEPARATOR = "-";
const BYTE = 255;
const PRECISION = 4;
const WHITESPACE = /\s+/g;

const channel = (byte) => Number((byte / BYTE).toFixed(PRECISION));
const hex6 = (bytes) => `#${bytes.map((byte) => Math.round(byte).toString(16).padStart(2, "0")).join("")}`;

/** A colour as `{colorSpace, components, alpha?, hex?}`: an opaque one keeps its hex. */
function colour(bytes, alpha, hex) {
  const value = { colorSpace: "srgb", components: bytes.map(channel) };
  if (alpha < 1) return { ...value, alpha };
  return { ...value, hex: hex ?? hex6(bytes) };
}

function fromHex(digits) {
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
  const bytes = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16));
  const alpha = full.length === 8 ? channel(parseInt(full.slice(6), 16)) : 1;
  return colour(bytes, alpha, `#${full.slice(0, 6).toLowerCase()}`);
}

/** Whether a value is a font family list: names, quoted or not, ending the way CSS lets it. */
function isFontStack(value) {
  const items = value.split(",").map((item) => item.trim());
  return items.every((item) => FONT_STACK_ITEM.test(item)) && items.some((item) => GENERIC_FAMILIES.includes(item));
}

/** A CSS value of the code as `{kind, ...}`: `kind` is `value` (`type`, `value`), `alias` (`alias`, a
 * CSS name) or `raw` (`raw`, and a `type` for a colour function or a font stack). `css` is the value
 * as CSS, to write it back verbatim where a DTCG value cannot stand. */
function fromCss(text) {
  const css = text.trim().replace(WHITESPACE, " ");
  const alias = LONE_VAR.exec(css);
  if (alias) return { kind: "alias", alias: alias[1], css };
  const hex = HEX.exec(css);
  if (hex) return { kind: "value", type: "color", value: fromHex(hex[1]), css };
  const rgb = RGB.exec(css);
  if (rgb) return { kind: "value", type: "color", value: colour(rgb.slice(1, 4).map(Number), rgb[4] === undefined ? 1 : Number(rgb[4])), css };
  for (const [pattern, type] of [[LENGTH, "dimension"], [TIME, "duration"]]) {
    const measure = pattern.exec(css);
    if (measure) return { kind: "value", type, value: { value: Number(measure[1]), unit: measure[2] }, css };
  }
  if (COLOUR_FUNCTION.test(css)) return { kind: "raw", type: "color", raw: css, css };
  return isFontStack(css) ? { kind: "raw", type: "fontFamily", raw: css, css } : { kind: "raw", raw: css, css };
}

/** The custom properties a raw value cites. */
const citedProperties = (raw) => [...raw.matchAll(VAR_REFERENCE)].map((match) => match[1]);

/** A bare number of a script under `name`, a CSS name without its dashes: a px length when the name
 * holds a size, a radius or a space, else a number. */
function fromNumber(name, number) {
  const measure = name.split(WORD_SEPARATOR).some((word) => SIZE_WORDS.includes(word));
  return measure ? { kind: "value", type: "dimension", value: { value: number, unit: "px" }, css: `${number}px` } : { kind: "value", type: "number", value: number, css: String(number) };
}

module.exports = { fromCss, fromNumber, citedProperties };
