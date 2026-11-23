import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ResolveBuiltMarketplaces } from "../../../../src/contexts/distribution/application/resolve-built-marketplaces.use-case.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import {
  builtMarketplaceDir,
  userBuiltMarketplaceDir,
} from "../../../../src/shared/domain/layout/aidd-layout.js";
import type { Scope } from "../../../../src/shared/domain/scope.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceRegistry } from "../../../shared/testing/in-memory-marketplace-registry.fake.js";
import { SYNTHETIC_TOOL } from "../../../shared/testing/synthetic-tool-id.builder.js";

const PROJECT = resolve("/project");
const USER_ROOT = resolve("/user-config");
const VERSION = "1.2.3";
const TOOL_ID = SYNTHETIC_TOOL;

/** What the in-memory `realpath` answers: `resolve`d, spelled with "/" as the fake spells every path. */
function virtual(path: string): string {
  return resolve(path).replaceAll("\\", "/");
}

function registered(name: string, scope: Scope): Marketplace {
  return Marketplace.create({
    name,
    source: { kind: "local", path: `/mkt/${name}` },
    scope,
    addedAt: "2026-01-01T00:00:00.000Z",
  });
}

async function resolverOver(
  built: readonly string[],
  ...marketplaces: Marketplace[]
): Promise<ResolveBuiltMarketplaces> {
  const registry = new InMemoryMarketplaceRegistry();
  for (const marketplace of marketplaces) await registry.save(PROJECT, marketplace);
  const fs = new InMemoryFileAdapter();
  for (const dir of built) fs.setFile(join(dir, "marker"), "");
  return new ResolveBuiltMarketplaces({
    fs,
    registry,
    userCacheRoot: () => USER_ROOT,
    currentVersion: VERSION,
  });
}

describe("finding the builds of registered marketplaces", () => {
  it("finds a project marketplace's build under the project", async () => {
    const dir = builtMarketplaceDir(PROJECT, "mine", TOOL_ID);
    const resolver = await resolverOver([dir], registered("mine", "project"));

    const { built } = await resolver.execute({ projectRoot: PROJECT, toolIds: [TOOL_ID] });

    expect(built.get(TOOL_ID)).toEqual([{ name: "mine", builtDir: virtual(dir) }]);
  });

  it("finds a user marketplace's build under the user cache, per version", async () => {
    const dir = userBuiltMarketplaceDir({
      userConfigDir: USER_ROOT,
      cliVersion: VERSION,
      marketplaceName: "shared",
      target: TOOL_ID,
    });
    const resolver = await resolverOver([dir], registered("shared", "user"));

    const { built } = await resolver.execute({ projectRoot: PROJECT, toolIds: [TOOL_ID] });

    expect(built.get(TOOL_ID)).toEqual([{ name: "shared", builtDir: virtual(dir) }]);
  });

  it("looks for the framework marketplace under the user cache even when recorded at project scope", async () => {
    const dir = userBuiltMarketplaceDir({
      userConfigDir: USER_ROOT,
      cliVersion: VERSION,
      marketplaceName: FRAMEWORK_MARKETPLACE_NAME,
      target: TOOL_ID,
    });
    const resolver = await resolverOver([dir], registered(FRAMEWORK_MARKETPLACE_NAME, "project"));

    const { built } = await resolver.execute({ projectRoot: PROJECT, toolIds: [TOOL_ID] });

    expect(built.get(TOOL_ID)).toEqual([
      { name: FRAMEWORK_MARKETPLACE_NAME, builtDir: virtual(dir) },
    ]);
  });

  it("leaves out a marketplace that was never built", async () => {
    const resolver = await resolverOver([], registered("mine", "project"));

    const result = await resolver.execute({ projectRoot: PROJECT, toolIds: [TOOL_ID] });

    expect(result.built.get(TOOL_ID)).toEqual([]);
    expect(result.projectScopedNames).toEqual(["mine"]);
    expect(result.userCacheRoot).toBe(USER_ROOT);
  });
});
