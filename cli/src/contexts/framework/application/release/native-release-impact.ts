import { resolve } from "node:path";
import { builtMarketplaceDir, userBuiltMarketplaceDir } from "../../../../kernel/paths.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { VersionReader } from "../../../../kernel/ports/version-reader.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import type { NativeMarketplaceSourceReader } from "../../../tools/domain/ports/native-marketplace-source-reader.js";
import { getAiToolConfig } from "../../../tools/domain/registry.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { inspectNativeMarketplaceSource } from "../ownership/native-marketplace-source-proof.js";
import type { FrameworkReleaseInput, NativeReleaseInstallation } from "./framework-release-plan.js";

/** Native registries own their installations; the update only verifies the approved impact. */
export class NativeReleaseImpact {
  constructor(
    private readonly deps: {
      fs: FileReader;
      repo: ManifestRepository;
      reader: NativeMarketplaceSourceReader | undefined;
      installations: (catalogue: string) => Promise<readonly NativeReleaseInstallation[]>;
      configDir: string;
      toolId: AiToolId;
      defaultConfigDir: string;
      configVariable: string;
      projectScope: "local" | "project";
      cacheRoot: () => string;
      version: VersionReader;
    }
  ) {}

  async inspect({ manifest, projectRoot: root, targets, marketplace }: FrameworkReleaseInput) {
    const selected = targets.filter((target) => target.toolId === this.deps.toolId);
    if (!selected.length) return { impact: [], shared: false, verify: async () => {} };
    const {
      fs,
      configDir,
      defaultConfigDir,
      toolId,
      configVariable,
      projectScope,
      cacheRoot,
      version,
      reader,
      installations,
      repo,
    } = this.deps;
    const toolName = getAiToolConfig(toolId).displayName;
    if (resolve(configDir) !== resolve(defaultConfigDir))
      throw new Error(
        `Cannot upgrade ${toolName} with a custom ${configVariable}: its marketplace paths are not supported.`
      );
    const catalogues = manifest
      .getNativeRegistrations(toolId)
      ?.marketplaces.filter((entry) => entry.alias === marketplace.name);
    const catalogue =
      catalogues?.length === 1
        ? catalogues[0]
        : catalogues?.length
          ? undefined
          : { alias: marketplace.name, hostName: marketplace.name };
    if (!catalogue) throw new Error(`Cannot verify ${toolName} marketplace identity.`);
    const source = await fs.realpath(
      marketplace.scope === "user"
        ? userBuiltMarketplaceDir(cacheRoot(), version.get(), marketplace.name, toolId)
        : builtMarketplaceDir(root, marketplace.name, toolId)
    );
    const proof = await inspectNativeMarketplaceSource(reader, root, {
      ...catalogue,
      provenance: { kind: "registry", source },
    });
    if (proof.status !== "owned")
      throw new Error(
        `Cannot verify ${toolName} marketplace source: ${proof.reason ?? proof.status}`
      );
    const impact = await installations(catalogue.hostName);
    const here = await fs.realpath(root).catch(() => root);
    const refs = selected.map((target) => `${target.pluginName}@${catalogue.hostName}`);
    for (const ref of refs) {
      if (
        !impact.some(
          (entry) => entry.ref === ref && entry.scope === projectScope && entry.projectPath === here
        )
      )
        throw new Error(
          `Cannot upgrade ${toolId}:${ref.split("@")[0]}: its ${projectScope} installation was not found.`
        );
    }
    return {
      impact,
      tool: toolId,
      shared: impact.some(
        (entry) =>
          !refs.includes(entry.ref) || entry.scope !== projectScope || entry.projectPath !== here
      ),
      verify: async () => {
        if (JSON.stringify(await installations(catalogue.hostName)) !== JSON.stringify(impact))
          throw new Error(
            `${toolName} installations changed after the preview; review the update again.`
          );
        const current = (await repo.load())
          ?.getNativeRegistrations(toolId)
          ?.marketplaces.find((entry) => entry.hostName === catalogue.hostName) ?? {
          alias: catalogue.hostName,
          hostName: catalogue.hostName,
        };
        if (
          (
            await inspectNativeMarketplaceSource(reader, root, {
              ...current,
              provenance: { kind: "registry", source },
            })
          ).status !== "owned"
        )
          throw new Error(
            `${toolName} marketplace source changed after the preview; review the update again.`
          );
      },
    };
  }
}
