import { describe, expect, it } from "vitest";
import { TranslateDistribution } from "../../../../src/contexts/translate/application/translate-distribution.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { claudeManifestContent, makeDist } from "../testing/engine-kit.js";
import { codex } from "../testing/registered-profiles.js";

describe("TranslateDistribution", () => {
  it("carries the source manifest a probe names to a host that reads one", () => {
    const distribution = makeDist();
    const translate = new TranslateDistribution([
      { format: TOOL.claude, relativePath: ".claude-plugin/plugin.json" },
    ]);

    const { files } = translate.execute({ distribution, tool: codex });

    expect(files.find((f) => f.relativePath.endsWith("plugin.json"))?.content).toBe(
      claudeManifestContent
    );
  });
});
