import { describe, expect, it } from "vitest";
import { wireTools } from "../../../../../src/composition/tools.js";
import { GenerateToolDistributionUseCase } from "../../../../../src/contexts/framework/application/restore/generate-tool-distribution-use-case.js";
import { CONFIG_VSCODE_SETTINGS } from "../../../../../src/contexts/tools/contract/config-refs.js";
import type { ToolProfile } from "../../../../../src/contexts/tools/contract/tool-profile.js";
import { FrameworkDescriptor } from "../../../../../src/contexts/translate/domain/canon.js";
import { InstallationFile } from "../../../../../src/kernel/file.js";
import type { ToolId } from "../../../../../src/kernel/tool.js";
import { BundledAssetProviderAdapter } from "../../../../../src/shared/infrastructure/asset-loader.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { FakePlatform } from "../../../../helpers/ports/fake-platform.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { withSections } from "../../../../helpers/ports/stub-ai-tool.js";
import { registeredAiConfig, registeredConfig } from "../../../tools/testing/catalog-of.js";

const PROJECT_ROOT = "/test-project";
const MARKDOWN = "---\nname: sample\ndescription: A sample.\n---\n\nBody.\n";

const descriptor = new FrameworkDescriptor({
  version: "test",
  contentSections: ["agents", "commands", "rules", "skills", "templates"].map((name) => ({
    name,
    directory: name,
    entryFile: null,
  })),
  templateRefs: [],
  configRefs: [{ name: CONFIG_VSCODE_SETTINGS, path: "config/vscode/settings.json" }],
});

const contentFiles = new Map([
  ["agents/reviewer.md", MARKDOWN],
  ["commands/greet.md", MARKDOWN],
  ["rules/naming.md", MARKDOWN],
  ["skills/hello/SKILL.md", MARKDOWN],
  ["templates/AGENTS.md", MARKDOWN],
  ["config/vscode/settings.json", '{"editor.tabSize": 2}'],
]);

const hasher = new DeterministicHasher();
const assets = new BundledAssetProviderAdapter(wireTools());

function generate(
  config: ToolProfile,
  assetProvider?: BundledAssetProviderAdapter
): Promise<InstallationFile[]> {
  return new GenerateToolDistributionUseCase(
    new InMemoryFileAdapter({}, hasher),
    hasher,
    new FakePlatform("linux"),
    assetProvider
  ).execute({ config, descriptor, contentFiles, projectRoot: PROJECT_ROOT });
}

async function pathsFor(toolId: ToolId, assetProvider?: BundledAssetProviderAdapter) {
  return (await generate(registeredConfig(toolId), assetProvider))
    .map((f) => f.relativePath)
    .sort();
}

describe("GenerateToolDistributionUseCase — content sections", () => {
  it("gives an IDE tool its config files and no content section", async () => {
    expect(await pathsFor("vscode")).toStrictEqual([".vscode/settings.json"]);
  });

  it("gives an AI tool one file per content section its capabilities accept", async () => {
    expect(await pathsFor("claude")).toStrictEqual([
      ".claude/agents/reviewer.md",
      ".claude/commands/greet.md",
      ".claude/rules/naming.md",
      ".claude/skills/hello/SKILL.md",
    ]);
  });

  it("skips a section the tool declares no capability for", async () => {
    const claude = registeredAiConfig("claude");

    const paths = (await generate(withSections(claude, { rules: null })))
      .map((f) => f.relativePath)
      .sort();

    expect(paths).toStrictEqual([
      ".claude/agents/reviewer.md",
      ".claude/commands/greet.md",
      ".claude/skills/hello/SKILL.md",
    ]);
  });
});

describe("GenerateToolDistributionUseCase — a tool's own config assets", () => {
  it("regenerates the shared OpenCode plugin runtime alongside tool configuration", async () => {
    const files = await generate(registeredConfig("opencode"), assets);
    expect(
      files.find((file) => file.relativePath === ".opencode/hooks/opencode-events.js")?.content
    ).toBe(assets.loadConfigAsset("opencode", "opencode-events.js"));
  });

  it("writes a JSON asset pretty-printed at the path the tool declares", async () => {
    const files = await generate(registeredConfig("claude"), assets);
    const content = JSON.stringify(assets.loadConfigAsset("claude", "settings.json"), null, 2);

    expect(files.find((f) => f.relativePath === ".claude/settings.json")).toStrictEqual(
      new InstallationFile({
        relativePath: ".claude/settings.json",
        content,
        hash: hasher.hash(content),
      })
    );
  });

  it("writes the files the tool's profile answers for its config, wherever the profile keeps them", async () => {
    const claude = registeredAiConfig("claude");
    const relocated = { ...claude, configFiles: () => ({ "settings.json": ".relocated/s.json" }) };

    const paths = (await generate(relocated, assets)).map((f) => f.relativePath);

    expect(paths).toContain(".relocated/s.json");
    expect(paths).not.toContain(".claude/settings.json");
  });

  it("writes a text asset verbatim", async () => {
    const asset = assets.loadConfigAsset("codex", "config.toml");
    if (typeof asset !== "string") throw new Error("the codex config asset is text");

    const files = await generate(registeredConfig("codex"), assets);

    expect(files.find((f) => f.relativePath === ".codex/config.toml")?.content).toBe(asset);
  });

  it("adds only what a capability loads for a tool that declares no config asset path", async () => {
    const withoutAssets = await pathsFor("copilot");

    expect(await pathsFor("copilot", assets)).toStrictEqual(
      [...withoutAssets, ".vscode/settings.json"].sort()
    );
  });
});
