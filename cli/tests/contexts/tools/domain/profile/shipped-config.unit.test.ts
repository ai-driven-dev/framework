import { describe, expect, it } from "vitest";
import { defineAiTool } from "../../../../../src/contexts/tools/domain/profile/define-tool.js";
import { ConfigSection } from "../../../../../src/contexts/tools/domain/sections/config-section.js";
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
      capabilities: () => ({
        config: [new ConfigSection({ outputPath: ".x/section.json", mergeStrategy: "none" })],
      }),
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

    expect(
      ["settings.json", "bridge.js", "section.json"].map((name) => tool.configAsset(name)?.name)
    ).toEqual(["settings.json", "bridge.js", "section.json"]);
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

describe("a profile's shipped config, asked by name", () => {
  it("answers the one file of that name, and nothing for a name it does not ship", () => {
    const tool = defineAiTool({
      ...aiSpec,
      configAssets: [
        { ...settings, delivery: "install" },
        { ...runtime, delivery: "runtime" },
      ],
    });

    expect(tool.configAsset("bridge.js")).toStrictEqual({ ...runtime, delivery: "runtime" });
    expect(tool.configAsset("absent.json")).toBeUndefined();
  });
});
