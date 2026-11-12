import { join } from "node:path";
import {
  AiddFilesDetectedError,
  AlreadyInitializedError,
  NoManifestError,
} from "../../../kernel/errors.js";
import { AIDD_DIR } from "../../../kernel/paths.js";
import type { FileReader } from "../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../kernel/ports/file-writer.js";
import type { ToolProfile } from "../../tools/contract/tool-profile.js";
import { Manifest } from "../domain/manifest.js";
import type { ManifestRepository } from "../domain/ports/manifest-repository.js";
import { GitignoreUseCase } from "./gitignore-use-case.js";

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

interface InitOptions {
  projectRoot: string;
  force?: boolean;
  tools: readonly ToolProfile[];
}

interface InitResult {
  manifest: Manifest;
}

export class InitUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly manifestRepo: ManifestRepository
  ) {}

  async checkPreconditions(
    options: Pick<InitOptions, "projectRoot" | "force" | "tools">
  ): Promise<void> {
    const { projectRoot, force = false, tools } = options;
    const existing = await this.manifestRepo.load();

    if (force) {
      if (existing === null) {
        throw new NoManifestError();
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

  private async hasAiddSignals(
    projectRoot: string,
    tools: readonly ToolProfile[]
  ): Promise<boolean> {
    for (const tool of tools) {
      if ((await detectToolSignals(this.fs, tool, projectRoot)).length > 0) return true;
    }
    return false;
  }

  async execute(options: InitOptions): Promise<InitResult> {
    const { projectRoot, force = false, tools } = options;

    const existing = await this.manifestRepo.load();
    await this.checkPreconditions({ projectRoot, force, tools });

    const manifest = force && existing !== null ? existing : Manifest.create();
    await this.persistInit(manifest, projectRoot, force);
    return { manifest };
  }

  private async persistInit(
    manifest: Manifest,
    projectRoot: string,
    force: boolean
  ): Promise<void> {
    await this.manifestRepo.save(manifest);
    if (!force) {
      await new GitignoreUseCase(this.fs).execute(projectRoot, [`${AIDD_DIR}/cache/`]);
    }
  }
}
