import { RegisteredToolCatalog } from "../../../src/contexts/tools/application/registered-tool-catalog.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { defineAiTool } from "../../../src/contexts/tools/domain/profile/define-tool.js";
import { anEmptyContract } from "./empty-build-contract.builder.js";

function syntheticConfig(name: string) {
  return defineAiTool({
    toolId: name,
    directory: `.${name}/`,
    toolSuffix: `.${name}.md`,
    signalDir: null,
    displayName: name,
    buildContracts: { flat: () => anEmptyContract() },
    capabilities: () => ({}),
    linkSyntax: [],
  });
}

const CONFIGS = [
  syntheticConfig("synthetic"),
  syntheticConfig("syntheticb"),
  syntheticConfig("syntheticc"),
] as const;

/** An AI tool id no registry lists: a generic test that only needs some tool names none. */
export const SYNTHETIC_TOOL = CONFIGS[0].toolId;
/** A second tool id no registry lists, for a test that tells two tools apart. */
export const SECOND_SYNTHETIC_TOOL = CONFIGS[1].toolId;
/** A third tool id no registry lists. */
export const THIRD_SYNTHETIC_TOOL = CONFIGS[2].toolId;

/** A catalog listing only the synthetic tools: what a generic test hands code that asks its tools. */
export function syntheticCatalog(): ToolCatalog {
  return new RegisteredToolCatalog(CONFIGS);
}
