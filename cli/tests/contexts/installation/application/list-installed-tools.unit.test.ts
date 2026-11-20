import { describe, expect, it } from "vitest";
import { ListInstalledTools } from "../../../../src/contexts/installation/application/list-installed-tools.js";
import { InMemoryManifestRepository } from "../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../testing/manifest.builder.js";

describe("ListInstalledTools", () => {
  it("answers nothing when the project has no manifest", async () => {
    const useCase = new ListInstalledTools(new InMemoryManifestRepository(), registeredTools());

    await expect(useCase.execute({ category: "ai" })).resolves.toEqual([]);
  });

  it("answers only the installed tools of the asked category", async () => {
    const manifest = aManifest().withTool(TOOL.claude, []).withTool(TOOL.vscode, []).build();
    const useCase = new ListInstalledTools(
      new InMemoryManifestRepository(manifest),
      registeredTools()
    );

    await expect(useCase.execute({ category: "ai" })).resolves.toEqual([TOOL.claude]);
    await expect(useCase.execute({ category: "ide" })).resolves.toEqual([TOOL.vscode]);
  });
});
