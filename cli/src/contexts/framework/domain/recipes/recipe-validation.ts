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

export interface RecipeInspection {
  readonly findings: RecipeFinding[];
  readonly links: RecipeLink[];
  readonly anchors: Set<string>;
}

export interface RecipeValidationResult {
  readonly findings: RecipeFinding[];
  readonly fileCount: number;
}

interface Heading {
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
interface Fence extends OpenFence {
  end: number;
  body: string;
}
interface FenceScan {
  fencedLines: Set<number>;
  blocks: Fence[];
}
interface RecipeStep extends Heading {
  number: number;
  icon: string;
  title: string;
}

const STEP_PATTERN = /^(#{3,4})\s+(\d+)\)\s+(\S+)\s+(.+?)\s*$/u;
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
      let masked = "";
      let position = 0;
      while (position < line.length) {
        const start = commentOpen ? position : line.indexOf("<!--", position);
        if (start === -1) {
          masked += line.slice(position);
          break;
        }
        masked += line.slice(position, start);
        const end = line.indexOf("-->", commentOpen ? start : start + 4);
        const limit = end === -1 ? line.length : end + 3;
        masked += line.slice(start, limit).replace(/./gu, " ");
        commentOpen = end === -1;
        position = limit;
      }
      const open = masked.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
      if (open) fence = { marker: open[1][0], length: open[1].length };
      return masked;
    })
    .join("\n");
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function addFinding(
  findings: RecipeFinding[],
  file: string,
  line: number,
  rule: string,
  fix: string
): void {
  findings.push({ file, line: Math.max(1, line), rule, fix });
}

