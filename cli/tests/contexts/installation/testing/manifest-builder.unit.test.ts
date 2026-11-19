import { describe, expect, it } from "vitest";
import { InstalledPlugin } from "../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { FileHash, InstallationFile } from "../../../../src/shared/domain/file.js";
import { TOOL } from "../../../shared/testing/registered-tools.js";
import { aManifest } from "./manifest-builder.js";

const file = (relativePath: string): InstallationFile =>
  new InstallationFile({
    relativePath,
    content: "content",
    hash: new FileHash("a".repeat(32)),
  });

const plugin = InstalledPlugin.fromJSON({
  name: "aidd-dev",
  source: { kind: "local", path: "/fixture" },
  version: "1.0.0",
  strict: false,
  files: {},
  scope: "project",
});

describe("aManifest", () => {
  it("builds an empty manifest", () => {
    expect(aManifest().build().getInstalledToolIds()).toEqual([]);
  });

  it("installs each tool with its files, at the version given or a default", () => {
    const manifest = aManifest()
      .withTool(TOOL.claude, [file(".claude/rules/a.md")])
      .withTool(TOOL.cursor, [file(".cursor/rules/b.mdc")], { version: "2.0.0" })
      .build();

    expect(manifest.getToolFiles(TOOL.claude).map((f) => f.relativePath)).toEqual([
      ".claude/rules/a.md",
    ]);
    expect(manifest.getToolVersion(TOOL.cursor)).toBe("2.0.0");
    expect(manifest.getToolVersion(TOOL.claude)).toBe("1.0.0");
  });

  it("installs a plugin under a tool", () => {
    const manifest = aManifest().withTool(TOOL.claude, []).withPlugin(TOOL.claude, plugin).build();

    expect(manifest.getPlugins(TOOL.claude)).toEqual([plugin]);
  });
});
