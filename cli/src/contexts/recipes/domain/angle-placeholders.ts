import type { Fence } from "./fence-scan.js";
import { LINK_PATTERN, lineNumberAt } from "./markdown-scan.js";

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

const ANGLE_SYNTAX_LANGUAGES = new Set([
  "c",
  "c++",
  "cpp",
  "cs",
  "csharp",
  "go",
  "html",
  "java",
  "jsx",
  "kotlin",
  "objc",
  "objective-c",
  "rust",
  "svg",
  "swift",
  "tsx",
  "xml",
]);

export function maskAngleSyntaxBlocks(content: string, blocks: Fence[]): string {
  const lines = content.split(/\r?\n/u);
  for (const block of blocks) {
    if (!ANGLE_SYNTAX_LANGUAGES.has(block.language)) continue;
    for (let index = block.start; index <= block.end; index += 1) {
      lines[index] = lines[index].replace(/<([a-z][^<>\n]*)>/giu, (match: string, value: string) =>
        /\b(?:recipe title|one sentence|the reader|benefit-focused|benefit-first|first step title|next step title|last step title|where it is|how to invoke it|the useful output|what this screenshot|optional\.)/iu.test(
          value
        )
          ? match
          : match.replace(/./gu, " ")
      );
    }
  }
  return lines.join("\n");
}
