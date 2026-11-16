import { join } from "node:path";
import {
  AiddFilesDetectedError,
  AlreadyInitializedError,
  ManifestUnavailableError,
} from "../../../shared/domain/errors.js";
import { AIDD_DIR } from "../../../shared/domain/paths.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { ToolProfile } from "../../tools/contract/tool-profile.js";
import { Manifest } from "../domain/manifest.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import { UpdateGitignore } from "./update-gitignore.js";

/** The files of a tool's own signal directory the framework put there: markdown files whose
 * frontmatter names a framework command. Empty when the tool declares no signal directory. */
export async function detectToolSignals(
  fs: FileReader,
  tool: ToolProfile,
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
  tools: ToolCatalog;
}

interface InitProjectResult {
  manifest: Manifest;
}

export class InitProject {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly manifestRepo: ManifestRepository
  ) {}

  async checkPreconditions(
    options: Pick<InitProjectCommand, "projectRoot" | "force" | "tools">
  ): Promise<void> {
    const { projectRoot, force = false, tools } = options;
    const existing = await this.manifestRepo.load();

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

    if (await this.hasAiddSignals(projectRoot, tools)) {
      throw new AiddFilesDetectedError();
    }
  }

  private async hasAiddSignals(projectRoot: string, tools: ToolCatalog): Promise<boolean> {
    for (const tool of tools.sortedById()) {
      if ((await detectToolSignals(this.fs, tool, projectRoot)).length > 0) return true;
    }
    return false;
  }

  async execute(options: InitProjectCommand): Promise<InitProjectResult> {
    const { projectRoot, force = false, tools } = options;

    const existing = await this.manifestRepo.load();
    await this.checkPreconditions({ projectRoot, force, tools });

    const manifest = force && existing !== null ? existing : Manifest.create();
    await this.persistInit(manifest, projectRoot, force);
    return { manifest };
  }

  /** Initializes a project that has no manifest yet and leaves one that has. Answers whether
   * this call created it, which a caller reports as a fresh start or an already-set-up project. */
  async initializeIfAbsent(options: Omit<InitProjectCommand, "force">): Promise<boolean> {
    if ((await this.manifestRepo.load()) !== null) return false;
    await this.execute({ ...options, force: false });
    return true;
  }

  private async persistInit(
    manifest: Manifest,
    projectRoot: string,
    force: boolean
  ): Promise<void> {
    await this.manifestRepo.save(manifest);
    if (!force) {
      await new UpdateGitignore(this.fs).execute(projectRoot, [`${AIDD_DIR}/cache/`]);
    }
  }
}
