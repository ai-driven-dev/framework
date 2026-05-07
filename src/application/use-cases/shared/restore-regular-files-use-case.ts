import { join } from "node:path";
import { type FileHash, InstallationFile } from "../../../domain/models/file.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Prompter } from "../../../domain/ports/prompter.js";
import { ResolveRestoreDecisionUseCase } from "./resolve-restore-decision.js";

interface DriftEntry {
  relativePath: string;
  content: string;
  reason: "deleted" | "modified";
}

interface RestorationResult {
  restored: string[];
  kept: string[];
  updatedHashMap: Map<string, FileHash>;
}

interface RegularFilesRestoreOptions {
  manifestFiles: ReadonlyArray<{ relativePath: string; hash: FileHash }>;
  distMap: Map<string, InstallationFile>;
  projectRoot: string;
  force: boolean;
  interactive: boolean;
  fileFilter: ((p: string) => boolean) | null;
}

export interface RegularFilesRestoreResult {
  restored: string[];
  kept: string[];
  updatedFiles: InstallationFile[];
}

export class RestoreRegularFilesUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly prompter: Prompter
  ) {}

  async execute(options: RegularFilesRestoreOptions): Promise<RegularFilesRestoreResult | null> {
    const drift = await this.collectDrift(
      options.manifestFiles,
      options.distMap,
      options.projectRoot,
      options.fileFilter
    );
    if (drift.length === 0) return null;
    const { restored, kept, updatedHashMap } = await this.applyRestorations(
      drift,
      new Map(options.manifestFiles.map((f) => [f.relativePath, f.hash])),
      options.projectRoot,
      options.force,
      options.interactive
    );
    const updatedFiles = Array.from(updatedHashMap.entries()).map(
      ([relativePath, hash]) => new InstallationFile({ relativePath, content: "", hash })
    );
    return { restored, kept, updatedFiles };
  }

  private async collectDrift(
    manifestFiles: ReadonlyArray<{ relativePath: string; hash: { value: string } }>,
    distMap: Map<string, InstallationFile>,
    projectRoot: string,
    fileFilter: ((p: string) => boolean) | null
  ): Promise<DriftEntry[]> {
    const drift: DriftEntry[] = [];

    for (const manifestFile of manifestFiles) {
      if (fileFilter && !fileFilter(manifestFile.relativePath)) continue;

      const diskPath = join(projectRoot, manifestFile.relativePath);
      const diskExists = await this.fs.fileExists(diskPath);

      if (!diskExists) {
        const distFile = distMap.get(manifestFile.relativePath);
        if (distFile)
          drift.push({
            relativePath: manifestFile.relativePath,
            content: distFile.content,
            reason: "deleted",
          });
        continue;
      }

      const diskHash = await this.fs.readFileHash(diskPath);
      if (diskHash.value !== manifestFile.hash.value) {
        const distFile = distMap.get(manifestFile.relativePath);
        if (distFile)
          drift.push({
            relativePath: manifestFile.relativePath,
            content: distFile.content,
            reason: "modified",
          });
      }
    }

    return drift;
  }

  private async applyRestorations(
    drift: DriftEntry[],
    initialHashMap: Map<string, FileHash>,
    projectRoot: string,
    force: boolean,
    interactive: boolean
  ): Promise<RestorationResult> {
    const restored: string[] = [];
    const kept: string[] = [];
    const updatedHashMap = new Map(initialHashMap);

    for (const { relativePath, content, reason } of drift) {
      const skip = await new ResolveRestoreDecisionUseCase(this.prompter).execute({
        relativePath,
        reason,
        force,
        interactive,
      });
      if (skip) {
        kept.push(relativePath);
        continue;
      }
      await this.fs.writeFile(join(projectRoot, relativePath), content);
      const newHash = await this.fs.readFileHash(join(projectRoot, relativePath));
      updatedHashMap.set(relativePath, newHash);
      restored.push(relativePath);
    }

    return { restored, kept, updatedHashMap };
  }
}
