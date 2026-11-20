import { describe, expect, it } from "vitest";
import {
  type InspectedHost,
  InspectHostRegistration,
} from "../../../../../src/contexts/host-registration/application/inspect/inspect-host-registration.js";
import type { HostPluginRegistryReading } from "../../../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeHostMarketplaceRegistry } from "../../testing/fake-host-marketplace-registry.fake.js";
import { FakeHostPluginRegistry } from "../../testing/fake-host-plugin-registry.fake.js";

const REF = "aidd-dev@aidd-framework";
const LOCATION = "/home/.claude/plugins/installed_plugins.json";
const MARKETPLACE_LOCATION = "/home/.claude/plugins/known_marketplaces.json";
const NAME = "aidd-framework";
const CACHE_ROOT = "/home/.config/aidd";

function plugins(tool: AiToolId, reading: HostPluginRegistryReading) {
  return new Map([[tool, new FakeHostPluginRegistry(reading)]]);
}

function inspector(
  parts: {
    fs?: InMemoryFileAdapter;
    pluginRegistries?: ConstructorParameters<typeof InspectHostRegistration>[1];
    marketplaceRegistries?: ConstructorParameters<typeof InspectHostRegistration>[2];
  } = {}
) {
  return new InspectHostRegistration(
    parts.fs ?? new InMemoryFileAdapter(),
    parts.pluginRegistries ?? new Map(),
    parts.marketplaceRegistries ?? new Map(),
    "linux",
    registeredTools()
  );
}

function inspect(subject: InspectHostRegistration, ...hosts: readonly InspectedHost[]) {
  return subject.execute({ projectRoot: "/project", userCacheRoot: CACHE_ROOT, hosts });
}

const claudeExpecting = (...expectedPlugins: InspectedHost["expectedPlugins"][number][]) => ({
  tool: TOOL.claude,
  expectedPlugins,
  marketplaces: [],
});

describe("inspecting the plugins a host's registry carries", () => {
  it("names a plugin the registry does not carry", async () => {
    const subject = inspector({
      pluginRegistries: plugins(TOOL.claude, { location: LOCATION, refs: new Map() }),
    });

    const { findings } = await inspect(subject, claudeExpecting({ plugin: "aidd-dev", ref: REF }));

    expect(findings).toEqual([
      { kind: "plugin-missing", tool: TOOL.claude, ref: REF, location: LOCATION },
    ]);
  });

  it("names a plugin the registry carries disabled, and none it carries enabled", async () => {
    const subject = inspector({
      pluginRegistries: plugins(TOOL.claude, {
        location: LOCATION,
        refs: new Map([
          [REF, { enabled: false }],
          ["aidd-vcs@aidd-framework", { enabled: true }],
        ]),
      }),
    });

    const { findings } = await inspect(
      subject,
      claudeExpecting(
        { plugin: "aidd-dev", ref: REF },
        { plugin: "aidd-vcs", ref: "aidd-vcs@aidd-framework" }
      )
    );

    expect(findings).toEqual([
      { kind: "plugin-disabled", tool: TOOL.claude, ref: REF, location: LOCATION },
    ]);
  });

  it("names a plugin no ref could be built for, without looking it up", async () => {
    const subject = inspector({
      pluginRegistries: plugins(TOOL.claude, { location: LOCATION, refs: new Map() }),
    });

    const { findings } = await inspect(subject, claudeExpecting({ plugin: "hand-copied" }));

    expect(findings).toEqual([
      { kind: "plugin-unrecorded", tool: TOOL.claude, plugin: "hand-copied" },
    ]);
  });

  it("says why nothing is known when the registry cannot be read", async () => {
    const subject = inspector({
      pluginRegistries: plugins(TOOL.claude, { location: LOCATION, unreadable: "EACCES" }),
    });

    const { findings } = await inspect(subject, claudeExpecting({ plugin: "aidd-dev", ref: REF }));

    expect(findings).toEqual([
      {
        kind: "registry-unanswerable",
        tool: TOOL.claude,
        detail: `${LOCATION} could not be read — EACCES`,
      },
    ]);
  });

  it("says a host keeps a registry nothing here reads when no reader answers for it", async () => {
    const { findings } = await inspect(
      inspector(),
      claudeExpecting({ plugin: "aidd-dev", ref: REF })
    );

    expect(findings).toEqual([
      {
        kind: "registry-unanswerable",
        tool: TOOL.claude,
        detail: "claude keeps a plugin registry, and nothing here has established its shape",
      },
    ]);
  });

  it("asks nothing of a host that expects no plugin", async () => {
    const subject = inspector({
      pluginRegistries: plugins(TOOL.claude, { location: LOCATION, unreadable: "EACCES" }),
    });

    const { findings } = await inspect(subject, claudeExpecting());

    expect(findings).toEqual([]);
  });

  it("asks nothing of a host that activates no plugin through its own CLI", async () => {
    const subject = inspector({
      pluginRegistries: plugins(TOOL.cursor, { location: LOCATION, refs: new Map() }),
    });

    const { findings } = await inspect(subject, {
      tool: TOOL.cursor,
      expectedPlugins: [{ plugin: "aidd-dev", ref: REF }],
      marketplaces: [],
    });

    expect(findings).toEqual([]);
  });
});

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

  it("lists every plugin finding before any marketplace one", async () => {
    const fs = new InMemoryFileAdapter();
    catalog(fs, "/built", "aidd-dev", "aidd-vcs");
    catalog(fs, "/registered", "aidd-dev");
    const subject = inspector({
      fs,
      pluginRegistries: plugins(TOOL.claude, { location: LOCATION, refs: new Map() }),
      marketplaceRegistries: new Map([
        [
          TOOL.claude,
          new FakeHostMarketplaceRegistry({
            location: MARKETPLACE_LOCATION,
            entries: new Map([[NAME, "/registered"]]),
          }),
        ],
      ]),
    });

    const { findings } = await inspect(subject, {
      tool: TOOL.claude,
      expectedPlugins: [{ plugin: "aidd-dev", ref: REF }],
      marketplaces: [{ name: NAME, builtDir: "/built" }],
    });

    expect(findings.map((finding) => finding.kind)).toEqual(["plugin-missing", "source-conflict"]);
  });
});
