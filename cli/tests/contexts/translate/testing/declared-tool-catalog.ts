import type { ToolBuildContract } from "../../../../src/contexts/tools/contract/build-contract.js";
import type { ToolCatalog } from "../../../../src/contexts/tools/contract/tool-catalog.js";
import type {
  AiToolProfile,
  FrameworkBuildMode,
} from "../../../../src/contexts/tools/contract/tool-profile.js";
import type { AiToolId } from "../../../../src/shared/domain/tool.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.js";

/** What a synthetic tool declares to the code that reads a catalog for probes and build modes. */
export interface DeclaredTool {
  readonly id: AiToolId;
  readonly manifestPaths?: readonly string[];
  readonly marketplacePaths?: readonly string[];
  readonly buildModes?: readonly FrameworkBuildMode[];
}

/** A contract that stands for any declared mode: the code under test asks whether one exists. */
function someBuildContract(): ToolBuildContract {
  const contract = registeredTools().aiProfile(TOOL.opencode).buildContract("flat");
  if (contract === null) throw new Error("the stand-in build contract is gone");
  return contract;
}

function declaring(declared: DeclaredTool): AiToolProfile {
  const contract = someBuildContract();
  return Object.create(registeredTools().aiProfile(declared.id), {
    distributionPaths: {
      value: (kind: "manifest" | "marketplace") =>
        (kind === "manifest" ? declared.manifestPaths : declared.marketplacePaths) ?? [],
    },
    buildContract: {
      value: (mode: FrameworkBuildMode) => (declared.buildModes?.includes(mode) ? contract : null),
    },
  });
}

/** A catalog of only the given tools, in the order given for help and the registered order for
 * the rest, each declaring only what it is told. Reads delegate to the registered catalog, so
 * it answers every question the contract allows without inventing one. */
export function catalogDeclaring(tools: readonly DeclaredTool[]): ToolCatalog {
  const profiles = new Map(tools.map((tool) => [tool.id, declaring(tool)]));
  const inRegisteredOrder = registeredTools()
    .idsInCanonicalOrder("ai")
    .filter((id) => profiles.has(id));
  return Object.create(registeredTools(), {
    inHelpOrder: { value: () => tools.map((tool) => tool.id) },
    idsInCanonicalOrder: { value: () => inRegisteredOrder },
    aiProfile: { value: (id: AiToolId) => profiles.get(id) },
  });
}
