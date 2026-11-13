import { afterEach, describe, expect, it } from "vitest";
import {
  Marketplace,
  type MarketplaceData,
} from "../../../../src/contexts/distribution/domain/marketplace.js";
import type { MarketplaceRegistry } from "../../../../src/contexts/distribution/ports/marketplace-registry.js";

export interface MarketplaceRegistrySubject {
  readonly registry: MarketplaceRegistry;
  readonly projectRoot: string;
  readonly otherProjectRoot: string;
  dispose(): Promise<void>;
}

const entry = (overrides: Partial<MarketplaceData> = {}): Marketplace =>
  Marketplace.fromJSON({
    name: "awesome",
    source: { kind: "github", repo: "owner/awesome" },
    scope: "project",
    addedAt: "2026-04-28T10:00:00.000Z",
    ...overrides,
  });

/** What registering marketplaces promises, whatever holds them. */
export function describeMarketplaceRegistryContract(
  subjectName: string,
  makeSubject: () => Promise<MarketplaceRegistrySubject>
): void {
  describe(`when the marketplace registry is ${subjectName}`, () => {
    const opened: MarketplaceRegistrySubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.dispose();
    });

    async function given(): Promise<MarketplaceRegistrySubject> {
      const subject = await makeSubject();
      opened.push(subject);
      return subject;
    }

    it("lists nothing when nothing was saved", async () => {
      const { registry, projectRoot } = await given();

      expect(await registry.list(projectRoot)).toEqual([]);
    });

    it("lists project entries first, user entries after", async () => {
      const { registry, projectRoot } = await given();
      await registry.save(projectRoot, entry({ name: "p1" }));
      await registry.save(projectRoot, entry({ name: "u1", scope: "user" }));

      const result = await registry.list(projectRoot);

      expect(result.map((m) => [m.name, m.scope])).toEqual([
        ["p1", "project"],
        ["u1", "user"],
      ]);
    });

    it("lets a project entry shadow a user entry of the same name", async () => {
      const { registry, projectRoot } = await given();
      const project = entry({ name: "shared", source: { kind: "github", repo: "owner/project" } });
      await registry.save(projectRoot, project);
      await registry.save(projectRoot, entry({ name: "shared", scope: "user" }));

      expect((await registry.list(projectRoot)).map((m) => m.toJSON())).toEqual([project.toJSON()]);
    });

    it("keeps one user entry for every project, and a project entry in its own", async () => {
      const { registry, projectRoot, otherProjectRoot } = await given();
      await registry.save(projectRoot, entry({ name: "p" }));
      await registry.save(projectRoot, entry({ name: "u", scope: "user" }));
      await registry.save(otherProjectRoot, entry({ name: "u", scope: "user" }));

      expect((await registry.list(otherProjectRoot)).map((m) => m.name)).toEqual(["u"]);
    });

    it("overwrites the entry of the same name in the same scope", async () => {
      const { registry, projectRoot } = await given();
      const first = entry();
      await registry.save(projectRoot, first);
      await registry.save(projectRoot, first.withLastFetched("2026-04-28T11:00:00.000Z"));

      const result = await registry.list(projectRoot);

      expect(result).toHaveLength(1);
      expect(result[0]?.lastFetched).toBe("2026-04-28T11:00:00.000Z");
    });

    it("deletes from the given scope only, and silently when the entry is missing", async () => {
      const { registry, projectRoot } = await given();
      await registry.save(projectRoot, entry({ name: "shared" }));
      await registry.save(projectRoot, entry({ name: "shared", scope: "user" }));

      await registry.delete(projectRoot, "shared", "project");
      expect((await registry.list(projectRoot)).map((m) => m.scope)).toEqual(["user"]);

      await expect(registry.delete(projectRoot, "missing", "project")).resolves.toBeUndefined();
      expect((await registry.list(projectRoot)).map((m) => m.scope)).toEqual(["user"]);
    });

    it("stamps the last fetch of the named entry only", async () => {
      const { registry, projectRoot } = await given();
      await registry.save(projectRoot, entry({ name: "a" }));
      await registry.save(projectRoot, entry({ name: "b" }));

      await registry.updateLastFetched(projectRoot, "a", "project", "2026-04-28T12:00:00.000Z");

      const result = await registry.list(projectRoot);
      expect(result.find((m) => m.name === "a")?.lastFetched).toBe("2026-04-28T12:00:00.000Z");
      expect(result.find((m) => m.name === "b")?.lastFetched).toBeUndefined();
    });
  });
}
