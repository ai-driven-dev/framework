import { dirname, join, normalize } from "node:path";
import { ManifestValidationError } from "../../domain/errors.js";
import type { Manifest } from "../../domain/models/manifest.js";
import {
  getAllRegisteredTools,
  hasToolSignals,
  type ToolId,
} from "../../domain/models/tool-config.js";
import type { AuthTokenProvider } from "../../domain/ports/auth-token-provider.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { NoManifestError } from "../errors.js";

type IssueSeverity = "info" | "warning" | "error";

interface DoctorIssue {
  severity: IssueSeverity;
  message: string;
  fix: string;
}

interface ToolHealth {
  toolId: ToolId;
  fileCount: number;
}

interface DoctorReport {
  healthy: boolean;
  toolHealth: ToolHealth[];
  docsFileCount: number;
  issues: DoctorIssue[];
}

interface DoctorOptions {
  projectRoot: string;
  repo?: string;
}

const CODE_FENCE_WITH_LANG_RE = /```(?!markdown\b|md\b)(\w+)[^\n]*\n[\s\S]*?```/gm;
const INLINE_CODE_RE = /`[^`\n]+`/g;
const AT_PATH_RE = /@([\w.-]+(?:\/[\w.-]+)+)/g;
const MARKDOWN_LINK_RE = /\[[^\]]*\]\(([^)#\s]+)\)/g;
function stripNonMarkdownCodeBlocks(content: string): string {
  return content.replace(CODE_FENCE_WITH_LANG_RE, "").replace(INLINE_CODE_RE, "");
}

export function extractAtReferences(content: string): string[] {
  const refs = new Set<string>();
  for (const match of stripNonMarkdownCodeBlocks(content).matchAll(AT_PATH_RE)) refs.add(match[1]);
  return [...refs];
}

export function extractMarkdownLinkTargets(content: string): string[] {
  const refs = new Set<string>();
  for (const match of stripNonMarkdownCodeBlocks(content).matchAll(MARKDOWN_LINK_RE)) {
    if (!match[1].startsWith("http")) refs.add(match[1]);
  }
  return [...refs];
}

function isFileReference(ref: string): boolean {
  const lastSegment = ref.split("/").at(-1) ?? "";
  return lastSegment.includes(".") && !ref.endsWith("/");
}

export class DoctorUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    readonly _logger: Logger,
    private readonly authReader?: AuthTokenProvider
  ) {}

  async execute(options: DoctorOptions): Promise<DoctorReport> {
    const { projectRoot, repo } = options;

    let manifest: Manifest | null;
    try {
      manifest = await this.manifestRepo.load();
    } catch {
      throw new ManifestValidationError(
        "Manifest is corrupted (invalid JSON). Run `aidd clean --force` and re-initialize."
      );
    }

    if (manifest === null) {
      throw new NoManifestError(repo);
    }

    const issues: DoctorIssue[] = [];
    const toolHealth: ToolHealth[] = [];
    const allTrackedFiles: { relativePath: string; toolId: ToolId | null }[] = [];

    for (const toolId of manifest.getInstalledToolIds()) {
      const files = manifest.getToolFiles(toolId);
      toolHealth.push({ toolId, fileCount: files.length });
      allTrackedFiles.push(...files.map((f) => ({ ...f, toolId })));
    }

    const docsFiles = manifest.getDocsFiles();
    allTrackedFiles.push(...docsFiles.map((f) => ({ ...f, toolId: null })));

    issues.push(...(await this.checkDocsDirectory(manifest, projectRoot)));
    issues.push(...(await this.checkMissingTrackedFiles(allTrackedFiles, projectRoot)));
    issues.push(...(await this.checkBrokenReferences(allTrackedFiles, projectRoot)));
    issues.push(...(await this.checkOrphanedDirectories(manifest, projectRoot)));
    issues.push(...(await this.checkAuth()));

    return {
      healthy: issues.filter((i) => i.severity !== "info").length === 0,
      toolHealth,
      docsFileCount: docsFiles.length,
      issues,
    };
  }

  private async checkDocsDirectory(
    manifest: Manifest,
    projectRoot: string
  ): Promise<DoctorIssue[]> {
    const issues: DoctorIssue[] = [];
    const manifestDocsDir = manifest.docsDir;
    const docsDirPath = join(projectRoot, manifestDocsDir);

    if (!(await this.fs.fileExists(docsDirPath))) {
      issues.push({
        severity: "error",
        message: `Docs directory '${manifestDocsDir}' does not exist on disk`,
        fix: "Run `aidd init --force` to recreate the docs directory.",
      });
    }

    return issues;
  }

  private async checkMissingTrackedFiles(
    files: ReadonlyArray<{ relativePath: string; toolId: ToolId | null }>,
    projectRoot: string
  ): Promise<DoctorIssue[]> {
    const issues: DoctorIssue[] = [];
    for (const file of files) {
      const fullPath = join(projectRoot, file.relativePath);
      if (!(await this.fs.fileExists(fullPath))) {
        issues.push({
          severity: "error",
          message: `Missing tracked file: ${file.relativePath}`,
          fix: `Restore the file or run \`aidd restore\` to reinstall tracked files.`,
        });
      }
    }
    return issues;
  }

  private async checkOrphanedDirectories(
    manifest: Manifest,
    projectRoot: string
  ): Promise<DoctorIssue[]> {
    const issues: DoctorIssue[] = [];
    const installedToolDirs = manifest.getInstalledDirectories();

    for (const tool of getAllRegisteredTools().values()) {
      if ((await hasToolSignals(this.fs, tool, projectRoot)).length > 0) {
        if (!installedToolDirs.has(tool.directory)) {
          issues.push({
            severity: "warning",
            message: `Orphaned directory: ${tool.directory} (not tracked in manifest)`,
            fix: "Remove the directory manually, or run `aidd install <tool>` to track it.",
          });
        }
      }
    }

    return issues;
  }

  private async checkAuth(): Promise<DoctorIssue[]> {
    if (!this.authReader) return [];
    const token = await this.authReader.resolve();
    if (token === null) {
      return [
        {
          severity: "info",
          message: "Not authenticated",
          fix: "Run aidd auth login",
        },
      ];
    }
    return [];
  }

  private async checkBrokenReferences(
    files: ReadonlyArray<{ relativePath: string; toolId: ToolId | null }>,
    projectRoot: string
  ): Promise<DoctorIssue[]> {
    const issues: DoctorIssue[] = [];

    for (const file of files) {
      if (!file.relativePath.match(/\.(md|mdc)$/)) continue;

      const fullPath = join(projectRoot, file.relativePath);
      if (!(await this.fs.fileExists(fullPath))) continue;

      const content = await this.fs.readFile(fullPath);
      const atRefs = extractAtReferences(content)
        .filter(isFileReference)
        .map((ref) => ({
          ref,
          resolvedPath: join(projectRoot, ref),
        }));
      const linkRefs = extractMarkdownLinkTargets(content)
        .filter(isFileReference)
        .map((ref) => ({
          ref,
          resolvedPath: normalize(join(projectRoot, dirname(file.relativePath), ref)),
        }));

      for (const { ref, resolvedPath } of [...atRefs, ...linkRefs]) {
        if (!(await this.fs.fileExists(resolvedPath))) {
          issues.push({
            severity: "warning",
            message: `Broken reference in ${file.relativePath}: "${ref}" not found on disk`,
            fix: `Restore the missing file or remove the reference in ${file.relativePath}`,
          });
        }
      }
    }

    return issues;
  }
}
