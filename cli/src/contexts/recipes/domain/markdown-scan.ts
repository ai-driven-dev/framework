export interface RecipeFinding {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly fix: string;
}

export interface RecipeLink {
  readonly line: number;
  readonly target: string;
  readonly image: boolean;
}

export interface Heading {
  depth: number;
  text: string;
  line: number;
  index: number;
}
interface OpenFence {
  marker: string;
  length: number;
  start: number;
  language: string;
}
export interface Fence extends OpenFence {
  end: number;
  body: string;
}
interface FenceScan {
  fencedLines: Set<number>;
  blocks: Fence[];
}
const HEADING_PATTERN = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/u;
const LINK_PATTERN = /(!?)\[[^\]\n]*\]\(([^)\n]+)\)/gu;
const HTML_TAGS = new Set([
  "a",
  "article",
  "aside",
  "body",
  "br",
  "button",
  "code",
  "details",
  "div",
  "em",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "i",
  "iframe",
  "img",
  "input",
  "label",
  "li",
  "link",
  "main",
  "meta",
  "nav",
  "ol",
  "option",
  "p",
  "path",
  "picture",
  "pre",
  "script",
  "section",
  "select",
  "small",
  "source",
  "span",
  "strong",
  "style",
  "summary",
  "svg",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "ul",
  "video",
]);
interface MaskedLine {
  readonly text: string;
  readonly commentOpen: boolean;
}

function maskLineComments(line: string, commentOpen: boolean): MaskedLine {
  let text = "";
  let position = 0;
  let open = commentOpen;
  while (position < line.length) {
    const start = open ? position : line.indexOf("<!--", position);
    if (start === -1) {
      text += line.slice(position);
      break;
    }
    text += line.slice(position, start);
    const end = line.indexOf("-->", open ? start : start + 4);
    const limit = end === -1 ? line.length : end + 3;
    text += line.slice(start, limit).replace(/./gu, " ");
    open = end === -1;
    position = limit;
  }
  return { text, commentOpen: open };
}

function maskHtmlComments(content: string): string {
  let fence: { marker: string; length: number } | null = null;
  let commentOpen = false;
  return content
    .split("\n")
    .map((line) => {
      if (fence) {
        const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/u);
        if (close && close[1][0] === fence.marker && close[1].length >= fence.length) fence = null;
        return line;
      }
      const masked = maskLineComments(line, commentOpen);
      commentOpen = masked.commentOpen;
      const open = masked.text.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
      if (open) fence = { marker: open[1][0], length: open[1].length };
      return masked.text;
    })
    .join("\n");
}

export function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

/** Records one finding of the recipe being read; a line below 1 reads as the first. */
export type Report = (line: number, rule: string, fix: string) => void;

export function reporter(findings: RecipeFinding[], file: string): Report {
  return (line, rule, fix) => {
    findings.push({ file, line: Math.max(1, line), rule, fix });
  };
}

function scanFences(lines: string[], report: Report): FenceScan {
  const fencedLines = new Set<number>();
  const blocks: Fence[] = [];
  let open: OpenFence | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);

    if (!open) {
      if (!match) continue;
      const language = match[2].trim().split(/\s+/u)[0] ?? "";
      if (!language) {
        report(
          index + 1,
          "fence-language",
          "Add a language after the opening fence, such as ```bash or ```text."
        );
      }
      open = {
        marker: match[1][0],
        length: match[1].length,
        start: index,
        language: language.toLowerCase(),
      };
      fencedLines.add(index);
      continue;
    }

    fencedLines.add(index);
    if (
      match &&
      match[1][0] === open.marker &&
      match[1].length >= open.length &&
      match[2].trim() === ""
    ) {
      blocks.push({
        ...open,
        end: index,
        body: lines.slice(open.start + 1, index).join("\n"),
      });
      open = null;
    }
  }

  if (open) {
    report(open.start + 1, "fence-balance", "Close this fenced code block with the same marker.");
  }

  return { fencedLines, blocks };
}

function parseHeadings(lines: string[], fencedLines: Set<number>): Heading[] {
  const headings: Heading[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (fencedLines.has(index)) continue;
    const match = lines[index].match(HEADING_PATTERN);
    if (!match) continue;
    headings.push({
      depth: match[1].length,
      text: match[2].trim(),
      line: index + 1,
      index,
    });
  }
  return headings;
}

