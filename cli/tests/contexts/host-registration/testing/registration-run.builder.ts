import type { RegistrationRun } from "../../../../src/contexts/host-registration/application/register/registration-run.js";
import type { ClaimsView } from "../../../../src/contexts/host-registration/contract/claims-view.js";
import type { HostMarketplaceRegistryReading } from "../../../../src/contexts/host-registration/domain/reading/marketplace-registry-reading.js";
import type { HostPluginRegistryReading } from "../../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { NativeMarketplaceSource } from "../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import { userBuiltMarketplaceDir } from "../../../../src/shared/domain/layout/aidd-layout.js";
import type { AiToolId } from "../../../../src/shared/domain/tool.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { catalogReadersOver } from "../../../shared/testing/catalog-readers.builder.js";
import { FakeHostActions } from "../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { FakeHostMarketplaceRegistry } from "./fake-host-marketplace-registry.fake.js";
import { FakeHostMarketplaceSources } from "./fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "./fake-host-plugin-registry.fake.js";

export const DIR = "/built/aidd";
export const OWN: NativeMarketplaceSource = { kind: "registry", source: DIR };
export const NONE: ClaimsView = {
  recorded: undefined,
  machine: async () => undefined,
  machineKept: false,
  persistedProject: async () => undefined,
};
export const catalogAt = (dir: string, plugins: string[]) => ({
  [`${dir}/.claude-plugin/marketplace.json`]: JSON.stringify({
    name: "aidd",
    plugins: plugins.map((name) => ({ name })),
  }),
});
export const enabled = (...refs: string[]) => ({
  location: "p",
  refs: new Map(refs.map((ref) => [ref, { enabled: true }])),
});

/** Codex's shared build of `aidd` per CLI version, its listed source and its catalog seed. */
export const USER_CACHE_ROOT = "/home/.config/aidd";
export const codexBuild = (cliVersion: string): string =>
  userBuiltMarketplaceDir({
    userConfigDir: USER_CACHE_ROOT,
    cliVersion,
    marketplaceName: "aidd",
    target: TOOL.codex,
  });
export const listedAt = (dir: string): NativeMarketplaceSource => ({
  kind: "effective-list",
  root: dir,
  sourceType: "local",
  source: dir,
});
export const codexCatalogAt = (dir: string) => ({
  [`${dir}/.agents/plugins/marketplace.json`]: JSON.stringify({ name: "aidd", plugins: [] }),
});

export function setup(
  options: {
    sources?: Map<string, NativeMarketplaceSource | null>;
    registry?: HostMarketplaceRegistryReading;
    plugins?: HostPluginRegistryReading;
    claims?: Partial<ClaimsView>;
    files?: Record<string, string>;
    userCacheRoot?: string;
    tool?: AiToolId;
    activator?: FakeHostActions;
  } = {}
) {
  const tool = options.tool ?? TOOL.claude;
  const activator = options.activator ?? new FakeHostActions({ available: true });
  const logger = new CapturingLogger();
  const warnings: string[] = [];
  const hosts = {
    marketplaceRegistry: new FakeHostMarketplaceRegistry(
      options.registry ?? { location: "r", entries: new Map() }
    ),
    pluginRegistry: new FakeHostPluginRegistry(
      options.plugins ?? { location: "p", refs: new Map() }
    ),
    sources: new FakeHostMarketplaceSources(
      activator,
      tool === TOOL.claude ? "registry" : "effective-list",
      () => "aidd",
      options.sources ?? new Map()
    ),
  };
  const profile = registeredTools().aiProfileIfAny(tool);
  if (profile === null) throw new Error(`${tool} is an AI tool`);
  const fs = new InMemoryFileAdapter(options.files ?? {});
  const run: RegistrationRun = {
    toolId: tool,
    profile,
    activator,
    fs,
    catalogs: catalogReadersOver(fs),
    hosts,
    projectRoot: "/p",
    claims: { ...NONE, ...options.claims },
    userCacheRoot: () => options.userCacheRoot ?? "",
    platform: "linux",
    logger,
    warnings,
  };
  return { run, logger, warnings, activator };
}
