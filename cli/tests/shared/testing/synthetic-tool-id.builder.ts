import { RegisteredToolCatalog } from "../../../src/contexts/tools/application/registered-tool-catalog.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { defineAiTool } from "../../../src/contexts/tools/domain/profile/define-tool.js";
import { anEmptyContract } from "./empty-build-contract.builder.js";

const SYNTHETIC_CONFIG = defineAiTool({
  toolId: "synthetic",
  directory: ".synthetic/",
  toolSuffix: ".synthetic.md",
  signalDir: null,
  displayName: "Synthetic",
  buildContracts: { flat: () => anEmptyContract() },
  capabilities: () => ({}),
  linkSyntax: [],
});

/** An AI tool id no registry lists: a generic test that only needs some tool names none. */
export const SYNTHETIC_TOOL = SYNTHETIC_CONFIG.toolId;

/** A catalog listing only the synthetic tool: what a generic test hands code that asks its tools. */
export function syntheticCatalog(): ToolCatalog {
  return new RegisteredToolCatalog([SYNTHETIC_CONFIG]);
}
