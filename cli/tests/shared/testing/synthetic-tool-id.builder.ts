import { RegisteredToolCatalog } from "../../../src/contexts/tools/application/registered-tool-catalog.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import {
  defineAiTool,
  defineIdeTool,
} from "../../../src/contexts/tools/domain/profile/define-tool.js";
import { ConfigSection } from "../../../src/contexts/tools/domain/sections/config-section.js";
import { nativeLayout } from "../../../src/contexts/tools/domain/sections/layout-section.js";
import { manifestSection } from "../../../src/contexts/tools/domain/sections/manifest-section.js";
import { ModelsSection } from "../../../src/contexts/tools/domain/sections/models-section.js";
import { anEmptyContract } from "./empty-build-contract.builder.js";

/** The one file an install of a synthetic tool writes, so that a tool has something to update or lose. */
function shippedSettings(name: string, delivery: "install" | "section") {
  return {
    name: "settings.json",
    content: "{}\n",
    destination: `.${name}/settings.json`,
    delivery,
  };
}

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
    configAssets: [shippedSettings(name, "install")],
  });
}

const CONFIGS = [syntheticConfig("synthetic"), syntheticConfig("syntheticb")] as const;

/** An AI tool id no registry lists: a generic test that only needs some tool names none. */
export const SYNTHETIC_TOOL = CONFIGS[0].toolId;
/** A second tool id no registry lists, for a test that tells two tools apart. */
export const SECOND_SYNTHETIC_TOOL = CONFIGS[1].toolId;

/** A synthetic AI tool id of its own, for a test that tells apart more tools than the two above. */
export function syntheticToolId(name: string) {
  return syntheticConfig(`synthetic${name}`).toolId;
}

const IDE_DIRECTORY = ".syntheticide/";
const IDE_FILES = [
  {
    name: "extensions.json",
    merge: "user-prime",
    content: { recommendations: ["a.b"], unwantedRecommendations: ["c.d"] },
  },
  {
    name: "keybindings.json",
    merge: "none",
    content: [{ key: "ctrl+k", command: "synthetic.run" }],
  },
  { name: "settings.json", merge: "user-prime", content: { "editor.tabSize": 2 } },
] as const;

const IDE_CONFIG = defineIdeTool({
  toolId: "syntheticide",
  directory: IDE_DIRECTORY,
  signalDir: null,
  capabilities: () => ({
    config: IDE_FILES.map(
      (file) =>
        new ConfigSection({ outputPath: `${IDE_DIRECTORY}${file.name}`, mergeStrategy: file.merge })
    ),
  }),
  configAssets: IDE_FILES.map((file) => ({
    name: file.name,
    content: file.content,
    destination: `${IDE_DIRECTORY}${file.name}`,
    delivery: "section" as const,
  })),
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
