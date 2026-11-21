import { findAnglePlaceholders, maskAngleSyntaxBlocks } from "./angle-placeholders.js";
import { headingAnchors } from "./heading-anchors.js";
import {
  type Fence,
  lineNumberAt,
  type RecipeFinding,
  type RecipeLink,
  type Report,
  recipeLinks,
  reporter,
  type ScannedRecipe,
  scanRecipe,
} from "./markdown-scan.js";
import { checkSteps } from "./recipe-steps.js";

export interface RecipeInspection {
  readonly findings: RecipeFinding[];
  readonly links: RecipeLink[];
  readonly anchors: Set<string>;
}

function checkTitle({ lines, headings }: ScannedRecipe, report: Report): void {
  const h1s = headings.filter((heading) => heading.depth === 1);
  if (h1s.length !== 1 || h1s[0]?.index !== 0) {
    report(h1s[0]?.line ?? 1, "title", "Start the file with exactly one H1 title.");
  }
  const title = h1s[0];
  if (!title) return;
  const descriptionIndex = lines.findIndex(
    (line, index) => index > title.index && line.trim() !== ""
  );
  const description = descriptionIndex === -1 ? "" : lines[descriptionIndex].trim();
  if (!description || /^(?:#|[-*+]|\d+[.)]\s|>|\||```|~~~|!\[)/u.test(description)) {
    report(
      descriptionIndex + 1 || title.line + 1,
      "description",
      "Put a non-empty plain description paragraph directly after the H1."
    );
  }
}

function checkHeadingDepths({ headings }: ScannedRecipe, report: Report): void {
  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1];
    const current = headings[index];
    if (current.depth > previous.depth + 1) {
      report(
        current.line,
        "heading-depth",
        `Use level ${previous.depth + 1} or shallower after the previous heading.`
      );
    }
  }
}

function checkSections(recipe: ScannedRecipe, report: Report): void {
  const h2s = recipe.headings.filter((heading) => heading.depth === 2);
  const stepsHeadings = h2s.filter((heading) => /^Steps to\s+\S/u.test(heading.text));
  const verifyHeadings = h2s.filter((heading) => /^Verify(?:\s|$)/u.test(heading.text));
  if (stepsHeadings.length !== 1) {
    report(
      stepsHeadings[0]?.line ?? 1,
      "steps-section",
      "Add exactly one outcome-specific `## Steps to ...` section."
    );
  }
  if (verifyHeadings.length > 1) {
    report(verifyHeadings[1].line, "verify-section", "Keep at most one `## Verify` section.");
  }
  const stepsHeading = stepsHeadings[0];
  for (const verify of verifyHeadings) {
    if (!stepsHeading || verify.index < stepsHeading.index) {
      report(verify.line, "section-order", "Place `## Verify` after the steps section.");
    }
  }
  if (stepsHeading) checkSteps(recipe, stepsHeading, report);
}

function checkJsonExamples(blocks: Fence[], report: Report): void {
  for (const block of blocks.filter((candidate) => candidate.language === "json")) {
    try {
      JSON.parse(block.body);
    } catch (error) {
      report(
        block.start + 1,
        "json-syntax",
        `Fix the JSON example: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

const MARKER_PATTERNS = [
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
];

function checkPlaceholders({ masked, blocks, fencedLines }: ScannedRecipe, report: Report): void {
  const angled = maskAngleSyntaxBlocks(masked, blocks);
  for (const match of findAnglePlaceholders(angled, fencedLines)) {
    report(
      lineNumberAt(angled, match.index),
      "placeholder",
      "Replace or remove this angle-bracket placeholder."
    );
  }
  for (const { regex, rule, fix } of MARKER_PATTERNS) {
    for (const match of masked.matchAll(regex)) {
      report(lineNumberAt(masked, match.index), rule, fix);
    }
  }
}

export function inspectRecipe(file: string, content: string): RecipeInspection {
  const findings: RecipeFinding[] = [];
  const report = reporter(findings, file);
  const recipe = scanRecipe(content, report);

  checkTitle(recipe, report);
  checkHeadingDepths(recipe, report);
  checkSections(recipe, report);
  checkJsonExamples(recipe.blocks, report);
  checkPlaceholders(recipe, report);

  return {
    findings,
    links: recipeLinks(recipe.masked, recipe.fencedLines),
    anchors: headingAnchors(content),
  };
}
