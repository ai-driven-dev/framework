import { type Heading, hasTable, type Report, type ScannedRecipe } from "./markdown-scan.js";

interface RecipeStep extends Heading {
  number: number;
  icon: string;
  title: string;
}

interface StepOutline {
  readonly steps: RecipeStep[];
  readonly categories: Heading[];
}

const STEP_PATTERN = /^(#{3,4})\s+(\d+)\)\s+(\S+)\s+(.+?)\s*$/u;

function stepOf(heading: Heading): RecipeStep | undefined {
  const match = `${"#".repeat(heading.depth)} ${heading.text}`.match(STEP_PATTERN);
  if (!match) return undefined;
  return { ...heading, number: Number.parseInt(match[2], 10), icon: match[3], title: match[4] };
}

function reportMissingIcon(step: RecipeStep, report: Report): void {
  if (/\p{Extended_Pictographic}/u.test(step.icon)) return;
  report(step.line, "step-emoji", "Add one meaningful emoji between the step number and title.");
}

function collectSteps(headings: Heading[], report: Report): StepOutline {
  const steps: RecipeStep[] = [];
  const categories: Heading[] = [];
  let underDirectStep = false;

  for (const heading of headings) {
    if (heading.depth === 3) underDirectStep = false;
    const step = stepOf(heading);
    if (step) {
      reportMissingIcon(step, report);
      steps.push(step);
      if (heading.depth === 3) underDirectStep = true;
    } else if (/^\d+[.)]?\s/u.test(heading.text)) {
      report(
        heading.line,
        "step-heading",
        "Use `### N) <emoji> Title`, or `#### N) <emoji> Title` below a category."
      );
    } else if (heading.depth === 3) {
      categories.push(heading);
    } else if (!underDirectStep) {
      report(
        heading.line,
        "category-depth",
        "Use level 4 for numbered category steps or subsections of a direct numbered step."
      );
    }
  }
  return { steps, categories };
}

function checkNumbering(steps: RecipeStep[], report: Report): void {
  steps.forEach((step, index) => {
    const expected = index + 1;
    if (step.number !== expected) {
      report(
        step.line,
        "step-number",
        `Renumber this step to ${expected}; numbering must start at 1 and remain continuous.`
      );
    }
  });
}

function checkDepths({ steps, categories }: StepOutline, report: Report): void {
  for (const step of steps) {
    if (categories.length === 0) {
      if (step.depth !== 3)
        report(step.line, "step-depth", "Use level 3 for direct numbered steps.");
    } else if (step.depth !== 4) {
      report(
        step.line,
        "step-depth",
        "Use level 4 for every numbered step when level 3 categories are present."
      );
    } else if (!categories.some((category) => category.index < step.index)) {
      report(step.line, "step-parent", "Place this level 4 step below a level 3 category.");
    }
  }
}

function checkExamples(
  { recipe, endIndex }: { recipe: ScannedRecipe; endIndex: number },
  steps: RecipeStep[],
  report: Report
): void {
  for (const step of steps) {
    const boundary = recipe.headings.find(
      (heading) =>
        heading.index > step.index && heading.index < endIndex && heading.depth <= step.depth
    );
    const body = recipe.lines.slice(step.index + 1, boundary?.index ?? endIndex);
    const hasFence = body.some((_, offset) => recipe.fencedLines.has(step.index + 1 + offset));
    const hasImage = body.some((line) => /!\[[^\]]*\]\([^)]+\)/u.test(line));
    if (!hasFence && !hasImage && !hasTable(body)) {
      report(
        step.line,
        "step-example",
        "Add a fenced command/config/output, a concrete table, or an operational image."
      );
    }
  }
}

/** The numbered steps of the `## Steps to ...` section: their shape, numbering, nesting and examples. */
export function checkSteps(recipe: ScannedRecipe, stepsHeading: Heading, report: Report): void {
  const endIndex =
    recipe.headings.find((heading) => heading.depth === 2 && heading.index > stepsHeading.index)
      ?.index ?? recipe.lines.length;
  const scoped = recipe.headings.filter(
    (heading) =>
      heading.index > stepsHeading.index &&
      heading.index < endIndex &&
      (heading.depth === 3 || heading.depth === 4)
  );
  const outline = collectSteps(scoped, report);
  if (outline.steps.length === 0) {
    report(stepsHeading.line, "steps-missing", "Add at least one numbered step heading.");
    return;
  }
  checkNumbering(outline.steps, report);
  checkDepths(outline, report);
  checkExamples({ recipe, endIndex }, outline.steps, report);
}
