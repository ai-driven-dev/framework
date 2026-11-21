import { join } from "node:path";
import type { FileHash } from "../../../../shared/domain/file-hash.js";
import { InstallationFile } from "../../../../shared/domain/installation-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Prompter } from "../../../../shared/ports/prompter.js";
import { driftOf } from "../../domain/manifest/drift.js";
import { planRestore, type RecordedVerdict } from "../../domain/manifest/restore-plan.js";
import type { DriftCollection, DriftDescriptor } from "./restore-drift-entries.js";
import { restoreDriftEntries } from "./restore-drift-entries.js";

interface DriftEntry {
  relativePath: string;
  content: string;
  reason: "deleted" | "modified";
}

interface RestoreRegularFilesCommand {
  manifestFiles: ReadonlyArray<{ relativePath: string; hash: FileHash }>;
  distMap: Map<string, InstallationFile>;
  projectRoot: string;
  force: boolean;
  interactive: boolean;
  fileFilter: ((p: string) => boolean) | null;
}

export interface RestoreRegularFilesResult {
  restored: string[];
  kept: string[];
  unrestorable: string[];
  updatedFiles: InstallationFile[];
}

export async function restoreRegularFiles(
  fs: FileReader & FileWriter,
  prompter: Prompter,
  options: RestoreRegularFilesCommand
): Promise<RestoreRegularFilesResult | null> {
  const updatedHashMap = new Map(options.manifestFiles.map((f) => [f.relativePath, f.hash]));

  return restoreDriftEntries(
    prompter,
    {
      collectDrift: () =>
        collectDrift(
          fs,
          options.manifestFiles,
          options.distMap,
          options.projectRoot,
          options.fileFilter
        ),
      restore: async (entry) => {
        const diskPath = join(options.projectRoot, entry.relativePath);
        await fs.writeFile(diskPath, entry.content);
        updatedHashMap.set(entry.relativePath, await fs.readFileHash(diskPath));
      },
      buildResult: (restored, kept, unrestorable) => ({
        restored,
        kept,
        unrestorable,
        updatedFiles: Array.from(updatedHashMap.entries()).map(
          ([relativePath, hash]) => new InstallationFile({ relativePath, content: "", hash })
        ),
      }),
    },
    options
  );
}

async function collectDrift(
  fs: FileReader,
  manifestFiles: ReadonlyArray<{ relativePath: string; hash: { value: string } }>,
  distMap: Map<string, InstallationFile>,
  projectRoot: string,
  fileFilter: ((p: string) => boolean) | null
): Promise<DriftCollection<DriftEntry>> {
  const recorded: RecordedVerdict[] = [];
  for (const manifestFile of manifestFiles) {
    if (fileFilter && !fileFilter(manifestFile.relativePath)) continue;
    const diskPath = join(projectRoot, manifestFile.relativePath);
    recorded.push({
      relativePath: manifestFile.relativePath,
      verdict: (await fs.fileExists(diskPath))
        ? driftOf(manifestFile.hash.value, await fs.readFileHash(diskPath))
        : "missing",
    });
  }

  const drift: DriftEntry[] = [];
  const unrestorable: DriftDescriptor[] = [];
  for (const step of planRestore(recorded, new Set(distMap.keys()))) {
    const distFile = distMap.get(step.relativePath);
    if (step.kind === "rewrite" && distFile) {
      drift.push({
        relativePath: step.relativePath,
        content: distFile.content,
        reason: step.reason,
      });
    } else {
      unrestorable.push({ relativePath: step.relativePath, reason: step.reason });
    }
  }
  return { drift, unrestorable };
}
