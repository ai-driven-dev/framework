// `docs/COMPATIBILITY.md` is rendered from the stored file by `scripts/sync-generated-docs.mjs`.

import { join } from "node:path";
import { describe, it } from "vitest";
import { foldsFlatMcp } from "../../src/contexts/translate/domain/rules/flat-mcp.js";
import type {
  ArtifactContract,
  ToolBuildContract,
} from "../../src/shared/domain/materialization/build-contract.js";
import { pluginModeOf } from "../contexts/tools/testing/plugin-mode.builder.js";
import { catalogOf, registeredAiConfig } from "../shared/testing/catalog-of.builder.js";
import { REPOSITORY_ROOT } from "../shared/testing/repository-root.builder.js";
import { expectGolden } from "./testing/expect-golden.builder.js";

const SNAPSHOT_FILE = join(REPOSITORY_ROOT, "cli/tests/golden/snapshots/tool-support/surface.json");

const SURFACES = ["skills", "agents", "mcp", "hooks", "rules", "commands"] as const;
type Surface = (typeof SURFACES)[number];

/** `no` is a surface neither the build contract nor the install profile carries; `bridge` is a hooks surface a
 * tool reaches through a generated event bridge instead of a hooks file of its own. */
type Support = "yes" | "bridge" | "no";

interface ToolSupport {
  id: string;
  name: string;
  directory: string;
  pluginMode: string | null;
  /** The tool's own CLI that `aidd` drives to register plugins, or null. */
  nativeCli: string | null;
  /** What a user gets per output layout the tool supports: build output, plus rules from the install profile. */
  builds: Record<string, Record<Surface, Support>>;
}

/** What a user gets through `aidd` for one layout: a build file, the config artifact the build folds MCP
 * into, or the rules section the install profile ships (rules are not part of what `translate` emits). */
function supportOf(surface: Surface, build: ToolBuildContract, installsRules: boolean): Support {
  if (surface === "rules" && installsRules) return "yes";
  if (surface === "mcp" && foldsFlatMcp(build)) return "yes";
  const declared: Partial<Record<string, ArtifactContract>> = build.artifacts;
  const contract = declared[surface];
  if (!contract?.supported) return "no";
  if (surface === "hooks" && contract.skipHooksJson === true && contract.hooksBridge) {
    return "bridge";
  }
  return "yes";
}

function capture(): ToolSupport[] {
  return catalogOf()
    .idsInCanonicalOrder("ai")
    .map((id) => {
      const tool = registeredAiConfig(id);
      const plugins = tool.plugins();
      const builds: ToolSupport["builds"] = {};
      for (const mode of ["marketplace", "flat"] as const) {
        const contract = tool.buildContract(mode);
        if (contract === null) continue;
        builds[mode] = Object.fromEntries(
          SURFACES.map((surface) => [
            surface,
            supportOf(surface, contract, tool.installedRulesLocation() !== null),
          ])
        ) as Record<Surface, Support>;
      }
      return {
        id,
        name: tool.displayName,
        directory: tool.directory,
        pluginMode: plugins === null ? null : pluginModeOf(plugins),
        nativeCli: tool.nativeActivation()?.hostBinary() ?? null,
        builds,
      };
    });
}

describe("tool support surface", () => {
  it("matches the stored record of what each tool is declared to support", async () => {
    await expectGolden(SNAPSHOT_FILE, capture());
  });
});
