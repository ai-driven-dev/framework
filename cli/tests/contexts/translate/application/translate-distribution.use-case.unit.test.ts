import { describe, expect, it } from "vitest";
import { TranslateDistribution } from "../../../../src/contexts/translate/application/translate-distribution.use-case.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { makeDist } from "../testing/engine-kit.builder.js";
import { codex } from "../testing/registered-profiles.builder.js";

describe("translating a distribution", () => {
  it("synthesizes the manifest from the source a probe names to a host that reads one", () => {
    const distribution = makeDist();
    const translate = new TranslateDistribution([
      { format: TOOL.claude, relativePath: ".claude-plugin/plugin.json" },
    ]);

    const { files } = translate.execute({ distribution, tool: codex });

    const manifest = files.find((f) => f.relativePath.endsWith("plugin.json"))?.content ?? "{}";
    expect(JSON.parse(manifest)).toMatchObject({ name: "sample-plugin", version: "1.0.0" });
  });
});
