import { describe, expect, it, vi } from "vitest";
import { ListFrameworkPlugins } from "../../../../../src/contexts/distribution/application/plugin-source/list-framework-plugins.use-case.js";
import type { ResolveMarketplaceRequest } from "../../../../../src/contexts/distribution/application/resolve-marketplace.use-case.js";
import type { PluginCatalogEntry } from "../../../../../src/contexts/distribution/contract/catalog.js";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";

const CATALOG: PluginCatalogEntry[] = [
  {
    name: "aidd-dev",
    source: { kind: "local", path: "./plugins/aidd-dev" },
    recommended: true,
    strict: true,
  },
  {
    name: "aidd-pm",
    source: { kind: "local", path: "./plugins/aidd-pm" },
    recommended: false,
    strict: true,
  },
];

function framework(scope: Scope, source: Marketplace["source"]): Marketplace {
  return Marketplace.create({
    name: "aidd-framework",
    source,
    scope,
    addedAt: "2026-01-01T00:00:00Z",
  });
}

function setup(marketplaces: Marketplace[]) {
  const resolve = vi.fn(async ({ marketplace }: ResolveMarketplaceRequest) => ({
    marketplace,
    catalog: { plugins: CATALOG },
    localPath: "/fw",
  }));
  return {
    resolve,
    useCase: new ListFrameworkPlugins(
      { list: async () => marketplaces },
      { execute: resolve },
      process.platform
    ),
  };
}

describe("listing the plugins of the framework source", () => {
  it("lists every plugin of the user-scope framework source, under its marketplace", async () => {
    const { useCase } = setup([framework("user", { kind: "local", path: "/fw" })]);

    const matches = await useCase.execute({ projectRoot: "/project" });

    expect(matches.map((m) => [m.marketplaceName, m.entry.name])).toEqual([
      ["aidd-framework", "aidd-dev"],
      ["aidd-framework", "aidd-pm"],
    ]);
  });

  it("resolves each plugin's source against the marketplace it came from", async () => {
    const { useCase } = setup([
      framework("user", { kind: "github", repo: "acme/fw", ref: "v1.0.0" }),
    ]);

    const [first] = await useCase.execute({ projectRoot: "/project" });

    expect(first?.source).toEqual({
      kind: "git-subdir",
      url: "https://github.com/acme/fw.git",
      path: "plugins/aidd-dev",
      ref: "v1.0.0",
    });
  });

  it("refuses when no shared framework source is registered", async () => {
    const { useCase, resolve } = setup([]);

    await expect(useCase.execute({ projectRoot: "/project" })).rejects.toThrow(
      "none is registered"
    );
    expect(resolve).not.toHaveBeenCalled();
  });

  it("does not take a project's own marketplace of the same name for the shared source", async () => {
    const { useCase } = setup([framework("project", { kind: "local", path: "/fw" })]);

    await expect(useCase.execute({ projectRoot: "/project" })).rejects.toThrow(
      "none is registered"
    );
  });
});
