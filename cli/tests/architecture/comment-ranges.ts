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

/** The offset just past the `]` or `/` a regex body reaches, and its flags. */
function skipRegex(source: string, from: number): number {
  let at = from + 1;
  let inClass = false;
  while (at < source.length && source[at] !== "\n") {
    const char = source.charAt(at);
    if (char === "/" && !inClass) break;
    if (char === "[") inClass = true;
    if (char === "]") inClass = false;
    at += char === "\\" ? 2 : 1;
  }
  at++;
  while (at < source.length && isWordChar(source.charAt(at))) at++;
  return at;
}

const isQuote = (char: string): boolean => char === '"' || char === "'";

/** Where a comment starting at `at` ends, or `undefined` when none starts there. */
function commentEnd(source: string, at: number): number | undefined {
  if (source[at] !== "/") return undefined;
  if (source[at + 1] === "/") {
    const end = source.indexOf("\n", at);
    return end === -1 ? source.length : end;
  }
  if (source[at + 1] === "*") {
    const close = source.indexOf("*/", at + 2);
    return close === -1 ? source.length : close + 2;
  }
  return undefined;
}

/** The offset just past the run of word characters starting at `from`. */
function skipWord(source: string, from: number): number {
  let stop = from;
  while (stop < source.length && isWordChar(source.charAt(stop))) stop++;
  return stop;
}

class CommentScanner {
  readonly ranges: CommentRange[] = [];
  // One entry per open `${`: the brace depth at which its template resumes.
  private readonly templates: number[] = [];
  private braces = 0;
  private previous = "";
  private at = 0;

  constructor(private readonly source: string) {}

  scan(): CommentRange[] {
    while (this.at < this.source.length) this.step();
    return this.ranges;
  }

  private step(): void {
    const char = this.source.charAt(this.at);
    if (/\s/.test(char)) {
      this.at++;
      return;
    }
    const stop = commentEnd(this.source, this.at);
    if (stop !== undefined) {
      this.ranges.push({ start: this.at, end: stop });
      this.at = stop;
    } else if (isQuote(char)) {
      this.skipToken(skipQuoted(this.source, this.at));
    } else if (char === "`") {
      this.resumeTemplate(this.at + 1);
    } else if (this.startsRegex(char)) {
      this.skipToken(skipRegex(this.source, this.at), "/re/");
    } else if (isWordChar(char)) {
      this.skipToken(skipWord(this.source, this.at));
    } else {
      this.punctuation(char);
    }
  }

  private startsRegex(char: string): boolean {
    return char === "/" && opensRegex(this.previous);
  }

  /** Moves past the token at the cursor, which becomes the previous token. */
  private skipToken(stop: number, as = this.source.slice(this.at, stop)): void {
    this.previous = as;
    this.at = stop;
  }

  private resumeTemplate(from: number): void {
    this.at = this.scanTemplateText(from);
    if (this.previous !== "{") this.previous = "`";
  }

  private scanTemplateText(from: number): number {
    let index = from;
    while (index < this.source.length) {
      const char = this.source.charAt(index);
      if (char === "`") return index + 1;
      if (char === "$" && this.source[index + 1] === "{") return this.enterExpression(index);
      index += char === "\\" ? 2 : 1;
    }
    return index;
  }

  private enterExpression(index: number): number {
    this.templates.push(this.braces);
    this.braces++;
    this.previous = "{";
    return index + 2;
  }

  private closesTemplateExpression(): boolean {
    return this.templates.length > 0 && this.templates[this.templates.length - 1] === this.braces;
  }

  private punctuation(char: string): void {
    if (char === "{") this.braces++;
    if (char === "}") {
      this.braces--;
      if (this.closesTemplateExpression()) {
        this.templates.pop();
        this.resumeTemplate(this.at + 1);
        return;
      }
    }
    this.previous = char;
    this.at++;
  }
}

/** Every `//` and `/* *\/` comment of `source`, in order, as offsets into it. */
export function commentRanges(source: string): CommentRange[] {
  return new CommentScanner(source).scan();
}
