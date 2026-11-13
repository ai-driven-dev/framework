import {
  addFinding,
  type Fence,
  findAnglePlaceholders,
  type Heading,
  hasTable,
  headingAnchors,
  lineNumberAt,
  maskHtmlComments,
  parseHeadings,
  type RecipeFinding,
  type RecipeLink,
  recipeLinks,
  scanFences,
} from "./markdown-scan.js";

export interface RecipeInspection {
  readonly findings: RecipeFinding[];
  readonly links: RecipeLink[];
  readonly anchors: Set<string>;
}

interface RecipeStep extends Heading {
  number: number;
  icon: string;
  title: string;
}

const STEP_PATTERN = /^(#{3,4})\s+(\d+)\)\s+(\S+)\s+(.+?)\s*$/u;
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
  let directStep: RecipeStep | undefined;

  for (const heading of scopedHeadings) {
    if (heading.depth === 3) directStep = undefined;
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
      const step = { ...heading, number: Number.parseInt(match[2], 10), icon, title: match[4] };
      steps.push(step);
      if (heading.depth === 3) directStep = step;
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
    } else if (!directStep) {
      addFinding(
        findings,
        file,
        heading.line,
        "category-depth",
        "Use level 4 for numbered category steps or subsections of a direct numbered step."
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
  for (const match of findAnglePlaceholders(anglePlaceholderContent, fencedLines)) {
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
