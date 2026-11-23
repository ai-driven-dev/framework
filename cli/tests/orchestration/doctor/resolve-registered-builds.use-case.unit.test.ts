import { describe, expect, it } from "vitest";
import type { ResolveBuiltMarketplaces } from "../../../src/contexts/distribution/application/resolve-built-marketplaces.use-case.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import {
  SYNTHETIC_NATIVE_TOOL,
  syntheticNativeFamilyCatalog,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import { SYNTHETIC_IDE_TOOL } from "../../shared/testing/synthetic-tool-id.builder.js";
import { resolveRegisteredBuildsOver } from "../testing/build-check-registration.builder.js";

function resolverRecording(resolved: (readonly string[])[]) {
  const builds: Pick<ResolveBuiltMarketplaces, "execute"> = {
    execute: async ({ toolIds }) => {
      resolved.push(toolIds);
      return { registeredNames: ["m"], userCacheRoot: "/user-cache", built: new Map() };
    },
  };
  const manifest = aManifest()
    .withTool(SYNTHETIC_NATIVE_TOOL, [], { version: "test" })
    .withTool(SYNTHETIC_IDE_TOOL, [], { version: "test" })
    .build();
  return resolveRegisteredBuildsOver(
    new InMemoryManifestRepository(manifest),
    builds,
    syntheticNativeFamilyCatalog()
  );
}

describe("resolving the marketplaces built for what the manifest registers", () => {
  it("builds for the AI tools the manifest holds, and no IDE tool", async () => {
    const resolved: (readonly string[])[] = [];

    await resolverRecording(resolved).execute({ projectRoot: "/project", allowedIds: null });

    expect(resolved).toStrictEqual([[SYNTHETIC_NATIVE_TOOL]]);
  });

  it("returns every registered tool with what the builds answered", async () => {
    const result = await resolverRecording([]).execute({
      projectRoot: "/project",
      allowedIds: null,
    });

    expect(result.registered.map((r) => r.toolId).sort()).toStrictEqual(
      [SYNTHETIC_IDE_TOOL, SYNTHETIC_NATIVE_TOOL].sort()
    );
    expect(result.registeredNames).toStrictEqual(["m"]);
    expect(result.userCacheRoot).toBe("/user-cache");
  });
});
