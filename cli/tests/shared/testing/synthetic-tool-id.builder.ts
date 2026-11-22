import { defineAiTool } from "../../../src/contexts/tools/domain/profile/define-tool.js";
import { anEmptyContract } from "./empty-build-contract.builder.js";

/** An AI tool id no registry lists: a generic test that only needs some tool names none. */
export const SYNTHETIC_TOOL = defineAiTool({
  toolId: "synthetic",
  directory: ".synthetic/",
  toolSuffix: ".synthetic.md",
  signalDir: null,
  displayName: "Synthetic",
  buildContracts: { flat: () => anEmptyContract() },
  capabilities: () => ({}),
  linkSyntax: [],
}).toolId;
