import type { ToolBuildContract } from "../../../src/contexts/tools/contract/build-contract.js";

/** A contract that builds nothing: the emptiest valid one. */
export function anEmptyContract(overrides: Partial<ToolBuildContract> = {}): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: { supported: false },
      agents: { supported: false },
      mcp: { supported: false },
      hooks: { supported: false },
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    ...overrides,
  };
}
