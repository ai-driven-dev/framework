// WCAG contrast of the colours a render states, read from the three notations tokens are written
// in; any other value reads as null, so the pair holding it goes unchecked.
const BYTE = 255;
const NUMBER = "(\\d*\\.?\\d+)";
const HEX = /^#([0-9a-f]{6}|[0-9a-f]{3})$/;
const BYTES = new RegExp(`^rgba?\\(\\s*${NUMBER}[\\s,]+${NUMBER}[\\s,]+${NUMBER}(?:\\s*[,/]\\s*${NUMBER})?\\s*\\)$`);
const SRGB = new RegExp(`^color\\(\\s*srgb\\s+${NUMBER}\\s+${NUMBER}\\s+${NUMBER}(?:\\s*/\\s*${NUMBER})?\\s*\\)$`);
const CLEAR = { r: 0, g: 0, b: 0, a: 0 };

const opaque = (r, g, b, a) => ({ r, g, b, a: a === undefined ? 1 : Number(a) });

/** A colour as `{r, g, b, a}`, each from 0 to 1; null when its notation is not read. */
function parse(value) {
  const text = value.trim().toLowerCase();
  if (text === "transparent") return CLEAR;
  const hex = HEX.exec(text)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
    return opaque(...[0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16) / BYTE));
  }
  const bytes = BYTES.exec(text);
  if (bytes) return opaque(...bytes.slice(1, 4).map((channel) => Number(channel) / BYTE), bytes[4]);
  const srgb = SRGB.exec(text);
  return srgb ? opaque(...srgb.slice(1, 4).map(Number), srgb[4]) : null;
}

/** `top` laid over an opaque `behind`. */
const over = (top, behind) => ({ r: top.r * top.a + behind.r * (1 - top.a), g: top.g * top.a + behind.g * (1 - top.a), b: top.b * top.a + behind.b * (1 - top.a), a: 1 });

const linear = (channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
const luminance = ({ r, g, b }) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

/** The WCAG contrast ratio of two opaque colours, from 1 to 21. */
function contrast(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

module.exports = { parse, over, contrast };
