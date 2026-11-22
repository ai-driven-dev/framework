import { describe, expect, it } from "vitest";
import { ConfigureMachineScope } from "../../../../../src/contexts/installation/application/install/configure-machine-scope.use-case.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

function setup(seed: Manifest | null = null) {
  const repo = new InMemoryManifestRepository(seed);
  return { repo, useCase: new ConfigureMachineScope(repo, "9.9.9") };
}

const held = async (created: boolean) => created;

describe("configuring the machine scope", () => {
  describe("given no machine manifest", () => {
    it("creates it and tells the body it did", async () => {
      const { repo, useCase } = setup();

      expect(await useCase.execute({ toolIds: [], whileHeld: held })).toBe(true);
      expect(repo.getCurrent()).not.toBeNull();
    });
  });

  describe("given a machine manifest", () => {
    it("leaves it alone and tells the body it was there", async () => {
      const { repo, useCase } = setup(Manifest.create());

      expect(await useCase.execute({ toolIds: [], whileHeld: held })).toBe(false);
      expect(repo.saveCount).toBe(0);
    });

    it("adds each requested tool with no files, under the running version", async () => {
      const { repo, useCase } = setup(Manifest.create());

      await useCase.execute({ toolIds: [TOOL.claude, TOOL.opencode], whileHeld: held });

      const manifest = repo.getCurrent();
      expect(manifest?.getInstalledToolIds()).toEqual([TOOL.claude, TOOL.opencode]);
      expect(manifest?.getToolVersion(TOOL.claude)).toBe("9.9.9");
      expect(repo.saveCount).toBe(1);
    });

    it("leaves a tool already recorded as it was, and does not save when nothing was added", async () => {
      const seed = Manifest.create();
      seed.addTool(TOOL.claude, "1.0.0", []);
      const { repo, useCase } = setup(seed);

      await useCase.execute({ toolIds: [TOOL.claude], whileHeld: held });

      expect(repo.getCurrent()?.getToolVersion(TOOL.claude)).toBe("1.0.0");
      expect(repo.saveCount).toBe(0);
    });
  });

  it("runs the body holding the machine lock and returns its result", async () => {
    const { repo, useCase } = setup();

    const result = await useCase.execute({
      toolIds: [TOOL.claude],
      whileHeld: async () => repo.getCurrent()?.getInstalledToolIds(),
    });

    expect(result).toEqual([TOOL.claude]);
  });
});
