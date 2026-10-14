import path from "node:path";
import { InputRequiredError } from "../../../../kernel/errors.js";
import type { RecipeDirectory, RecipeFiles } from "../../domain/ports/recipe-files.js";
import {
  headingAnchors,
  inspectRecipe,
  normalizedAnchor,
  type RecipeFinding,
  type RecipeInspection,
  type RecipeValidationResult,
} from "../../domain/recipes/recipe-validation.js";

export interface ValidateRecipesInput {
  readonly files: readonly string[];
  readonly directories: readonly RecipeDirectory[];
}

type LinkTarget = { anchors: Set<string> | null } | { error: string };

export class ValidateRecipesUseCase {
  constructor(private readonly files: RecipeFiles) {}

  execute(input: ValidateRecipesInput): RecipeValidationResult {
    const candidates = [
      ...input.files,
      ...input.directories.flatMap((directory) => this.files.list(directory)),
    ];
    const files = [...new Set(candidates)].sort((left, right) => left.localeCompare(right));
    if (files.length === 0) {
      throw new InputRequiredError(
        "Pass at least one recipe path or --all with a non-empty recipe directory."
      );
    }
    const findings = files.flatMap((file) => this.validate(file));
    findings.sort(
      (left, right) =>
        left.file.localeCompare(right.file) ||
        left.line - right.line ||
        left.rule.localeCompare(right.rule)
    );
    return { findings, fileCount: files.length };
  }

  private validate(file: string): RecipeFinding[] {
    const source = this.files.read(file);
    if (source.kind === "unreadable") {
      const rule =
        source.code === "ENOENT"
          ? "file-exists"
          : source.code === "EISDIR"
            ? "file-type"
            : "file-read";
      return [
        { file, line: 1, rule, fix: `Pass a readable Markdown recipe file (${source.code}).` },
      ];
    }
    if (path.extname(file).toLowerCase() !== ".md") {
      return [
        { file, line: 1, rule: "file-type", fix: "Pass a Markdown recipe file ending in .md." },
      ];
    }
    const inspected = inspectRecipe(file, source.content);
    return [...inspected.findings, ...this.checkLinks(file, inspected)];
  }

  private checkLinks(file: string, inspected: RecipeInspection): RecipeFinding[] {
    const findings: RecipeFinding[] = [];
    const cache = new Map<string, LinkTarget>([[file, { anchors: inspected.anchors }]]);
    for (const link of inspected.links) {
      const hashIndex = link.target.indexOf("#");
      const rawPath = hashIndex === -1 ? link.target : link.target.slice(0, hashIndex);
      const rawAnchor = hashIndex === -1 ? "" : link.target.slice(hashIndex + 1);
      let targetFile = file;
      if (rawPath) {
        let decodedPath: string;
        try {
          decodedPath = decodeURI(rawPath);
        } catch {
          findings.push({
            file,
            line: link.line,
            rule: "link-encoding",
            fix: `Encode the link target correctly: ${rawPath}`,
          });
          continue;
        }
        targetFile = path.resolve(path.dirname(file), decodedPath);
      }
      let target = cache.get(targetFile);
      if (!target) {
        const markdown = targetFile.toLowerCase().endsWith(".md");
        const source = this.files.read(targetFile, markdown);
        target =
          source.kind === "unreadable"
            ? { error: source.code }
            : { anchors: markdown ? headingAnchors(source.content) : null };
        cache.set(targetFile, target);
      }
      if ("error" in target) {
        findings.push({
          file,
          line: link.line,
          rule: link.image ? "image-target" : "link-target",
          fix: `Point the local target to a readable file: ${rawPath} (${target.error}).`,
        });
      } else if (rawAnchor && target.anchors === null) {
        findings.push({
          file,
          line: link.line,
          rule: "link-anchor",
          fix: `Remove the anchor or target a Markdown heading: #${rawAnchor}`,
        });
      } else if (rawAnchor && !target.anchors?.has(normalizedAnchor(rawAnchor))) {
        findings.push({
          file,
          line: link.line,
          rule: "link-anchor",
          fix: `Point the link to an existing heading: #${rawAnchor}`,
        });
      }
    }
    return findings;
  }
}
