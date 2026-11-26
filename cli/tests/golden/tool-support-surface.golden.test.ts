// `docs/COMPATIBILITY.md` is rendered from the stored file by `scripts/sync-generated-docs.mjs`.

import { join, posix } from "node:path";
import { describe, it } from "vitest";
import type { AiToolProfile } from "../../src/contexts/tools/contract/tool-profile.js";
import { foldsFlatMcp } from "../../src/contexts/translate/domain/rules/flat-mcp.js";
import type {
  ArtifactContract,
  ToolBuildContract,
} from "../../src/shared/domain/materialization/build-contract.js";
import type { PluginPresence } from "../../src/shared/domain/materialization/plugin-presence.js";
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
  /** The directory of the project where the tool loads each plugin's tree that `aidd` writes there
   * itself, a native plugin install and no marketplace the tool could register; or null. */
  pluginTree: string | null;
  /** What a user gets per output layout the tool supports: build output, plus the rules and commands the install
   * profile ships. */
  builds: Record<string, Record<Surface, Support>>;
}

const ONE_SERVER: PluginPresence = {
  hasAgents: false,
  agentsList: [],
  skillsList: [],
  hasHooksJson: false,
  hooks: {},
  hasMcpJson: true,
  mcpServers: { probe: {} },
};

/** Whether the plugin manifest the build synthesizes carries a plugin's servers itself. */
function carriesMcpInManifest(build: ToolBuildContract): boolean {
  return "mcpServers" in (build.synthesizeManifest?.({}, ONE_SERVER) ?? {});
}

/** What a user gets through `aidd` for one layout: a build file, the config artifact the build folds MCP
 * into, the manifest that carries it, or a section the install profile ships. */
function supportOf(
  surface: Surface,
  build: ToolBuildContract,
  installs: ReadonlySet<Surface>
): Support {
  if (installs.has(surface)) return "yes";
  if (surface === "mcp" && (foldsFlatMcp(build) || carriesMcpInManifest(build))) return "yes";
  const declared: Partial<Record<string, ArtifactContract>> = build.artifacts;
  const contract = declared[surface];
  if (!contract?.supported) return "no";
  if (surface === "hooks" && contract.skipHooksJson === true && contract.hooksBridge) {
    return "bridge";
  }
  return "yes";
}

/** The sections the install profile ships, whichever layout the build is read for. */
function installedSurfaces(tool: AiToolProfile): ReadonlySet<Surface> {
  return new Set<Surface>([
    ...(tool.installedRulesLocation() === null ? [] : (["rules"] as const)),
    ...(tool.markdownSection("commands") === null ? [] : (["commands"] as const)),
  ]);
}

function pluginTreeOf(plugins: ReturnType<AiToolProfile["plugins"]>): string | null {
  if (plugins?.kind !== "native" || plugins.requiresUserScope()) return null;
  // The directory holding one plugin's own, which the answers name only through a plugin.
  return plugins.materializesFromBuiltTree()
    ? `${posix.dirname(plugins.pluginOutputDir("p").slice(0, -1))}/`
    : null;
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
            supportOf(surface, contract, installedSurfaces(tool)),
          ])
        ) as Record<Surface, Support>;
      }
      return {
        id,
        name: tool.displayName,
        directory: tool.directory,
        pluginMode: plugins === null ? null : pluginModeOf(plugins),
        nativeCli: tool.nativeActivation()?.hostBinary() ?? null,
        pluginTree: pluginTreeOf(plugins),
        builds,
      };
    });
}

describe("tool support surface", () => {
  it("matches the stored record of what each tool is declared to support", async () => {
    await expectGolden(SNAPSHOT_FILE, capture());
  });
});
