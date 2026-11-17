import { RegisteredToolCatalog } from "../../../../src/contexts/tools/application/registered-tool-catalog.js";
import type { ToolCatalog } from "../../../../src/contexts/tools/contract/tool-catalog.js";
import type { FrameworkBuildMode } from "../../../../src/contexts/tools/contract/tool-profile.js";
import type { BuiltToolConfig } from "../../../../src/contexts/tools/domain/profile/define-tool.js";
import type { AiToolId } from "../../../../src/shared/domain/tool.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.js";
import { buildContractOf } from "./registered-build-contracts.js";

/** What a synthetic tool declares to the code that reads a catalog for probes and build modes. */
export interface DeclaredTool {
  readonly id: AiToolId;
  readonly manifestPaths?: readonly string[];
  readonly marketplacePaths?: readonly string[];
  readonly buildModes?: readonly FrameworkBuildMode[];
}

/** A contract that stands for any declared mode: the code under test asks whether one exists. */
const standInContract = () => buildContractOf(TOOL.opencode, "flat");

function declaring(declared: DeclaredTool): BuiltToolConfig {
  return Object.create(registeredTools().aiProfile(declared.id), {
    distributionPaths: {
      value: (kind: "manifest" | "marketplace") =>
        (kind === "manifest" ? declared.manifestPaths : declared.marketplacePaths) ?? [],
    },
    buildContract: {
      value: (mode: FrameworkBuildMode) =>
        declared.buildModes?.includes(mode) ? standInContract() : null,
    },
  });
}

/** The real catalog over only the given tools: help order is the order given, canonical order the
 * registered one. Each tool declares only what it is told, so the catalog answers every question
 * the contract allows, and refuses an id it was not given. */
export function catalogDeclaring(tools: readonly DeclaredTool[]): ToolCatalog {
  const byId = new Map(tools.map((tool) => [tool.id, declaring(tool)]));
  const canonical = registeredTools()
    .idsInCanonicalOrder("ai")
    .flatMap((id) => byId.get(id) ?? []);
  return new RegisteredToolCatalog([...byId.values()], canonical);
}
