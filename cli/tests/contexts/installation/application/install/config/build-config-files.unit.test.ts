import { describe, expect, it } from "vitest";
import { buildConfigFiles } from "../../../../../../src/contexts/installation/application/install/config/build-config-files.js";
import { TrackedConfigFiles } from "../../../../../../src/contexts/installation/application/install/config/tracked-config-files.use-case.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import {
  buildInstallationDeps,
  initProject,
} from "../../../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { StubAssetProvider } from "../../../../../shared/testing/stub-asset-provider.fake.js";

const PROJECT_ROOT = "/test-project";

async function setup(assetContent: string) {
  const deps = await buildInstallationDeps();
  await initProject(deps, PROJECT_ROOT);
  const assets = new StubAssetProvider(
    { "claude/settings.json": assetContent },
    deps.assetProvider
  );
  const trackedConfigFiles = new TrackedConfigFiles(deps.fs, deps.logger);
  return {
    deps,
    manifest: Manifest.create(),
    configDeps: { trackedConfigFiles, fs: deps.fs, assets },
  };
}

describe("buildConfigFiles", () => {
  it("returns the tool's config asset at its output path with its content hashed", async () => {
    const content = '{ "custom": true }\n';
    const { manifest, configDeps } = await setup(content);

    const files = await buildConfigFiles(configDeps, registeredTools(), {
      toolId: TOOL.claude,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    expect(files.map((f) => [f.relativePath, f.content])).toEqual([
      [".claude/settings.json", content],
    ]);
  });

  it("leaves out a config file the user owns", async () => {
    const { deps, manifest, configDeps } = await setup("{}");
    await deps.fs.writeFile(`${PROJECT_ROOT}/.claude/settings.json`, '{ "mine": true }');

    const files = await buildConfigFiles(configDeps, registeredTools(), {
      toolId: TOOL.claude,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    expect(files).toEqual([]);
  });
});
