import { describe, expect, it } from "vitest";
import { codex } from "../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { TranslatePluginDistribution } from "../../../../src/contexts/translate/application/translate-distribution.js";
import { TOOL } from "../../tools/testing/catalog-of.js";
import { claudeManifestContent, makeDist } from "../testing/plugin-content-translator-kit.js";

describe("TranslatePluginDistribution", () => {
  it("carries the source manifest a probe names to a host that reads one", () => {
    const distribution = makeDist();
    const translate = new TranslatePluginDistribution([
      { format: TOOL.claude, relativePath: ".claude-plugin/plugin.json" },
    ]);

    const { files } = translate.execute({ distribution, tool: codex });

    expect(files.find((f) => f.relativePath.endsWith("plugin.json"))?.content).toBe(
      claudeManifestContent
    );
  });
});
