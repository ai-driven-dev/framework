import type { DiskTarget } from "../../../../src/contexts/translate/ports/plugin-tree-sink.js";
import type {
  ArtifactContract,
  ToolBuildContract,
} from "../../../../src/shared/domain/materialization/build-contract.js";

type Supported = Extract<ArtifactContract, { supported: true }>;

/** A supported artifact that lands every file at its own relative path. */
export function aSupportedArtifact(over: Partial<Supported> = {}): ArtifactContract {
  return {
    supported: true,
    source: { kind: "fullTree", srcDir: "." },
    placement: { kind: "relative" },
    ...over,
  };
}

/** A build contract with every artifact supported and no manifest, catalog or config. */
export function aStubBuildContract(over: Partial<ToolBuildContract> = {}): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      agents: aSupportedArtifact(),
      skills: aSupportedArtifact(),
      hooks: aSupportedArtifact(),
      mcp: aSupportedArtifact(),
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    ...over,
  };
}

export function aDiskTarget(
  contract: ToolBuildContract,
  over: Partial<DiskTarget> = {}
): DiskTarget {
  return {
    contract,
    mode: "marketplace",
    force: false,
    sourceDir: "/src",
    outDir: "/out",
    ...over,
  };
}
