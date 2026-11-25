import { describe, expect, it } from "vitest";
import { ListMarketplaces } from "../../../src/contexts/distribution/application/list-marketplaces.use-case.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { readMachineClaims } from "../../../src/contexts/machine-claims/application/removal/read-machine-claims.js";
import { ResolvePurgeCandidate } from "../../../src/contexts/machine-claims/application/resolve-purge-candidate.use-case.js";
import {
  claimReleaseOf,
  projectCleanFactsOf,
} from "../../../src/orchestration/clean/clean-claims.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";

const PROJECT_ROOT = "/project";

async function factsOver(registered: readonly { name: string; scope: Scope }[]) {
  const registry = new InMemoryMarketplaceRegistry();
  for (const { name, scope } of registered)
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name,
        scope,
        source: { kind: "local", path: "/built" },
        addedAt: "2026-01-01T00:00:00Z",
      })
    );
  const machine = new InMemoryManifestRepository();
  const claims = {
    frameworkMarketplaceName: "aidd",
    machineClaims: readMachineClaims(machine),
    exclusive: machine,
    purgeCache: new ResolvePurgeCandidate(new InMemoryFileAdapter(), new CapturingLogger()),
  };
  return projectCleanFactsOf(claims, new ListMarketplaces(registry))(PROJECT_ROOT);
}

describe("the clean claims bound for one project", () => {
  it("reads the facts of the project from its registered marketplaces", async () => {
    const facts = await factsOver([
      { name: "aidd", scope: "user" },
      { name: "team", scope: "project" },
    ]);

    expect(facts.projectRoot).toBe(PROJECT_ROOT);
    expect(facts.frameworkAlias).toBe("aidd");
    expect([...facts.marketplaceScopes]).toEqual([
      ["team", "project"],
      ["aidd", "user"],
    ]);
  });

  it("releases the shared source before the refs and user plugins", async () => {
    const calls: string[] = [];
    const release = claimReleaseOf({
      dropClaim: async (root) => {
        calls.push(`drop ${root}`);
      },
      detach: async (projectRoot, userPlugins, nativeRefs) => {
        calls.push(`detach ${projectRoot} ${userPlugins.length} ${nativeRefs.size}`);
      },
    });

    await release(PROJECT_ROOT, { userPlugins: [], nativeRefs: new Map() }, "/shared");

    expect(calls).toEqual(["drop /shared", `detach ${PROJECT_ROOT} 0 0`]);
  });
});
