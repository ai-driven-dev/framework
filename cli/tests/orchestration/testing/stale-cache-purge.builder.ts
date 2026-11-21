import { join } from "node:path";
import type {
  RegisterFrameworkMarketplace,
  RegisterFrameworkMarketplaceRequest,
} from "../../../src/contexts/distribution/application/register-framework-marketplace.use-case.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { BUILT_CACHE_SUBDIR } from "../../../src/shared/domain/layout/aidd-layout.js";
import {
  fsAt,
  type InMemoryFileAdapter,
} from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import {
  CLAUDE_BUILT_DIR,
  catalogFixture,
  PROJECT_ROOT,
} from "../testing/marketplace-sync-settings-migration.builder.js";

export const OLD_CACHE_DIR = join(PROJECT_ROOT, BUILT_CACHE_SUBDIR, FRAMEWORK_MARKETPLACE_NAME);
export const OLD_CACHE_FILE = join(OLD_CACHE_DIR, "claude", "agents", "some-agent.md");

export function projectWithMigratableEntry(): InMemoryMarketplaceRegistry {
  const registry = new InMemoryMarketplaceRegistry();
  registry.seed(
    PROJECT_ROOT,
    Marketplace.create({
      name: FRAMEWORK_MARKETPLACE_NAME,
      source: { kind: "local", path: "." },
      scope: "project",
      addedAt: "2026-01-01T00:00:00Z",
    })
  );
  return registry;
}

export function registryWithSharedFramework(): InMemoryMarketplaceRegistry {
  const registry = new InMemoryMarketplaceRegistry();
  registry.seed(
    PROJECT_ROOT,
    Marketplace.create({
      name: FRAMEWORK_MARKETPLACE_NAME,
      source: { kind: "local", path: "." },
      scope: "user",
      addedAt: "2026-01-01T00:00:00Z",
    })
  );
  return registry;
}

export function staleCacheAndCatalog(): InMemoryFileAdapter {
  return fsAt(PROJECT_ROOT, {
    [OLD_CACHE_FILE]: "stale content",
    ...catalogFixture(CLAUDE_BUILT_DIR),
  });
}

export function recordingRegister(
  calls: RegisterFrameworkMarketplaceRequest[]
): Pick<RegisterFrameworkMarketplace, "execute"> {
  return {
    execute: async (options) => {
      calls.push(options);
      return { registered: true, scope: "user" };
    },
  };
}
