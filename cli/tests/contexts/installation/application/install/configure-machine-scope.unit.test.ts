import { describe, expect, it } from "vitest";
import { ConfigureMachineScope } from "../../../../../src/contexts/installation/application/install/configure-machine-scope.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

function setup(seed: Manifest | null = null) {
  const repo = new InMemoryManifestRepository(seed);
  return { repo, useCase: new ConfigureMachineScope(repo, { get: () => "9.9.9" }) };
}

describe("ConfigureMachineScope", () => {
  describe("initialize", () => {
    it("creates the machine manifest when there is none, and says so", async () => {
      const { repo, useCase } = setup();

      expect(await useCase.initialize()).toBe(true);
      expect(repo.getCurrent()).not.toBeNull();
    });

    it("leaves an existing manifest alone, and says so", async () => {
      const { repo, useCase } = setup(Manifest.create());

      expect(await useCase.initialize()).toBe(false);
      expect(repo.saveCount).toBe(0);
    });
  });

  describe("registerTools", () => {
    it("adds each requested tool with no files, under the running version", async () => {
      const { repo, useCase } = setup(Manifest.create());

      await useCase.registerTools([TOOL.claude, TOOL.opencode]);

      const manifest = repo.getCurrent();
      expect(manifest?.getInstalledToolIds()).toEqual([TOOL.claude, TOOL.opencode]);
      expect(manifest?.getToolVersion(TOOL.claude)).toBe("9.9.9");
      expect(repo.saveCount).toBe(1);
    });

    it("leaves a tool already recorded as it was, and does not save when nothing was added", async () => {
      const seed = Manifest.create();
      seed.addTool(TOOL.claude, "1.0.0", []);
      const { repo, useCase } = setup(seed);

      await useCase.registerTools([TOOL.claude]);

      expect(repo.getCurrent()?.getToolVersion(TOOL.claude)).toBe("1.0.0");
      expect(repo.saveCount).toBe(0);
    });

    it("records nothing when there is no manifest to record into", async () => {
      const { repo, useCase } = setup();

      await useCase.registerTools([TOOL.claude]);

      expect(repo.getCurrent()).toBeNull();
    });
  });

  it("runs an action holding the machine lock and returns its result", async () => {
    const { useCase } = setup();

    expect(await useCase.whileLocked(async () => "done")).toBe("done");
  });
});
