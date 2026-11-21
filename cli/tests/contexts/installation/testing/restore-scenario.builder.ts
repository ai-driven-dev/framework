import { join } from "node:path";
import { PluginDistributionLoader } from "../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import type { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import type { AiToolId } from "../../../../src/shared/domain/tool.js";
import type { buildInstallationDeps } from "../../../shared/testing/installation-deps.builder.js";
import { registeredTools } from "../../../shared/testing/registered-tools.builder.js";
import { OverwritePrompter } from "../../../shared/testing/scripted-prompter.fake.js";
import { seedFromDirectory } from "../../../shared/testing/seed-from-directory.builder.js";
import { buildAddPlugin } from "./build-add-plugin.builder.js";
import { restoreAllPluginsOf, restoreOf } from "./build-restore.builder.js";
import { fakeBuildSources, fakeBuiltDeps } from "./fake-build-sources.fake.js";

export const PROJECT_ROOT = "/test-project";
export const PLUGIN_FIXTURE = join(
  process.cwd(),
  "tests/fixtures/plugins/claude-format/sample-plugin"
);

export async function installPlugin(
  deps: Awaited<ReturnType<typeof buildInstallationDeps>>,
  toolId: AiToolId
): Promise<void> {
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  const pluginReader = deps.pluginDistributionReader;
  await buildAddPlugin(
    { fs: deps.fs, logger: deps.logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      distributionLoader: new PluginDistributionLoader(deps.pluginFetcher, pluginReader),
      marketplaceRegistry: deps.marketplaceRegistry,
      ...fakeBuildSources(),
    },
    registeredTools()
  ).execute({
    githubMarketplace: false,
    source: { kind: "local", path: PLUGIN_FIXTURE },
    toolIds: [toolId],
    projectRoot: PROJECT_ROOT,
    interactive: false,
  });
}

export class RecordingPrompter extends OverwritePrompter {
  readonly calls: Array<{ relativePath: string; reason: "deleted" | "modified" }> = [];
  private readonly response: "keep" | "overwrite";

  constructor(response: "keep" | "overwrite" = "overwrite") {
    super();
    this.response = response;
  }

  override async resolveConflict(
    relativePath: string,
    reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite"> {
    this.calls.push({ relativePath, reason });
    return this.response;
  }
}

export function makeRestoreUseCase(
  deps: Awaited<ReturnType<typeof buildInstallationDeps>>,
  prompter = new OverwritePrompter()
) {
  return restoreOf({
    ...deps,
    prompter,
    plugins: restoreAllPluginsOf({ ...deps, builtDeps: fakeBuiltDeps() }),
  });
}

export async function loadedManifest(
  deps: Awaited<ReturnType<typeof buildInstallationDeps>>
): Promise<Manifest> {
  const manifest = await deps.manifestRepo.load();
  if (manifest === null) throw new Error("the project must be initialized first");
  return manifest;
}
