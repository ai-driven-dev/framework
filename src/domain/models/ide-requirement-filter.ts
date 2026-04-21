import type { ConfigRef } from "./framework-descriptor.js";
import type { GeneratedFile } from "./generated-file.js";
import type { IdeToolId } from "./tool-config.js";

export function filterByIdeRequirements(
  generated: readonly GeneratedFile[],
  configRefs: readonly ConfigRef[],
  installedIdeIds: readonly IdeToolId[]
): GeneratedFile[] {
  const requiredIdeByPath = new Map<string, IdeToolId>();
  for (const ref of configRefs) {
    if (ref.requiredIdeId !== undefined) {
      requiredIdeByPath.set(ref.path, ref.requiredIdeId);
    }
  }
  return generated.filter((file) => {
    const requiredIde = requiredIdeByPath.get(file.frameworkPath ?? "");
    if (requiredIde === undefined) return true;
    return (installedIdeIds as string[]).includes(requiredIde);
  });
}
