import type { BuiltToolConfig } from "../../../src/contexts/tools/domain/profile/define-tool.js";
import { defineAiTool } from "../../../src/contexts/tools/domain/profile/define-tool.js";
import { nativeLayout } from "../../../src/contexts/tools/domain/sections/layout-section.js";
import { anEmptyContract } from "./empty-build-contract.builder.js";

/** The settings file the synthetic activated tool keeps under a home directory. */
export function syntheticActivatedSettingsFile(home: string): string {
  return `${home}/.syntheticactivated/settings.json`;
}

const CONFIG = defineAiTool({
  toolId: "syntheticactivated",
  directory: ".syntheticactivated/",
  toolSuffix: ".syntheticactivated.md",
  signalDir: null,
  displayName: "syntheticactivated",
  buildContracts: { flat: () => anEmptyContract() },
  capabilities: () => ({
    layout: nativeLayout({
      pluginsDir: ".syntheticactivated/plugins/",
      nativeActivation: {
        binary: "syntheticactivated",
        enableVerb: "install",
        disableVerb: "uninstall",
        userSettingsPath: syntheticActivatedSettingsFile,
      },
    }),
    manifest: { manifestRelativePath: null, pluginRootToken: "SYNTHETIC_PLUGIN_ROOT" },
    hooks: { delivery: { kind: "plugin-file" } },
  }),
  linkSyntax: [],
});

/** An AI tool id no registry lists, whose plugins its own CLI activates at user scope. */
export const ACTIVATED_SYNTHETIC_TOOL = CONFIG.toolId;

/** The profile behind `ACTIVATED_SYNTHETIC_TOOL`, for a catalog of a test that reads its activation. */
export const ACTIVATED_SYNTHETIC_CONFIG: BuiltToolConfig = CONFIG;
