import { join } from "node:path";
import { AIDD_DIR } from "../../../shared/domain/layout/aidd-layout.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import {
  AiddFilesDetectedError,
  AlreadyInitializedError,
  ManifestUnavailableError,
} from "../domain/installation.error.js";
import { Manifest } from "../domain/manifest.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import type { ToolFootprint } from "../ports/tool-sections.js";
import type { UpdateGitignore } from "./update-gitignore.js";

/** The files of a tool's own signal directory the framework put there: markdown files whose
 * frontmatter names a framework command. Empty when the tool declares no signal directory. */
export async function detectToolSignals(
  fs: FileReader,
  tool: ToolFootprint,
  projectRoot: string
): Promise<string[]> {
  const signal = tool.signalDirectoryIn(projectRoot);
  if (signal === null) return [];
  if (!(await fs.fileExists(signal.absolute))) return [];
  const files = await fs.listDirectory(signal.absolute);
  const matches: string[] = [];
  for (const filePath of files) {
    if (!filePath.endsWith(".md")) continue;
    const content = await fs.readFile(join(signal.absolute, filePath));
    if (/^name:\s*['"]?aidd[_:]/m.test(content)) matches.push(join(signal.relative, filePath));
  }
  return matches;
}

interface InitProjectCommand {
  projectRoot: string;
  force?: boolean;
}

interface InitProjectResult {
  manifest: Manifest;
}

/** What InitProject is built from. */
export interface InitProjectDeps {
  readonly fs: FileReader & FileWriter;
  readonly manifestRepo: ManifestRepository;
  readonly updateGitignore: UpdateGitignore;
}

export class InitProject {
  constructor(
    private readonly deps: InitProjectDeps,
    private readonly tools: ToolCatalog
  ) {}

  private async refuseUnlessInitializable(
    existing: Manifest | null,
    options: Pick<InitProjectCommand, "projectRoot" | "force">
  ): Promise<void> {
    const { projectRoot, force } = options;

    if (force) {
      if (existing === null) {
        throw new ManifestUnavailableError("manifest-missing");
      }
      return;
    }

    if (existing !== null) {
      throw new AlreadyInitializedError(
        `Already initialized. Run \`aidd clean --force\` then \`aidd setup\` to reset completely.`
      );
    }

    if (await this.hasAiddSignals(projectRoot)) {
      throw new AiddFilesDetectedError();
    }
  }

  private async hasAiddSignals(projectRoot: string): Promise<boolean> {
    for (const id of this.tools.sortedIds()) {
      if ((await detectToolSignals(this.deps.fs, this.tools.profile(id), projectRoot)).length > 0) {
        return true;
      }
    }
    return false;
  }

  async execute(options: InitProjectCommand): Promise<InitProjectResult> {
    return this.initialize(await this.deps.manifestRepo.load(), options);
  }

  /** Initializes a project that has no manifest yet and leaves one that has. Answers whether
   * this call created it, which a caller reports as a fresh start or an already-set-up project. */
  async initializeIfAbsent(options: Omit<InitProjectCommand, "force">): Promise<boolean> {
    if ((await this.deps.manifestRepo.load()) !== null) return false;
    await this.initialize(null, { ...options, force: false });
    return true;
  }

  private async initialize(
    existing: Manifest | null,
    options: InitProjectCommand
  ): Promise<InitProjectResult> {
    const { projectRoot, force = false } = options;
    await this.refuseUnlessInitializable(existing, { projectRoot, force });

    // The refusal above leaves a record exactly when `force` asked to reuse it.
    const manifest = existing ?? Manifest.create();
    await this.persistInit(manifest, projectRoot, force);
    return { manifest };
  }

  private async persistInit(
    manifest: Manifest,
    projectRoot: string,
    force: boolean
  ): Promise<void> {
    await this.deps.manifestRepo.save(manifest);
    if (!force) {
      await this.deps.updateGitignore.execute(projectRoot, [`${AIDD_DIR}/cache/`]);
    }
  }
}
