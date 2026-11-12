import { describe, expect, it } from "vitest";
import { defineAiTool } from "../../../../../src/contexts/tools/domain/profile/define-tool.js";
import { copilot } from "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { vscode } from "../../../../../src/contexts/tools/domain/profiles/vscode/profile.js";
import { anEmptyContract } from "../../testing/profiles.js";

const aiSpec = {
  toolId: "claude",
  directory: ".x/",
  toolSuffix: ".claude.md",
  signalDir: null,
  displayName: "X",
  buildContracts: { flat: () => anEmptyContract() },
  capabilities: () => ({}),
  rewriteContent: (content: string) => content,
};

const settings = { name: "settings.json", content: { a: 1 }, destination: ".x/settings.json" };
const runtime = { name: "bridge.js", content: "// js", destination: ".x/bridge.js" };

describe("a profile's shipped config", () => {
  it("is declared once per file, with its content and its destination", () => {
    const tool = defineAiTool({
      ...aiSpec,
      configAssets: [
        { ...settings, delivery: "install" },
        { ...runtime, delivery: "runtime" },
        {
          name: "section.json",
          content: "{}",
          destination: ".x/section.json",
          delivery: "section",
        },
      ],
    });

    expect(tool.configAssets().map((asset) => asset.name)).toEqual([
      "settings.json",
      "bridge.js",
      "section.json",
    ]);
    expect(tool.configFiles()).toStrictEqual({
      "settings.json": ".x/settings.json",
      "bridge.js": ".x/bridge.js",
    });
    expect(tool.runtimeFiles()).toStrictEqual({ "bridge.js": ".x/bridge.js" });
  });

  it("cannot name a file without saying where it goes", () => {
    defineAiTool({
      ...aiSpec,
      // @ts-expect-error a shipped file without a destination does not type-check
      configAssets: [{ name: "settings.json", content: {}, delivery: "install" }],
    });
  });
});

describe("a file delivered by a settings section", () => {
  it.each([copilot, vscode])("lands where $toolId's section writes it", (tool) => {
    const written = tool.settingsFiles().map((section) => section.outputPath());
    const sectionOwned = tool.configAssets().filter((asset) => asset.delivery === "section");

    expect(sectionOwned.length).toBeGreaterThan(0);
    for (const asset of sectionOwned) expect(written).toContain(asset.destination);
  });
});