function scanFences(lines: string[], file: string, findings: RecipeFinding[]): FenceScan {
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
        addFinding(
          findings,
          file,
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
    addFinding(
      findings,
      file,
      open.start + 1,
      "fence-balance",
      "Close this fenced code block with the same marker."
    );
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

export function headingAnchors(content: string): Set<string> {
  const masked = maskHtmlComments(content);
  const lines = masked.split(/\r?\n/u);
  const { fencedLines } = scanFences(lines, "", []);
  const counts = new Map<string, number>();
  const anchors = new Set<string>();

  for (const heading of parseHeadings(lines, fencedLines)) {
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

function recipeLinks(content: string, fencedLines: Set<number>): RecipeLink[] {
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

function hasTable(lines: string[]): boolean {
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (/^\s*\|.*\|\s*$/u.test(lines[index]) && /^\s*\|?\s*:?-{3,}/u.test(lines[index + 1]))
      return true;
  }
  return false;
}

function findAnglePlaceholders(content: string): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];

  for (const match of content.matchAll(/<([a-z][^<>\n]*)>/giu)) {
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

function maskAngleSyntaxBlocks(content: string, blocks: Fence[]): string {
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

function checkSteps(
  lines: string[],
  headings: Heading[],
  stepsHeading: Heading,
  file: string,
  findings: RecipeFinding[],
  fencedLines: Set<number>
): RecipeStep[] {
  const nextH2 = headings.find(
    (heading) => heading.depth === 2 && heading.index > stepsHeading.index
  );
  const endIndex = nextH2?.index ?? lines.length;
  const scopedHeadings = headings.filter(
    (heading) =>
      heading.index > stepsHeading.index &&
      heading.index < endIndex &&
      [3, 4].includes(heading.depth)
  );
  const steps: RecipeStep[] = [];
  const categories: Heading[] = [];

  for (const heading of scopedHeadings) {
    const source = `${"#".repeat(heading.depth)} ${heading.text}`;
    const match = source.match(STEP_PATTERN);
    if (match) {
      const icon = match[3];
      if (!/\p{Extended_Pictographic}/u.test(icon)) {
        addFinding(
          findings,
          file,
          heading.line,
          "step-emoji",
          "Add one meaningful emoji between the step number and title."
        );
      }
      steps.push({ ...heading, number: Number.parseInt(match[2], 10), icon, title: match[4] });
      continue;
    }

    if (/^\d+[.)]?\s/u.test(heading.text)) {
      addFinding(
        findings,
        file,
        heading.line,
        "step-heading",
        "Use `### N) <emoji> Title`, or `#### N) <emoji> Title` below a category."
      );
    } else if (heading.depth === 3) {
      categories.push(heading);
    } else {
      addFinding(
        findings,
        file,
        heading.line,
        "category-depth",
        "Use level 3 for a category and level 4 only for its numbered steps."
      );
    }
  }

  if (steps.length === 0) {
    addFinding(
      findings,
      file,
      stepsHeading.line,
      "steps-missing",
      "Add at least one numbered step heading."
    );
    return [];
  }

  steps.forEach((step, index) => {
    const expected = index + 1;
    if (step.number !== expected) {
      addFinding(
        findings,
        file,
        step.line,
        "step-number",
        `Renumber this step to ${expected}; numbering must start at 1 and remain continuous.`
      );
    }
  });

  if (categories.length > 0) {
    for (const step of steps) {
      if (step.depth !== 4) {
        addFinding(
          findings,
          file,
          step.line,
          "step-depth",
          "Use level 4 for every numbered step when level 3 categories are present."
        );
        continue;
      }
      const parent = [...categories].reverse().find((category) => category.index < step.index);
      if (!parent) {
        addFinding(
          findings,
          file,
          step.line,
          "step-parent",
          "Place this level 4 step below a level 3 category."
        );
      }
    }
  } else {
    for (const step of steps) {
      if (step.depth !== 3) {
        addFinding(
          findings,
          file,
          step.line,
          "step-depth",
          "Use level 3 for direct numbered steps."
        );
      }
    }
  }

  for (const step of steps) {
    const nextBoundary = headings.find(
      (heading) =>
        heading.index > step.index && heading.index < endIndex && heading.depth <= step.depth
    );
    const stepEnd = nextBoundary?.index ?? endIndex;
    const body = lines.slice(step.index + 1, stepEnd);
    const hasFence = body.some((_, offset) => fencedLines.has(step.index + 1 + offset));
    const hasImage = body.some((line) => /!\[[^\]]*\]\([^)]+\)/u.test(line));
    if (!hasFence && !hasImage && !hasTable(body)) {
      addFinding(
        findings,
        file,
        step.line,
        "step-example",
        "Add a fenced command/config/output, a concrete table, or an operational image."
      );
    }
  }

  return steps;
}

export function inspectRecipe(file: string, content: string): RecipeInspection {
  const findings: RecipeFinding[] = [];

  const masked = maskHtmlComments(content);
  const lines = masked.split(/\r?\n/u);
  const { fencedLines, blocks } = scanFences(lines, file, findings);
  const headings = parseHeadings(lines, fencedLines);
  const h1s = headings.filter((heading) => heading.depth === 1);

  if (h1s.length !== 1 || h1s[0]?.index !== 0) {
    addFinding(
      findings,
      file,
      h1s[0]?.line ?? 1,
      "title",
      "Start the file with exactly one H1 title."
    );
  }

  const title = h1s[0];
  if (title) {
    const descriptionIndex = lines.findIndex(
      (line, index) => index > title.index && line.trim() !== ""
    );
    const description = descriptionIndex === -1 ? "" : lines[descriptionIndex].trim();
    if (!description || /^(?:#|[-*+]|\d+[.)]\s|>|\||```|~~~|!\[)/u.test(description)) {
      addFinding(
        findings,
        file,
        descriptionIndex + 1 || title.line + 1,
        "description",
        "Put a non-empty plain description paragraph directly after the H1."
      );
    }
  }

  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1];
    const current = headings[index];
    if (current.depth > previous.depth + 1) {
      addFinding(
        findings,
        file,
        current.line,
        "heading-depth",
        `Use level ${previous.depth + 1} or shallower after the previous heading.`
      );
    }
  }

  const h2s = headings.filter((heading) => heading.depth === 2);
  const stepsHeadings = h2s.filter((heading) => /^Steps to\s+\S/u.test(heading.text));
  const verifyHeadings = h2s.filter((heading) => /^Verify(?:\s|$)/u.test(heading.text));

  if (stepsHeadings.length !== 1) {
    addFinding(
      findings,
      file,
      stepsHeadings[0]?.line ?? 1,
      "steps-section",
      "Add exactly one outcome-specific `## Steps to ...` section."
    );
  }
  if (verifyHeadings.length > 1) {
    addFinding(
      findings,
      file,
      verifyHeadings[1].line,
      "verify-section",
      "Keep at most one `## Verify` section."
    );
  }

  const stepsHeading = stepsHeadings[0];
  for (const verify of verifyHeadings) {
    if (!stepsHeading || verify.index < stepsHeading.index) {
      addFinding(
        findings,
        file,
        verify.line,
        "section-order",
        "Place `## Verify` after the steps section."
      );
    }
  }

  if (stepsHeading) checkSteps(lines, headings, stepsHeading, file, findings, fencedLines);

  for (const block of blocks.filter((candidate) => candidate.language === "json")) {
    try {
      JSON.parse(block.body);
    } catch (error) {
      addFinding(
        findings,
        file,
        block.start + 1,
        "json-syntax",
        `Fix the JSON example: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const placeholderContent = masked;
  const anglePlaceholderContent = maskAngleSyntaxBlocks(placeholderContent, blocks);
  for (const match of findAnglePlaceholders(anglePlaceholderContent)) {
    addFinding(
      findings,
      file,
      lineNumberAt(anglePlaceholderContent, match.index),
      "placeholder",
      "Replace or remove this angle-bracket placeholder."
    );
  }
  for (const pattern of [
    {
      regex: /\{\{[^}\n]+\}\}/gu,
      rule: "placeholder",
      fix: "Replace or remove this template placeholder.",
    },
    {
      regex: /\b(?:TODO|TBD|FIXME)\b/gu,
      rule: "todo",
      fix: "Resolve this unfinished marker before publishing the recipe.",
    },
  ]) {
    for (const match of placeholderContent.matchAll(pattern.regex)) {
      addFinding(
        findings,
        file,
        lineNumberAt(placeholderContent, match.index),
        pattern.rule,
        pattern.fix
      );
    }
  }

  const anchors = headingAnchors(content);

  return {
    findings,
    links: recipeLinks(masked, fencedLines),
    anchors,
  };
}
