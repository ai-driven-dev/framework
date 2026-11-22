import { RegisteredToolCatalog } from "../../../src/contexts/tools/application/registered-tool-catalog.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import {
  defineAiTool,
  defineIdeTool,
} from "../../../src/contexts/tools/domain/profile/define-tool.js";
import { nativeLayout } from "../../../src/contexts/tools/domain/sections/layout-section.js";
import { manifestSection } from "../../../src/contexts/tools/domain/sections/manifest-section.js";
import { ModelsSection } from "../../../src/contexts/tools/domain/sections/models-section.js";
import { anEmptyContract } from "./empty-build-contract.builder.js";

function syntheticConfig(name: string, providers: readonly string[] = []) {
  return defineAiTool({
    toolId: name,
    directory: `.${name}/`,
    toolSuffix: `.${name}.md`,
    signalDir: null,
    displayName: name,
    buildContracts: { flat: () => anEmptyContract() },
    capabilities: () =>
      providers.length === 0 ? {} : { models: new ModelsSection({ providers }) },
    linkSyntax: [],
  });
}

const CONFIGS = [syntheticConfig("synthetic"), syntheticConfig("syntheticb")] as const;

/** An AI tool id no registry lists: a generic test that only needs some tool names none. */
export const SYNTHETIC_TOOL = CONFIGS[0].toolId;
/** A second tool id no registry lists, for a test that tells two tools apart. */
export const SECOND_SYNTHETIC_TOOL = CONFIGS[1].toolId;

const IDE_CONFIG = defineIdeTool({
  toolId: "syntheticide",
  directory: ".syntheticide/",
  signalDir: null,
  capabilities: () => ({}),
});

/** An IDE tool id no registry lists, for a test that tells the two categories apart. */
export const SYNTHETIC_IDE_TOOL = IDE_CONFIG.toolId;

/** The synthetic IDE tool and both AI tools, the first running the agents on anthropic and the
 * second on openai: for a test that reads both categories or the providers the tools run. */
export function syntheticMixedCatalog(): ToolCatalog {
  return new RegisteredToolCatalog([
    syntheticConfig(SYNTHETIC_TOOL, ["anthropic"]),
    syntheticConfig(SECOND_SYNTHETIC_TOOL, ["openai"]),
    IDE_CONFIG,
  ]);
}

/** A catalog listing only the synthetic tools: what a generic test hands code that asks its tools. */
export function syntheticCatalog(): ToolCatalog {
  return new RegisteredToolCatalog(CONFIGS);
}

/** A catalog listing one synthetic AI tool under the given id, driven through its own host CLI
 * the way a native tool is: for a test of the native activation flow that names no real tool. */
export function syntheticNativeCatalog(id: string): ToolCatalog {
  return new RegisteredToolCatalog([
    defineAiTool({
      toolId: id,
      distributionProbes: {
        manifest: [".plugin/plugin.json"],
        marketplace: [".plugin/marketplace.json"],
      },
      directory: `.${id}/`,
      toolSuffix: `.${id}.md`,
      signalDir: null,
      displayName: id,
      buildContracts: { flat: () => anEmptyContract() },
      capabilities: () => ({
        layout: nativeLayout({
          pluginsDir: `.${id}/plugins/`,
          nativeActivation: {
            binary: id,
            upgradeVerb: "upgrade",
            enableVerb: "add",
            disableVerb: "remove",
          },
        }),
        manifest: manifestSection({ manifestRelativePath: "plugin.json", pluginRootToken: "." }),
        hooks: { delivery: { kind: "plugin-file" } },
      }),
      linkSyntax: [],
    }),
  ]);
}
