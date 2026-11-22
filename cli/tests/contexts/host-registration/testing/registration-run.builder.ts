import type { RegistrationRun } from "../../../../src/contexts/host-registration/application/register/registration-run.js";
import type { ClaimsView } from "../../../../src/contexts/host-registration/contract/claims-view.js";
import type { HostMarketplaceRegistryReading } from "../../../../src/contexts/host-registration/domain/reading/marketplace-registry-reading.js";
import type { HostPluginRegistryReading } from "../../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { NativeMarketplaceSource } from "../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
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

export function setup(
  options: {
    sources?: Map<string, NativeMarketplaceSource | null>;
    registry?: HostMarketplaceRegistryReading;
    plugins?: HostPluginRegistryReading;
    claims?: Partial<ClaimsView>;
    files?: Record<string, string>;
    userCacheRoot?: string;
  } = {}
) {
  const activator = new FakeHostActions({ available: true });
  const logger = new CapturingLogger();
  const warnings: string[] = [];
  const hosts = {
    marketplaceRegistries: new Map([
      [
        TOOL.claude,
        new FakeHostMarketplaceRegistry(options.registry ?? { location: "r", entries: new Map() }),
      ],
    ]),
    pluginRegistries: new Map([
      [
        TOOL.claude,
        new FakeHostPluginRegistry(options.plugins ?? { location: "p", refs: new Map() }),
      ],
    ]),
    sources: new Map([
      [
        TOOL.claude,
        new FakeHostMarketplaceSources(
          activator,
          "registry",
          () => "aidd",
          options.sources ?? new Map()
        ),
      ],
    ]),
  };
  const profile = registeredTools().aiProfileIfAny(TOOL.claude);
  if (profile === null) throw new Error("claude is an AI tool");
  const fs = new InMemoryFileAdapter(options.files ?? {});
  const run: RegistrationRun = {
    toolId: TOOL.claude,
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
