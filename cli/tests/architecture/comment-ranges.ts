/**
 * Where the comments of a TypeScript source are, found by walking its tokens: a `//` or a `/*`
 * inside a string, a template literal or a regular expression is text, never a comment.
 *
 * Limit: a `/` after a postfix `++` or `--` reads as a regex start, so a comment after it is missed;
 * no source file has that pattern.
 */

export interface CommentRange {
  readonly start: number;
  readonly end: number;
}

const REGEX_AFTER_WORD = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "case",
  "do",
  "else",
  "yield",
  "await",
]);

const isWordChar = (char: string): boolean => /[\w$]/.test(char);

/** After `)`, `]`, `}`, a name or a literal a `/` divides; after anything else it opens a regex. */
function opensRegex(previous: string): boolean {
  if (previous === "") return true;
  if (previous === ")" || previous === "]" || previous === "}") return false;
  if (isWordChar(previous.charAt(0))) return REGEX_AFTER_WORD.has(previous);
  return !previous.startsWith('"') && !previous.startsWith("'") && !previous.startsWith("`");
}

function skipQuoted(source: string, from: number): number {
  const quote = source.charAt(from);
  let at = from + 1;
  while (at < source.length && source[at] !== quote && source[at] !== "\n") {
    at += source[at] === "\\" ? 2 : 1;
  }
  return at + 1;
}

function skipRegex(source: string, from: number): number {
  let at = from + 1;
  let inClass = false;
  while (at < source.length && source[at] !== "\n") {
    const char = source.charAt(at);
    if (char === "\\") at++;
    else if (char === "[") inClass = true;
    else if (char === "]") inClass = false;
    else if (char === "/" && !inClass) break;
    at++;
  }
  at++;
  while (at < source.length && isWordChar(source.charAt(at))) at++;
  return at;
}

/** Every `//` and `/* *\/` comment of `source`, in order, as offsets into it. */
export function commentRanges(source: string): CommentRange[] {
  const ranges: CommentRange[] = [];
  // One entry per open `${`: the brace depth at which its template resumes.
  const templates: number[] = [];
  let braces = 0;
  let previous = "";
  let at = 0;

  const scanTemplateText = (from: number): number => {
    let index = from;
    while (index < source.length) {
      const char = source.charAt(index);
      if (char === "\\") index += 2;
      else if (char === "`") return index + 1;
      else if (char === "$" && source[index + 1] === "{") {
        templates.push(braces);
        braces++;
        previous = "{";
        return index + 2;
      } else index++;
    }
    return index;
  };

  while (at < source.length) {
    const char = source.charAt(at);
    const next = source[at + 1];
    if (/\s/.test(char)) at++;
    else if (char === "/" && next === "/") {
      const end = source.indexOf("\n", at);
      const stop = end === -1 ? source.length : end;
      ranges.push({ start: at, end: stop });
      at = stop;
    } else if (char === "/" && next === "*") {
      const close = source.indexOf("*/", at + 2);
      const stop = close === -1 ? source.length : close + 2;
      ranges.push({ start: at, end: stop });
      at = stop;
    } else if (char === '"' || char === "'") {
      const stop = skipQuoted(source, at);
      previous = source.slice(at, stop);
      at = stop;
    } else if (char === "`") {
      at = scanTemplateText(at + 1);
      if (previous !== "{") previous = "`";
    } else if (char === "/" && opensRegex(previous)) {
      const stop = skipRegex(source, at);
      previous = "/re/";
      at = stop;
    } else if (isWordChar(char)) {
      let stop = at;
      while (stop < source.length && isWordChar(source.charAt(stop))) stop++;
      previous = source.slice(at, stop);
      at = stop;
    } else {
      if (char === "{") braces++;
      if (char === "}") {
        braces--;
        if (templates.length > 0 && templates[templates.length - 1] === braces) {
          templates.pop();
          at = scanTemplateText(at + 1);
          if (previous !== "{") previous = "`";
          continue;
        }
      }
      previous = char;
      at++;
    }
  }
  return ranges;
}
