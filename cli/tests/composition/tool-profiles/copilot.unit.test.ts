import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copilot } from "../../../src/composition/tool-profiles/copilot.js";
import { CONFIG_MCP } from "../../../src/contexts/tools/contract/config-refs.js";
import {
  pluginTreeShapeOf,
  SHIPPED_AS_IS,
} from "../../contexts/tools/testing/profile-tables.builder.js";
import { registeredAiConfig } from "../../shared/testing/catalog-of.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

describe("copilot declarations the rest of the CLI reads", () => {
  it("writes agents as markdown", () => {
    expect(copilot.section("agents").serialize({ name: "a" }, "body")).toMatch(/^---\n/);
  });

  it("writes agents as markdown frontmatter, not TOML", () => {
    expect(copilot.section("agents").serialize({ name: "a" }, "body")).toBe(
      "---\nname: 'a'\n---\nbody"
    );
  });

  it("delivers VS Code settings through the config section", () => {
    expect(copilot.configAsset("vscode-settings.json")?.delivery).toBe("section");
  });

  it("writes its MCP servers as JSON under `servers`", () => {
    const written = copilot
      .section("mcp")
      .config?.transform(JSON.stringify({ mcpServers: { a: { command: "node" } } }));
    expect(JSON.parse(written)).toStrictEqual({ servers: { a: { command: "node" } } });
    expect(copilot.section("mcp").config?.consumes(CONFIG_MCP)).toBe(true);
  });

  it("drives its own CLI with the verbs it answers to", () => {
    const activation = registeredAiConfig(TOOL.copilot).nativeActivation();
    expect(activation?.hostBinary()).toBe("copilot");
    expect(activation?.cliShape()).toMatchObject({
      upgradeVerb: "update",
      updateVerb: "update",
      enableVerb: "install",
      disableVerb: "uninstall",
      sourceCheckVerb: "update",
      forceRemoveArgs: ["--force"],
    });
    expect(activation?.takesRefForInUse(false)).toBe(false);
  });

  it("writes .vscode/settings.json from the CLI's own asset, gated on VS Code being present", () => {
    const declared = copilot.section("config");
    const settings = Array.isArray(declared) ? declared[0] : declared;
    expect(settings.fileOf("{}")).toMatchObject({
      relativePath: ".vscode/settings.json",
      mergeStrategy: "framework-prime",
    });
    const loaded: string[] = [];
    expect(
      settings.resolveStaticContent((name) => {
        loaded.push(name);
        return "{}";
      })
    ).toBe("{}");
    expect(loaded).toStrictEqual(["vscode-settings.json"]);
    expect(settings.requires("vscode")).toBe(true);
  });
});

describe("copilot build and conversion tables", () => {
  it("ships the plugin tree as it is", () => {
    expect(pluginTreeShapeOf(copilot)).toStrictEqual(SHIPPED_AS_IS);
  });
});

describe("copilot capabilities.plugins", () => {
  it("declares where copilot's own user-scope settings file lives, for --scope user", () => {
    const activation = copilot.nativeActivation();
    expect(activation?.userSettingsFile("/home/tester", () => undefined)).toBe(
      join("/home/tester", ".copilot", "settings.json")
    );
  });
});
