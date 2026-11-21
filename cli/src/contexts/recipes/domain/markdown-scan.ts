import { maskHtmlComments } from "./html-comment-mask.js";

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
export const LINK_PATTERN = /(!?)\[[^\]\n]*\]\(([^)\n]+)\)/gu;
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

const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})(.*)$/u;

interface FenceState extends FenceScan {
  readonly lines: string[];
  readonly report: Report;
  open: OpenFence | null;
}

function openFence(match: RegExpMatchArray, index: number, report: Report): OpenFence {
  const language = match[2].trim().split(/\s+/u)[0] ?? "";
  if (!language) {
    report(
      index + 1,
      "fence-language",
      "Add a language after the opening fence, such as ```bash or ```text."
    );
  }
  return {
    marker: match[1][0],
    length: match[1].length,
    start: index,
    language: language.toLowerCase(),
  };
}

function closesFence(match: RegExpMatchArray | null, open: OpenFence): boolean {
  return (
    match !== null &&
    match[1][0] === open.marker &&
    match[1].length >= open.length &&
    match[2].trim() === ""
  );
}

function scanLine(state: FenceState, index: number): void {
  const match = state.lines[index].match(FENCE_LINE);
  const { open } = state;
  if (open) {
    state.fencedLines.add(index);
    if (!closesFence(match, open)) return;
    state.blocks.push({
      ...open,
      end: index,
      body: state.lines.slice(open.start + 1, index).join("\n"),
    });
    state.open = null;
    return;
  }
  if (!match) return;
  state.open = openFence(match, index, state.report);
  state.fencedLines.add(index);
}

function scanFences(lines: string[], report: Report): FenceScan {
  const state: FenceState = { lines, report, open: null, fencedLines: new Set(), blocks: [] };
  for (let index = 0; index < lines.length; index += 1) scanLine(state, index);
  if (state.open) {
    report(
      state.open.start + 1,
      "fence-balance",
      "Close this fenced code block with the same marker."
    );
  }
  return { fencedLines: state.fencedLines, blocks: state.blocks };
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
