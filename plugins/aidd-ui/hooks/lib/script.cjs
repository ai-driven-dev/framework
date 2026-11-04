// The exported object literals of a script file, read as far as a token file goes: `export const
// name = { key: "literal" or number, group: { key: literal } }`. Anything else in one is returned as
// such, never guessed.
const { LINE_BREAK, lineOf } = require("./markdown.cjs");

const EXPORT = /export\s+const\s+[A-Za-z_$][\w$]*\s*(?::[^=]+)?=\s*\{/g;
const KEY = /[\w$]+/y;
const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?![\w$.])/y;
const QUOTES = ["\"", "'", "`"];
const OPENERS = { "(": ")", "[": "]", "{": "}" };

/** The object literals exported by `source`: `[{entries}]`, each entry `{key, line, kind, ...}` with
 * `kind` `string` (`value`), `number` (`value`), `object` (`entries`) or `other` (`text`, what it
 * is written as). */
function objectsOf(source) {
  let at = 0;

  function skipBlank() {
    for (;;) {
      if (/\s/.test(source[at] ?? "")) at += 1;
      else if (source.startsWith("//", at)) at = source.indexOf(LINE_BREAK, at) < 0 ? source.length : source.indexOf(LINE_BREAK, at);
      else if (source.startsWith("/*", at)) at = source.indexOf("*/", at + 2) < 0 ? source.length : source.indexOf("*/", at + 2) + 2;
      else return;
    }
  }

  /** The string literal at `at` without its quotes, null when a template holds `${`. */
  function readString() {
    const quote = source[at];
    let text = "";
    at += 1;
    while (at < source.length && source[at] !== quote) {
      if (source[at] === "\\") at += 1;
      text += source[at] ?? "";
      at += 1;
    }
    at += 1;
    return quote === "`" && text.includes("${") ? null : text;
  }

  /** The text up to the next `,` or `}` outside brackets and strings, left unread. */
  function readExpression() {
    const start = at;
    const closers = [];
    while (at < source.length && !(closers.length === 0 && (source[at] === "," || source[at] === "}"))) {
      const char = source[at];
      if (QUOTES.includes(char)) readString();
      else {
        if (OPENERS[char]) closers.push(OPENERS[char]);
        else if (char === closers.at(-1)) closers.pop();
        at += 1;
      }
    }
    return source.slice(start, at).trim();
  }

  function readValue() {
    skipBlank();
    const start = at;
    let value;
    if (QUOTES.includes(source[at])) value = { kind: "string", value: readString() };
    else if (source[at] === "{") return { kind: "object", entries: readObject() };
    else {
      NUMBER.lastIndex = at;
      const number = NUMBER.exec(source);
      if (number) {
        at += number[0].length;
        value = { kind: "number", value: Number(number[0]) };
      }
    }
    skipBlank();
    if (value && value.value !== null && (source[at] === "," || source[at] === "}" || at >= source.length)) return value;
    at = start;
    return { kind: "other", text: readExpression() };
  }

  /** The entries of the object whose `{` is at `at`. */
  function readObject() {
    const entries = [];
    at += 1;
    for (;;) {
      skipBlank();
      if (at >= source.length) return entries;
      if (source[at] === "}") {
        at += 1;
        return entries;
      }
      if (source[at] === ",") {
        at += 1;
        continue;
      }
      const line = lineOf(source, at);
      const start = at;
      let key;
      if (QUOTES.includes(source[at])) key = readString();
      else {
        KEY.lastIndex = at;
        key = KEY.exec(source)?.[0];
        at += key?.length ?? 0;
      }
      skipBlank();
      if (key == null || source[at] !== ":") {
        at = start; // a spread, a method, a shorthand: read whole, never as a literal
        entries.push({ key: "", line, kind: "other", text: readExpression() });
        continue;
      }
      at += 1;
      entries.push({ key, line, ...readValue() });
    }
  }

  const found = [];
  for (const match of source.matchAll(EXPORT)) {
    at = match.index + match[0].length - 1;
    found.push({ entries: readObject() });
  }
  return found;
}

module.exports = { objectsOf };
