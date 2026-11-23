import type { RegisteredCatalog } from "../../../../src/composition/contexts/tools.js";
import type { RegisteredProfile } from "../../../../src/composition/tool-profiles/index.js";
import type {
  AiToolProfile,
  FrameworkBuildMode,
} from "../../../../src/contexts/tools/contract/tool-profile.js";
import type { AiToolId } from "../../../../src/shared/domain/tool.js";
import { buildContractOf } from "../../../shared/testing/build-contract-of.builder.js";
import { catalogOf } from "../../../shared/testing/catalog-of.builder.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { ownMembers } from "./contract-tool-profile.builder.js";

/** What a synthetic tool declares to the code that reads a catalog for probes and build modes. */
export interface DeclaredTool {
  readonly id: AiToolId;
  readonly manifestPaths?: readonly string[];
  readonly marketplacePaths?: readonly string[];
  readonly buildModes?: readonly FrameworkBuildMode[];
}

/** A contract that stands for any declared mode: the code under test asks whether one exists. */
const standInContract = () => buildContractOf(registeredTools(), TOOL.opencode, "flat");

function declaring(declared: DeclaredTool): RegisteredProfile {
  const overrides = {
    distributionPaths: (kind) =>
      (kind === "manifest" ? declared.manifestPaths : declared.marketplacePaths) ?? [],
    buildContract: (mode) => (declared.buildModes?.includes(mode) ? standInContract() : null),
  } satisfies Pick<AiToolProfile, "distributionPaths" | "buildContract">;
  // Only defineAiTool brands a profile: the derived value carries the registered one's brand at runtime, which no type can state here.
  return Object.create(registeredTools().aiProfile(declared.id), ownMembers(overrides));
}

/** The real catalog over only the given tools, in the registered order. A tool declares only its probes and build modes; every other answer is the
 * registered tool's own. An id it was not given is refused. */
export function catalogDeclaring(tools: readonly DeclaredTool[]): RegisteredCatalog {
  const byId = new Map(tools.map((tool) => [tool.id, declaring(tool)]));
  const registered = registeredTools()
    .idsInCanonicalOrder("ai")
    .flatMap((id) => byId.get(id) ?? []);
  return catalogOf(registered);
}
