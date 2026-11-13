import { CapabilityConfigError } from "../../../../shared/domain/errors.js";
import { flatHooksPathWithLoaderEntry } from "../../../../shared/domain/materialization/flat-paths.js";
import type {
  FlatLayout,
  FlatPluginAnswers,
  HooksAcceptance,
  NativePluginAnswers,
  PluginAnswers,
  PluginDelivery,
  UnsupportedPluginAnswers,
} from "../../contract/tool-profile.js";
import type { GlobalFiles } from "../../contract/tool-vocabulary.js";
import {
  AS_SHIPPED,
  type HooksDelivery,
  type HooksSection,
  type ProjectHooksPlacement,
} from "../sections/hooks-section.js";
import type { FlatPlacement, LayoutSection, NativeLayout } from "../sections/layout-section.js";
import type { ManifestSection } from "../sections/manifest-section.js";
import { DEFAULT_PLUGIN_MCP_PATH, type McpSection } from "../sections/mcp-section.js";

const DEFAULT_HOOKS_PATH = "hooks/hooks.json";

/** Whether a hooks delivery can come with this layout: the one rule of the plugin sections that
 * crosses two of them. */
export function deliverySuits(layout: LayoutSection, delivery: HooksDelivery): boolean {
  if (delivery.kind === "none") return true;
  if (layout.mode === "unsupported") return false;
  if (layout.mode === "native") {
    return delivery.kind === "plugin-file" || delivery.kind === "project-merge";
  }
  return (
    delivery.kind === "bridge" || (delivery.kind === "project-merge" && delivery.flat !== undefined)
  );
}

function acceptanceOf(delivery: HooksDelivery): HooksAcceptance {
  return delivery.kind === "none" ? { accepts: false, reason: delivery.reason } : { accepts: true };
}

export function projectPlacement(delivery: HooksDelivery): ProjectHooksPlacement | null {
  if (delivery.kind !== "project-merge") return null;
  return {
    relativePath: delivery.project.relativePath,
    format: delivery.project.format,
    hookScript: delivery.hookScript ?? AS_SHIPPED,
  };
}

function hookScriptOf(delivery: HooksDelivery): (pluginPath: string, content: string) => string {
  return delivery.kind === "none" ? AS_SHIPPED : (delivery.hookScript ?? AS_SHIPPED);
}

function deliveryOf(
  layout: NativeLayout | FlatPlacement | { mode: "unsupported" },
  hooks: HooksSection
): PluginDelivery {
  const files: GlobalFiles | null =
    layout.mode === "unsupported" ? null : (layout.globalFiles ?? null);
  const userScope = layout.mode === "native" && layout.installScope === "user";
  const activation = layout.mode === "native" && layout.activation !== undefined;
  const base = files?.dir;
  return {
    requiresUserScope: () => userScope,
    materializesFromBuiltTree: () => layout.mode === "flat" || userScope,
    deliversHooksToProject: () => projectPlacement(hooks.delivery) !== null,
    supportsUserScopeActivation: () => activation || userScope || files !== null,
    copiesFilesGlobally: () => userScope || files !== null,
    userPluginsBaseDir: (home) =>
      (layout.mode === "native" ? layout.userPluginsDir?.(home) : undefined) ??
      base?.(home) ??
      null,
    globalFiles: () => files,
    hooksAcceptance: () => acceptanceOf(hooks.delivery),
  };
}

function nativeAnswers(
  layout: NativeLayout,
  manifest: ManifestSection,
  hooks: HooksSection,
  mcp: McpSection | null
): NativePluginAnswers {
  const { delivery } = hooks;
  const plugin = mcp?.plugin ?? { accepts: false, relativePath: DEFAULT_PLUGIN_MCP_PATH };
  const hooksFile =
    delivery.kind === "project-merge" && delivery.pluginFile !== undefined
      ? delivery.pluginFile
      : DEFAULT_HOOKS_PATH;
  const trust = delivery.kind === "none" ? null : (delivery.trustNotice ?? null);
  return {
    ...deliveryOf(layout, hooks),
    kind: "native",
    translatesAsMarketplace: () => manifest.translationMode === "marketplace",
    pluginOutputDir: (name) => `${layout.pluginsDir}${name}/`,
    manifestPath: () => manifest.manifestRelativePath,
    rootToken: () => manifest.pluginRootToken,
    trustNotice: () => trust,
    mcpFile: () => ({ accepts: plugin.accepts, relativePath: plugin.relativePath }),
    hooksFilePath: () => hooksFile,
    hookScript: hookScriptOf(delivery),
  };
}

function flatLayoutOf(layout: FlatPlacement, delivery: HooksDelivery): FlatLayout {
  const flat =
    delivery.kind === "bridge" || delivery.kind === "project-merge" ? delivery.flat : undefined;
  return {
    skillLayout: layout.skillLayout,
    namespacePrefix: layout.namespacePrefix,
    hooksDir: flat?.dir ?? null,
    hooksLoaderEntry: flat?.loaderEntry ?? null,
    hooksBridge: flat?.bridge ?? null,
  };
}

function flatAnswers(layout: FlatPlacement, hooks: HooksSection): FlatPluginAnswers {
  const flatLayout = flatLayoutOf(layout, hooks.delivery);
  return {
    ...deliveryOf(layout, hooks),
    kind: "flat",
    flatLayout: () => flatLayout,
    hooksInstallPath: (pluginName, hooksRelativePath) =>
      flatLayout.hooksDir === null
        ? null
        : flatHooksPathWithLoaderEntry(
            flatLayout.hooksDir,
            flatLayout.hooksLoaderEntry,
            pluginName,
            hooksRelativePath
          ),
    hookScript: hookScriptOf(hooks.delivery),
  };
}

/** What a tool answers about how a plugin is delivered, composed from the sections it declares.
 * The caller has checked that they agree (a native layout holds a manifest, a delivery suits
 * its layout). */
export function pluginAnswers(
  layout: LayoutSection,
  manifest: ManifestSection | null,
  hooks: HooksSection,
  mcp: McpSection | null
): PluginAnswers {
  if (layout.mode === "native") {
    if (manifest === null) throw new CapabilityConfigError("a native layout requires a manifest.");
    return nativeAnswers(layout, manifest, hooks, mcp);
  }
  if (layout.mode === "flat") return flatAnswers(layout, hooks);
  const unsupported: UnsupportedPluginAnswers = {
    ...deliveryOf(layout, hooks),
    kind: "unsupported",
  };
  return unsupported;
}
