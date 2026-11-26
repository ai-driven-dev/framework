import type { ArtifactPlacement, FlatHooksBridge, SupportedArtifact } from "./build-contract.js";
import {
  belowSection,
  flatAgentFilePath,
  flatHooksRoutePath,
  flatRulesPlacement,
  flatSectionPath,
  flatSkillPath,
  genericFlatHooksFile,
  rulesGlobOf,
} from "./flat-paths.js";

/** A flat skills artifact's placement. */
export const skillsIn = (layout: Extract<ArtifactPlacement, { kind: "layout" }>["layout"]) =>
  ({ kind: "layout", layout, of: "skill" }) as const;

/** A flat agents artifact's placement. */
export const agentsIn = (layout: Extract<ArtifactPlacement, { kind: "layout" }>["layout"]) =>
  ({ kind: "layout", layout, of: "agent" }) as const;

/** A flat rules artifact's placement. */
export const rulesIn = (layout: Extract<ArtifactPlacement, { kind: "layout" }>["layout"]) =>
  ({ kind: "layout", layout, of: "rule" }) as const;

/** Where a plugin file lands in an artifact, from the placement it declares. */
export function artifactPath(artifact: SupportedArtifact, plugin: string, relPath: string): string {
  const { placement } = artifact;
  switch (placement.kind) {
    case "layout":
      return layoutPath(placement, plugin, relPath);
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

function layoutPath(
  { layout, of }: Extract<ArtifactPlacement, { kind: "layout" }>,
  plugin: string,
  relPath: string
): string {
  if (of === "agent") return flatAgentFilePath(layout, plugin, relPath);
  if (of === "rule") {
    return flatSectionPath(layout, "rules", { plugin, name: belowSection("rules", relPath) });
  }
  return flatSkillPath(layout, plugin, relPath);
}

/** The glob listing a plugin's rules, when the written `paths` hold any of them: for a rules
 * artifact that sits at the top of a folder, the one place a config can name them. */
export function placedRulesGlobOf(
  rules: SupportedArtifact | { readonly supported: false } | undefined,
  plugin: string,
  paths: Iterable<string>
): string | null {
  if (rules === undefined || !rules.supported || rules.placement.kind !== "layout") return null;
  return rulesGlobOf(flatRulesPlacement(rules.placement.layout, plugin), paths);
}
