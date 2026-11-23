import { describe, expect, it } from "vitest";
import { wireTools } from "../../../../../src/composition/contexts/tools.js";
import { InstallConfig } from "../../../../../src/contexts/installation/application/install/install-config.use-case.js";
import { GenerateToolDistribution } from "../../../../../src/contexts/installation/application/restore/generate-tool-distribution.use-case.js";
import type { ToolProfile } from "../../../../../src/contexts/tools/contract/tool-profile.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import type { ToolId } from "../../../../../src/shared/domain/tool.js";
import { BundledAssetProviderAdapter } from "../../../../../src/shared/infrastructure/asset-loader.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakePlatform } from "../../testing/fake-platform.fake.js";

const PROJECT_ROOT = "/test-project";

const configRefs = [{ name: "vscodeSettings", path: "config/vscode/settings.json" }];

const contentFiles = new Map([["config/vscode/settings.json", '{"editor.tabSize": 2}']]);

const assets = new BundledAssetProviderAdapter(wireTools());

function generate(
  config: ToolProfile,
  assetProvider?: BundledAssetProviderAdapter
): Promise<InstallationFile[]> {
  return new GenerateToolDistribution(
    new InstallConfig(new InMemoryFileAdapter({})),
    new FakePlatform("linux"),
    assetProvider
  ).execute({ config, configRefs, contentFiles, projectRoot: PROJECT_ROOT });
}

async function pathsFor(toolId: ToolId, assetProvider?: BundledAssetProviderAdapter) {
  return (await generate(registeredTools().profile(toolId), assetProvider))
    .map((f) => f.relativePath)
    .sort();
}

describe("GenerateToolDistribution - IDE tools", () => {
  it("gives an IDE tool its config files and no content section", async () => {
    expect(await pathsFor(TOOL.vscode)).toStrictEqual([".vscode/settings.json"]);
  });
});

describe("GenerateToolDistribution - a tool's own config assets", () => {
  it("regenerates the shared OpenCode plugin runtime alongside tool configuration", async () => {
    const files = await generate(registeredTools().profile(TOOL.opencode), assets);
    expect(
      files.find((file) => file.relativePath === ".opencode/hooks/opencode-events.js")?.content
    ).toBe(assets.loadConfigAsset(TOOL.opencode, "opencode-events.js"));
  });

  it("writes a JSON asset pretty-printed at the path the tool declares", async () => {
    const files = await generate(registeredTools().profile(TOOL.claude), assets);
    const content = JSON.stringify(assets.loadConfigAsset(TOOL.claude, "settings.json"), null, 2);

    expect(files.find((f) => f.relativePath === ".claude/settings.json")).toStrictEqual(
      new InstallationFile({
        relativePath: ".claude/settings.json",
        content,
        hash: FileHash.of(content),
      })
    );
  });

  it("writes the files the tool's profile answers for its config, wherever the profile keeps them", async () => {
    const claude = registeredTools().aiProfile(TOOL.claude);
    const relocated = { ...claude, configFiles: () => ({ "settings.json": ".relocated/s.json" }) };

    const paths = (await generate(relocated, assets)).map((f) => f.relativePath);

    expect(paths).toContain(".relocated/s.json");
    expect(paths).not.toContain(".claude/settings.json");
  });

  it("writes a text asset verbatim", async () => {
    const asset = assets.loadConfigAsset(TOOL.codex, "config.toml");
    if (typeof asset !== "string") throw new Error("the codex config asset is text");

    const files = await generate(registeredTools().profile(TOOL.codex), assets);

    expect(files.find((f) => f.relativePath === ".codex/config.toml")?.content).toBe(asset);
  });

  it("adds only what a capability loads for a tool that declares no config asset path", async () => {
    const withoutAssets = await pathsFor(TOOL.copilot);

    expect(await pathsFor(TOOL.copilot, assets)).toStrictEqual(
      [...withoutAssets, ".vscode/settings.json"].sort()
    );
  });
});
