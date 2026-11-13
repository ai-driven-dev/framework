import { describe, expect, it } from "vitest";
import { PluginDistributionReaderAdapter } from "../../../../src/contexts/framework/infrastructure/plugin-distribution-reader-adapter.js";
import type { PluginDistribution } from "../../../../src/contexts/translate/domain/plugin-distribution.js";
import {
  InvalidPluginManifestError,
  InvalidPluginNameError,
  InvalidPluginVersionError,
} from "../../../../src/shared/domain/errors.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { registeredManifestProbes } from "../../translate/testing/registered-manifest-probes.js";

const IN_MEMORY_ROOT = "/plugins/in-memory";
const IN_MEMORY_MANIFEST = ".claude-plugin/plugin.json";

function readInMemory(manifestText: string): Promise<PluginDistribution> {
  return new PluginDistributionReaderAdapter(
    new InMemoryFileAdapter({ [`${IN_MEMORY_ROOT}/${IN_MEMORY_MANIFEST}`]: manifestText }),
    registeredManifestProbes()
  ).read(IN_MEMORY_ROOT);
}

function readManifest(manifest: Record<string, unknown>): Promise<PluginDistribution> {
  return readInMemory(JSON.stringify(manifest));
}

describe("PluginDistributionReaderAdapter manifest", () => {
  describe("the manifest's fields", () => {
    it("keeps name and version alone when nothing else is declared", async () => {
      const dist = await readManifest({ name: "full", version: "1.0.0" });

      expect(dist.manifest).toStrictEqual({ name: "full", version: "1.0.0" });
    });

    it("keeps a string description", async () => {
      const dist = await readManifest({ name: "full", version: "1.0.0", description: "A plugin" });

      expect(dist.manifest).toStrictEqual({
        name: "full",
        version: "1.0.0",
        description: "A plugin",
      });
    });

    it("drops a description that is not a string", async () => {
      const dist = await readManifest({ name: "full", version: "1.0.0", description: 42 });

      expect(dist.manifest).toStrictEqual({ name: "full", version: "1.0.0" });
    });

    it("keeps the author's name and email", async () => {
      const dist = await readManifest({
        name: "full",
        version: "1.0.0",
        author: { name: "Ann", email: "ann@example.com" },
      });

      expect(dist.manifest).toStrictEqual({
        name: "full",
        version: "1.0.0",
        author: { name: "Ann", email: "ann@example.com" },
      });
    });

    it("keeps the author's name alone when the email is not a string", async () => {
      const dist = await readManifest({
        name: "full",
        version: "1.0.0",
        author: { name: "Ann", email: 5 },
      });

      expect(dist.manifest).toStrictEqual({
        name: "full",
        version: "1.0.0",
        author: { name: "Ann" },
      });
    });

    it("drops an author whose name is not a string", async () => {
      const dist = await readManifest({
        name: "full",
        version: "1.0.0",
        author: { name: 5, email: "ann@example.com" },
      });

      expect(dist.manifest).toStrictEqual({ name: "full", version: "1.0.0" });
    });

    it("drops an author that is null", async () => {
      const dist = await readManifest({ name: "full", version: "1.0.0", author: null });

      expect(dist.manifest).toStrictEqual({ name: "full", version: "1.0.0" });
    });
  });

  describe("a manifest it refuses", () => {
    it("names invalid JSON", async () => {
      await expect(readInMemory("{ not json")).rejects.toThrow(
        new InvalidPluginManifestError("plugin.json is not valid JSON")
      );
    });

    it.each([
      ["null", "null"],
      ["a list", "[]"],
      ["a string", '"full"'],
    ])("names a top level that is %s rather than an object", async (_shape, manifestText) => {
      await expect(readInMemory(manifestText)).rejects.toThrow(
        new InvalidPluginManifestError("plugin.json must be a JSON object")
      );
    });

    it("names a missing name", async () => {
      await expect(readManifest({ version: "1.0.0" })).rejects.toThrow(
        new InvalidPluginManifestError('"name" must be a non-empty string')
      );
    });

    it("names an empty name", async () => {
      await expect(readManifest({ name: "", version: "1.0.0" })).rejects.toThrow(
        new InvalidPluginManifestError('"name" must be a non-empty string')
      );
    });

    it("names a name outside lowercase alphanumerics and hyphens", async () => {
      await expect(readManifest({ name: "Bad Name", version: "1.0.0" })).rejects.toThrow(
        new InvalidPluginNameError("Bad Name")
      );
    });

    it("names a missing version", async () => {
      await expect(readManifest({ name: "full" })).rejects.toThrow(
        new InvalidPluginManifestError('"version" must be a non-empty string')
      );
    });

    it("names an empty version", async () => {
      await expect(readManifest({ name: "full", version: "" })).rejects.toThrow(
        new InvalidPluginManifestError('"version" must be a non-empty string')
      );
    });

    it("names a version that is not semver", async () => {
      await expect(readManifest({ name: "full", version: "latest" })).rejects.toThrow(
        new InvalidPluginVersionError("latest")
      );
    });
  });
});
