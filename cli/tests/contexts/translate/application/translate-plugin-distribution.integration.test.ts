import { describe, expect, it } from "vitest";
import { TranslatePluginDistribution } from "../../../../src/contexts/translate/application/translate-plugin-distribution.js";
import { TOOL } from "../../../shared/testing/registered-tools.js";
import { claudeManifestContent, makeDist } from "../testing/plugin-content-translator-kit.js";
import { codex } from "../testing/registered-profiles.js";

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
