import { describe, expect, it } from "vitest";
import { InspectHostMarketplaceSources } from "../../../../../src/contexts/host-registration/application/inspect/inspect-host-marketplace-sources.use-case.js";
import type { InspectedHost } from "../../../../../src/contexts/host-registration/contract/inspect-host-registration-request.js";
import { catalogIdentityReader } from "../../../../../src/contexts/host-registration/infrastructure/marketplace/marketplace-registry-reader.js";
import type { HostMarketplaceRegistry } from "../../../../../src/contexts/host-registration/ports/host-marketplace-registry.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeHostMarketplaceRegistry } from "../../testing/fake-host-marketplace-registry.fake.js";

const MARKETPLACE_LOCATION = "/home/.claude/plugins/known_marketplaces.json";
const NAME = "aidd-framework";
const CACHE_ROOT = "/home/.config/aidd";

function inspector(
  parts: {
    fs?: InMemoryFileAdapter;
    marketplaceRegistries?: ReadonlyMap<AiToolId, HostMarketplaceRegistry>;
  } = {}
) {
  const fs = parts.fs ?? new InMemoryFileAdapter();
  return new InspectHostMarketplaceSources(
    fs,
    catalogIdentityReader(fs),
    parts.marketplaceRegistries ?? new Map(),
    "linux",
    registeredTools()
  );
}

async function inspect(subject: InspectHostMarketplaceSources, ...hosts: readonly InspectedHost[]) {
  return {
    findings: await subject.execute({ projectRoot: "/project", userCacheRoot: CACHE_ROOT, hosts }),
  };
}

describe("inspecting where a host's marketplace registry points", () => {
  function catalog(fs: InMemoryFileAdapter, dir: string, ...pluginNames: string[]) {
    fs.setFile(
      `${dir}/.claude-plugin/marketplace.json`,
      JSON.stringify({ name: NAME, plugins: pluginNames.map((name) => ({ name })) })
    );
  }

  function inspectingSources(fs: InMemoryFileAdapter, registered: string) {
    return inspect(
      inspector({
        fs,
        marketplaceRegistries: new Map([
          [
            TOOL.claude,
            new FakeHostMarketplaceRegistry({
              location: MARKETPLACE_LOCATION,
              entries: new Map([[NAME, registered]]),
            }),
          ],
        ]),
      }),
      { tool: TOOL.claude, expectedPlugins: [], marketplaces: [{ name: NAME, builtDir: "/built" }] }
    );
  }

  it("words the plugins a registered catalog differs from the requested one by", async () => {
    const fs = new InMemoryFileAdapter();
    catalog(fs, "/built", "aidd-dev", "aidd-vcs");
    catalog(fs, "/registered", "aidd-dev");

    const { findings } = await inspectingSources(fs, "/registered");

    expect(findings).toEqual([
      {
        kind: "source-conflict",
        tool: TOOL.claude,
        name: NAME,
        location: MARKETPLACE_LOCATION,
        registeredSource: "/registered",
        requestedSource: "/built",
        pluginDiff: expect.stringContaining("aidd-vcs"),
      },
    ]);
  });

  it("reports nothing when the registered catalog carries the requested plugins", async () => {
    const fs = new InMemoryFileAdapter();
    catalog(fs, "/built", "aidd-dev");
    catalog(fs, "/registered", "aidd-dev");

    const { findings } = await inspectingSources(fs, "/registered");

    expect(findings).toEqual([]);
  });

  it("reports nothing when the requested catalog's identity cannot be read", async () => {
    const fs = new InMemoryFileAdapter();
    catalog(fs, "/registered", "aidd-dev");

    const { findings } = await inspectingSources(fs, "/registered");

    expect(findings).toEqual([]);
  });

  it("reports nothing for a host with no marketplace registry reader", async () => {
    const fs = new InMemoryFileAdapter();
    catalog(fs, "/built", "aidd-dev", "aidd-vcs");

    const { findings } = await inspect(inspector({ fs }), {
      tool: TOOL.claude,
      expectedPlugins: [],
      marketplaces: [{ name: NAME, builtDir: "/built" }],
    });

    expect(findings).toEqual([]);
  });
});
