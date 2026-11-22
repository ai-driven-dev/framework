import {
  flatAgentFilePath,
  flatHooksRoutePath,
  flatSkillPath,
  genericFlatHooksFile,
} from "../../../shared/domain/materialization/flat-paths.js";
import type { ArtifactPlacement, FlatHooksBridge, SupportedArtifact } from "./build-contract.js";

/** A flat skills artifact's placement. */
export const skillsIn = (layout: Extract<ArtifactPlacement, { kind: "layout" }>["layout"]) =>
  ({ kind: "layout", layout, of: "skill" }) as const;

/** A flat agents artifact's placement. */
export const agentsIn = (layout: Extract<ArtifactPlacement, { kind: "layout" }>["layout"]) =>
  ({ kind: "layout", layout, of: "agent" }) as const;

/** Where a plugin file lands in an artifact, from the placement it declares. */
export function artifactPath(artifact: SupportedArtifact, plugin: string, relPath: string): string {
  const { placement } = artifact;
  switch (placement.kind) {
    case "layout":
      return (placement.of === "agent" ? flatAgentFilePath : flatSkillPath)(
        placement.layout,
        plugin,
        relPath
      );
    case "relative":
      return relPath;
    case "file":
      return placement.at;
    case "agentFiles":
      return `${placement.dir}/${relPath.replace(/^agents\//, "").replace(/\.md$/, placement.ext)}`;
    case "hooks":
      return flatHooksRoutePath(placement, plugin, relPath);
  }
}

/** Where a plugin's hooks file lands, relative to the output root. */
export function hooksFilePath(
  file: NonNullable<SupportedArtifact["hooksFile"]>,
  plugin: string
): string {
  return "shared" in file.at ? file.at.shared : genericFlatHooksFile(file.at.own, plugin);
}

/** Where the bridge generated for one plugin lands, relative to the project root. */
export function hooksBridgeFilePath(bridge: FlatHooksBridge, plugin: string): string {
  return `${bridge.dir}${plugin}-hooks.js`;
}
