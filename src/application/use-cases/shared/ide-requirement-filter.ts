import type { InstallationFile } from "../../../domain/models/file.js";
import type { ConfigRef } from "../../../domain/models/framework.js";
import { getToolConfig, IDE_TOOL_IDS, type IdeToolId } from "../../../domain/tools/registry.js";

export function filterByIdeRequirements(
  generated: readonly InstallationFile[],
  configRefs: readonly ConfigRef[],
  installedIdeIds: readonly IdeToolId[]
): InstallationFile[] {
  const requiredIdeByFrameworkPath = buildFrameworkPathMap(configRefs);
  const requiredIdeByOutputDir = buildOutputDirMap();
  return generated.filter((file) =>
    isAllowed(file, requiredIdeByFrameworkPath, requiredIdeByOutputDir, installedIdeIds)
  );
}

function buildFrameworkPathMap(configRefs: readonly ConfigRef[]): Map<string, IdeToolId> {
  const map = new Map<string, IdeToolId>();
  for (const ref of configRefs) {
    if (ref.requiredIdeId !== undefined) {
      map.set(ref.path, ref.requiredIdeId);
    }
  }
  return map;
}

function buildOutputDirMap(): Map<string, IdeToolId> {
  const map = new Map<string, IdeToolId>();
  for (const ideId of IDE_TOOL_IDS) {
    const config = getToolConfig(ideId);
    map.set(config.directory, ideId);
  }
  return map;
}

function isAllowed(
  file: InstallationFile,
  byFrameworkPath: Map<string, IdeToolId>,
  byOutputDir: Map<string, IdeToolId>,
  installedIdeIds: readonly IdeToolId[]
): boolean {
  const requiredByRef = byFrameworkPath.get(file.frameworkPath ?? "");
  if (requiredByRef !== undefined) {
    return (installedIdeIds as string[]).includes(requiredByRef);
  }
  for (const [dir, ideId] of byOutputDir) {
    if (file.relativePath.startsWith(dir)) {
      return (installedIdeIds as string[]).includes(ideId);
    }
  }
  return true;
}
