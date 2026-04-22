import type { ConfigRef } from "./framework-descriptor.js";
import type { GeneratedFile } from "./generated-file.js";
import { getToolConfig, IDE_TOOL_IDS, type IdeToolId } from "./tool-config.js";

export function filterByIdeRequirements(
  generated: readonly GeneratedFile[],
  configRefs: readonly ConfigRef[],
  installedIdeIds: readonly IdeToolId[]
): GeneratedFile[] {
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
  file: GeneratedFile,
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
