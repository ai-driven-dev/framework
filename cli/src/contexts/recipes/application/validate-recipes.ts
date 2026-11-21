import path from "node:path";
import { InputRequiredError } from "../../../shared/domain/shared.error.js";
import {
  headingAnchors,
  normalizedAnchor,
  type RecipeFinding,
  type RecipeLink,
} from "../domain/markdown-scan.js";
import { inspectRecipe, type RecipeInspection } from "../domain/recipe-rules.js";
import type { RecipeDirectory, RecipeFiles } from "../ports/recipe-files.js";

export interface ValidateRecipesCommand {
  readonly files: readonly string[];
  readonly directories: readonly RecipeDirectory[];
}

export interface ValidateRecipesResult {
  readonly findings: RecipeFinding[];
  readonly fileCount: number;
}

type LinkTarget = { anchors: Set<string> | null } | { error: string };

export class ValidateRecipes {
  constructor(private readonly files: RecipeFiles) {}

  execute(input: ValidateRecipesCommand): ValidateRecipesResult {
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
    const cache = new Map<string, LinkTarget>([[file, { anchors: inspected.anchors }]]);
    return inspected.links.flatMap((link) => this.checkLink(file, link, cache) ?? []);
  }

  private checkLink(
    file: string,
    link: RecipeLink,
    cache: Map<string, LinkTarget>
  ): RecipeFinding | undefined {
    const fail = (rule: string, fix: string): RecipeFinding => ({
      file,
      line: link.line,
      rule,
      fix,
    });
    const hashIndex = link.target.indexOf("#");
    const rawPath = hashIndex === -1 ? link.target : link.target.slice(0, hashIndex);
    const rawAnchor = hashIndex === -1 ? "" : link.target.slice(hashIndex + 1);
    const targetFile = localTargetFile(file, rawPath);
    if (targetFile === undefined) {
      return fail("link-encoding", `Encode the link target correctly: ${rawPath}`);
    }
    const target = this.targetOf(targetFile, cache);
    if ("error" in target) {
      return fail(
        link.image ? "image-target" : "link-target",
        `Point the local target to a readable file: ${rawPath} (${target.error}).`
      );
    }
    if (!rawAnchor) return undefined;
    if (target.anchors === null) {
      return fail("link-anchor", `Remove the anchor or target a Markdown heading: #${rawAnchor}`);
    }
    if (!target.anchors.has(normalizedAnchor(rawAnchor))) {
      return fail("link-anchor", `Point the link to an existing heading: #${rawAnchor}`);
    }
    return undefined;
  }

  private targetOf(targetFile: string, cache: Map<string, LinkTarget>): LinkTarget {
    const cached = cache.get(targetFile);
    if (cached) return cached;
    const markdown = targetFile.toLowerCase().endsWith(".md");
    const source = this.files.read(targetFile, markdown);
    const target: LinkTarget =
      source.kind === "unreadable"
        ? { error: source.code }
        : { anchors: markdown ? headingAnchors(source.content) : null };
    cache.set(targetFile, target);
    return target;
  }
}

/** The file a link points at, the linking file itself when it names none, undefined when its path is not valid URI encoding. */
function localTargetFile(file: string, rawPath: string): string | undefined {
  if (!rawPath) return file;
  try {
    return path.resolve(path.dirname(file), decodeURI(rawPath));
  } catch {
    return undefined;
  }
}
