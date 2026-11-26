import { join } from "node:path";
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
  flatRulesPlacement,
  flatSectionPath,
  ownsFlatArtifact,
} from "../../../../shared/domain/materialization/flat-paths.js";
import type {
  ConfigWrite,
  FlatInstallSection,
  PluginAnswers,
  SettingsFileAnswers,
  ShippedConfig,
} from "../../contract/tool-profile.js";
import type { SignalDirectory } from "../../contract/tool-vocabulary.js";
import type { ProfileSection, ProfileSectionKey, ProfileSections } from "../profile.js";
import { AS_SHIPPED } from "../sections/hooks-section.js";
import { pluginAnswers, projectPlacement } from "./plugin-answers.js";

/** Answers from the sections captured at construction, so the method survives being detached
 * and no caller reads the record itself. */
export function sectionReader(
  sections: ProfileSections
): <K extends ProfileSectionKey>(key: K) => ProfileSection<K> | null {
  return (key) => sections[key] ?? null;
}

export function aiConfigWrites(sections: ProfileSections): readonly ConfigWrite[] {
  return [
    ...(sections.mcp?.config === undefined
      ? []
      : [{ kind: "mcp" as const, capability: sections.mcp.config }]),
    ...(sections.hooks?.config === undefined
      ? []
      : [{ kind: "hooks" as const, capability: sections.hooks.config }]),
    ...settingsWrites(sections),
  ];
}

export function settingsWrites(sections: ProfileSections): readonly ConfigWrite[] {
  return settingsOf(sections).map((capability) => ({ kind: "settings" as const, capability }));
}

export function settingsOf(sections: ProfileSections): readonly SettingsFileAnswers[] {
  return sections.config ?? [];
}

export function signalDirectoryOf(
  signalDir: string | null,
  projectRoot: string
): SignalDirectory | null {
  return signalDir === null
    ? null
    : { absolute: join(projectRoot, signalDir), relative: signalDir };
}

/** A tool that does not install flat is never asked where a flat file lands; it answers with the
 * nested layout its own directory would give. */
function flatLayoutOf(directory: string, sections: ProfileSections): FlatArtifactLayout {
  return sections.layout?.mode === "flat"
    ? sections.layout.artifacts
    : flatArtifactLayout(directory, { skills: "nested", agent: { ext: ".md" } });
}

export function pluginsOf(sections: ProfileSections): PluginAnswers | null {
  const { layout, hooks } = sections;
  if (layout === undefined || hooks === undefined) return null;
  return pluginAnswers(layout, {
    manifest: sections.manifest ?? null,
    hooks,
    mcp: sections.mcp ?? null,
  });
}

export function configAssetNamed(
  assets: readonly ShippedConfig[] | undefined,
  name: string
): ShippedConfig | undefined {
  return assets?.find((asset) => asset.name === name);
}

function destinationsOf(
  assets: readonly ShippedConfig[] | undefined,
  delivery: ShippedConfig["delivery"]
): Record<string, string> {
  return Object.fromEntries(
    (assets ?? [])
      .filter((asset) => asset.delivery === delivery)
      .map((a) => [a.name, a.destination])
  );
}

/** Where a flat plugin's files land under the tool's directory, and which of them are its own. */
export function pathAnswers(directory: string, capabilities: ProfileSections) {
  const layout = flatLayoutOf(directory, capabilities);
  return {
    flatInstallPath: (section: FlatInstallSection, pluginName: string, fileName: string) =>
      flatSectionPath(layout, section, { plugin: pluginName, name: fileName }),
    ownsFlatPath: (relativePath: string, pluginName: string) =>
      ownsFlatArtifact(layout, relativePath, pluginName),
    flatRulesPlacement: (pluginName: string) => flatRulesPlacement(layout, pluginName),
  };
}

/** The config files the tool ships and the mcp configuration it keeps. */
export function configAnswers(
  assets: readonly ShippedConfig[] | undefined,
  capabilities: ProfileSections
) {
  return {
    configFiles: () => ({
      ...destinationsOf(assets, "install"),
      ...destinationsOf(assets, "runtime"),
    }),
    runtimeFiles: () => destinationsOf(assets, "runtime"),
    configAsset: (name: string) => configAssetNamed(assets, name),
    mcpConfig: () => capabilities.mcp?.config ?? null,
    flatPluginMcp: () =>
      capabilities.mcp?.config?.isFrameworkPrime() && capabilities.layout?.mode === "flat"
        ? capabilities.mcp.config
        : null,
    settingsFiles: () => settingsOf(capabilities),
  };
}

/** What the tool answers about where an install puts its files and how it keeps them. */
export function deliveryAnswers(displayName: string, capabilities: ProfileSections) {
  return {
    machineLocalFiles: (): readonly string[] => [],
    rulesIndex: () => capabilities.rules?.agentsIndex() ?? null,
    installedRulesLocation: () => capabilities.rules?.installedLocation() ?? null,
    projectHooksDelivery: () => {
      const placement =
        capabilities.hooks === undefined ? null : projectPlacement(capabilities.hooks.delivery);
      return placement === null ? null : { ...placement, toolName: displayName };
    },
    releasedProjectHooks: () => {
      const released = capabilities.hooks?.released;
      return released === undefined
        ? null
        : { ...released, hookScript: AS_SHIPPED, toolName: displayName };
    },
  };
}
