import { describe, expect, it } from "vitest";
import { RegisterFrameworkMarketplace } from "../../../../src/contexts/distribution/application/register-framework-marketplace.use-case.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import { InMemoryMarketplaceRegistry } from "../../../shared/testing/in-memory-marketplace-registry.fake.js";

const PROJECT_ROOT = "/test-project";

describe("registering the framework marketplace", () => {
  it("registers using github source when pluginSource is github", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    const useCase = new RegisterFrameworkMarketplace(registry);

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
      pluginSource: { kind: "github", repo: "ai-driven-dev/framework" },
    });

    expect(result.registered).toBe(true);
    const list = await registry.list(PROJECT_ROOT);
    expect(list[0]?.name).toBe(FRAMEWORK_MARKETPLACE_NAME);
    // Machine scope: the framework entry is shared by every project on this machine,
    // never tied to the one that happened to run `setup` first.
    expect(list[0]?.scope).toBe("user");
    expect(list[0]?.source.kind).toBe("github");
    if (list[0]?.source.kind === "github") {
      expect(list[0]?.source.repo).toBe("ai-driven-dev/framework");
    }
  });

  it("defaults to local dot source when no pluginSource is supplied", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    const useCase = new RegisterFrameworkMarketplace(registry);

    const result = await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(result.registered).toBe(true);
    const list = await registry.list(PROJECT_ROOT);
    expect(list[0]?.source).toEqual({ kind: "local", path: "." });
  });

  it("is idempotent: does not duplicate when called twice", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    const useCase = new RegisterFrameworkMarketplace(registry);

    const first = await useCase.execute({ projectRoot: PROJECT_ROOT });
    const second = await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(first.registered).toBe(true);
    expect(second.registered).toBe(false);
    expect(await registry.list(PROJECT_ROOT)).toHaveLength(1);
  });

  it("writes one entry shared by two projects, none of their own", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    const useCase = new RegisterFrameworkMarketplace(registry);

    const first = await useCase.execute({ projectRoot: "/a", frameworkPath: "/src/framework" });
    const second = await useCase.execute({ projectRoot: "/b", frameworkPath: "/src/framework" });

    expect([first.registered, second.registered]).toEqual([true, false]);
    expect(registry.getAll("/a").map((m) => [m.scope, m.source])).toEqual([
      ["user", { kind: "local", path: "/src/framework" }],
    ]);
  });

  // `list()` puts a project entry first and filters a user one of the same name out, so writing
  // the migrated entry beside a stale project one would leave `list()` answering the old one.
  it("migrates a pre-existing project-scope entry to the shared user-scope one, leaving a single entry", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: FRAMEWORK_MARKETPLACE_NAME,
        scope: "project",
        source: { kind: "local", path: "." },
        addedAt: "2026-01-01T00:00:00Z",
      })
    );

    const result = await new RegisterFrameworkMarketplace(registry).execute({
      projectRoot: PROJECT_ROOT,
    });

    expect(result.registered).toBe(true);
    expect(registry.getAll(PROJECT_ROOT).map((m) => [m.scope, m.addedAt])).toEqual([
      ["user", "2026-01-01T00:00:00Z"],
    ]);
  });

  describe("forced again, as every setup does", () => {
    const REMOTE = { kind: "github" as const, repo: "ai-driven-dev/framework", ref: "v5.14.0" };
    const FETCHED = {
      name: FRAMEWORK_MARKETPLACE_NAME,
      source: { kind: "github", repo: "ai-driven-dev/framework", ref: "v5.14.0" },
      scope: "user",
      addedAt: "2026-11-27T13:17:31.984Z",
      lastFetched: "2026-11-27T13:17:34.635Z",
      version: "5.14.0",
    };

    async function registryHolding(): Promise<InMemoryMarketplaceRegistry> {
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(PROJECT_ROOT, Marketplace.fromJSON(FETCHED));
      return registry;
    }

    it("leaves the entry as it was fetched when the source is the same", async () => {
      const registry = await registryHolding();

      await new RegisterFrameworkMarketplace(registry).execute({
        projectRoot: PROJECT_ROOT,
        pluginSource: REMOTE,
        force: true,
      });

      expect(registry.getAll(PROJECT_ROOT).map((m) => m.toJSON())).toEqual([FETCHED]);
    });

    it("keeps when it was first added, and nothing fetched from the old source, when the source moves", async () => {
      const registry = await registryHolding();

      await new RegisterFrameworkMarketplace(registry).execute({
        projectRoot: PROJECT_ROOT,
        pluginSource: { ...REMOTE, ref: "v5.15.0" },
        force: true,
      });

      expect(registry.getAll(PROJECT_ROOT).map((m) => m.toJSON())).toEqual([
        {
          name: FRAMEWORK_MARKETPLACE_NAME,
          source: { ...FETCHED.source, ref: "v5.15.0" },
          scope: "user",
          addedAt: FETCHED.addedAt,
        },
      ]);
    });
  });
});