function baseSlug(text: string): string {
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/gu, "$1");
  let plain = "";
  let tagDepth = 0;
  for (const character of text) {
    if (character === "<") tagDepth += 1;
    else if (character === ">") tagDepth = Math.max(0, tagDepth - 1);
    else if (tagDepth === 0) plain += character;
  }
  return plain
    .toLowerCase()
    .replace(/[`*_~]/gu, "")
    .replace(/[\u200d\ufe0e\ufe0f]/gu, "")
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
    .replace(/\s/gu, "-");
}

export interface ScannedRecipe {
  readonly masked: string;
  readonly lines: string[];
  readonly fencedLines: Set<number>;
  readonly blocks: Fence[];
  readonly headings: Heading[];
}

/** The recipe with its HTML comments blanked, then split into fences and headings. */
export function scanRecipe(content: string, report: Report): ScannedRecipe {
  const masked = maskHtmlComments(content);
  const lines = masked.split(/\r?\n/u);
  const { fencedLines, blocks } = scanFences(lines, report);
  return { masked, lines, fencedLines, blocks, headings: parseHeadings(lines, fencedLines) };
}

export function headingAnchors(content: string): Set<string> {
  const counts = new Map<string, number>();
  const anchors = new Set<string>();

  for (const heading of scanRecipe(content, () => {}).headings) {
    const slug = baseSlug(heading.text);
    const count = counts.get(slug) ?? 0;
    counts.set(slug, count + 1);
    anchors.add(count === 0 ? slug : `${slug}-${count}`);
  }
  return anchors;
}

export function normalizedAnchor(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/^#/u, ""))
      .toLowerCase()
      .replace(/[\u200d\ufe0e\ufe0f]/gu, "");
  } catch {
    return raw
      .replace(/^#/u, "")
      .toLowerCase()
      .replace(/[\u200d\ufe0e\ufe0f]/gu, "");
  }
}

function splitTarget(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("<") && trimmed.includes(">")) {
    return trimmed.slice(1, trimmed.indexOf(">"));
  }
  return trimmed.split(/\s+["']/u)[0];
}

export function recipeLinks(content: string, fencedLines: Set<number>): RecipeLink[] {
  const links: RecipeLink[] = [];
  for (const match of content.matchAll(LINK_PATTERN)) {
    const line = lineNumberAt(content, match.index);
    if (fencedLines.has(line - 1)) continue;
    const target = splitTarget(match[2]);
    if (!target || /^(?:https?|mailto|tel|codex):/iu.test(target)) continue;
    links.push({ line, target, image: match[1] === "!" });
  }
  return links;
}

export function hasTable(lines: string[]): boolean {
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (/^\s*\|.*\|\s*$/u.test(lines[index]) && /^\s*\|?\s*:?-{3,}/u.test(lines[index + 1]))
      return true;
  }
  return false;
}

export function findAnglePlaceholders(
  content: string,
  fencedLines: Set<number>
): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  // Angle-wrapped link destinations are Markdown syntax. Their targets are checked
  // by the use case; prose and fenced examples still receive placeholder checks.
  const destinations = [...content.matchAll(LINK_PATTERN)].flatMap((link) => {
    const angle = link[2].match(/^\s*<[^<>\n]*>/u);
    if (!angle || fencedLines.has(lineNumberAt(content, link.index) - 1)) return [];
    const start = link.index + link[0].indexOf("](") + 2;
    return [{ start, end: start + angle[0].length }];
  });

  for (const match of content.matchAll(/<([a-z][^<>\n]*)>/giu)) {
    if (destinations.some(({ start, end }) => match.index >= start && match.index < end)) continue;
    const value = match[1];
    const tag = value.split(/[\s/]/u)[0].toLowerCase();
    if (
      (HTML_TAGS.has(tag) && (!value.includes(" ") || value.includes("="))) ||
      content.includes(`</${value}>`) ||
      /^(?:https?:\/\/|mailto:)/iu.test(value)
    )
      continue;
    matches.push(match);
  }

  return matches;
}
