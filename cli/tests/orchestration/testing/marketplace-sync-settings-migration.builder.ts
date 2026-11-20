import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { UserSourceReferences } from "../../../src/contexts/machine-claims/ports/user-source-references.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import type { VersionReader } from "../../../src/shared/ports/version-reader.js";
import type { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { FakeHostMarketplaceSources } from "./fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "./fake-host-plugin-registry.fake.js";

export const PROJECT_ROOT = "/project";
export const CLAUDE_BUILT_DIR = "/shared/built/claude";
export const CODEX_BUILT_DIR = "/shared/built/codex";
export const CATALOG_RELATIVE = ".claude-plugin/marketplace.json";

export function canonicallyOwned(toolId: AiToolId): Manifest {
  const machine = Manifest.create();
  machine.addTool(toolId, "test", []);
  machine.setNativeRegistrations(toolId, {
    binary: toolId,
    marketplaces: [{ alias: FRAMEWORK_MARKETPLACE_NAME, hostName: FRAMEWORK_MARKETPLACE_NAME }],
    pluginRefs: [],
    pluginClaims: [],
  });
  return machine;
}

export function readableHostPlugins(toolId: AiToolId) {
  return new Map([
    [
      toolId,
      new FakeHostPluginRegistry({
        location: `/home/${toolId}/plugins`,
        refs: new Map(),
      }),
    ],
  ]);
}

export function freshClaudeSource(
  activator: FakeHostActions,
  builtDir: string,
  name = FRAMEWORK_MARKETPLACE_NAME
) {
  return new Map([
    [
      TOOL.claude,
      new FakeHostMarketplaceSources(
        activator,
        "registry",
        (path) => (path === builtDir ? name : undefined),
        new Map()
      ),
    ],
  ]);
}

export function fakeVersion(value: string): VersionReader {
  return { get: () => value };
}

export function catalogFixture(builtDir: string): Record<string, string> {
  return {
    [`${builtDir}/${CATALOG_RELATIVE}`]: JSON.stringify({
      name: FRAMEWORK_MARKETPLACE_NAME,
      version: "1.0.0",
      plugins: [],
    }),
  };
}

export function manifestWithClaude(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "test", []);
  return manifest;
}

export function projectScopeEntry(source: Marketplace["source"]): Marketplace {
  return Marketplace.create({
    name: FRAMEWORK_MARKETPLACE_NAME,
    source,
    scope: "project",
    addedAt: "2026-01-01T00:00:00Z",
  });
}

export function noSourceReferences(
  added: Array<{ version: string; projectRoot: string }>
): UserSourceReferences {
  return {
    addReference: async (version, projectRoot) => {
      added.push({ version, projectRoot });
    },
    removeReference: async () => undefined,
    listAllReferencingProjects: async () => [],
  };
}
