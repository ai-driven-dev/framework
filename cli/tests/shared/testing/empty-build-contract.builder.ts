import type { ToolBuildContract } from "../../../src/contexts/tools/contract/build-contract.js";

/** A contract that builds nothing: the emptiest valid one. */
export function anEmptyContract(overrides: Partial<ToolBuildContract> = {}): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: { supported: false, reason: "off in this test" },
      agents: { supported: false, reason: "off in this test" },
      mcp: { supported: false, reason: "off in this test" },
      hooks: { supported: false, reason: "off in this test" },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    ...overrides,
  };
}
