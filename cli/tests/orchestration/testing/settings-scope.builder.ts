import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import type { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { FakeHostMarketplaceSources } from "./fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "./fake-host-plugin-registry.fake.js";

export const PROJECT_ROOT = "/test-project";
export const MARKETPLACE = "aidd-framework";

export function marketplace(): Marketplace {
  return Marketplace.create({
    name: MARKETPLACE,
    source: { kind: "github", repo: "ai-driven-dev/framework" },
    scope: "user",
    addedAt: "2026-09-02T00:00:00Z",
  });
}

export function manifestWithTool(tool: AiToolId): InMemoryManifestRepository {
  const manifest = Manifest.create();
  manifest.addTool(tool, "test", []);
  return new InMemoryManifestRepository(manifest);
}

/** The built catalogue `fakeEnsureBuiltMarketplace()` resolves for `toolId`, the registered claude by default, left where a real build leaves it. */
export function seededBuiltCatalog(toolId?: AiToolId): InMemoryFileAdapter {
  return new InMemoryFileAdapter(
    {
      [`/built/${toolId ?? "claude"}/.claude-plugin/marketplace.json`]: JSON.stringify({
        name: MARKETPLACE,
        version: "1.0.0",
        plugins: [],
      }),
    },
    [PROJECT_ROOT]
  );
}

export function seededBuiltCatalogOf(tool: AiToolId): InMemoryFileAdapter {
  return new InMemoryFileAdapter(
    {
      [`/built/${tool}/.plugin/marketplace.json`]: JSON.stringify({
        name: MARKETPLACE,
        version: "1.0.0",
        plugins: [],
      }),
    },
    [PROJECT_ROOT]
  );
}

export function freshHostProof(tool: AiToolId, activator: FakeHostActions) {
  return {
    plugins: new Map([
      [
        tool,
        new FakeHostPluginRegistry({
          location: "/host/installed_plugins.json",
          refs: new Map(),
        }),
      ],
    ]),
    sources: new Map([
      [
        tool,
        new FakeHostMarketplaceSources(
          activator,
          "registry",
          (path) => (path === `/built/${tool}` ? MARKETPLACE : undefined),
          new Map()
        ),
      ],
    ]),
  };
}
