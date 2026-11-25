import { describe, expect, it } from "vitest";
import { InspectHostPlugins } from "../../../../../src/contexts/host-registration/application/inspect/inspect-host-plugins.use-case.js";
import type { InspectedHost } from "../../../../../src/contexts/host-registration/contract/inspect-host-registration-request.js";
import type { HostPluginRegistryReading } from "../../../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { HostPluginRegistry } from "../../../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeHostPluginRegistry } from "../../testing/fake-host-plugin-registry.fake.js";

const REF = "aidd-dev@aidd-framework";
const LOCATION = "/home/.claude/plugins/installed_plugins.json";
const CACHE_ROOT = "/home/.config/aidd";

function plugins(tool: AiToolId, reading: HostPluginRegistryReading) {
  return new Map([[tool, new FakeHostPluginRegistry(reading)]]);
}

function inspector(parts: { pluginRegistries?: ReadonlyMap<AiToolId, HostPluginRegistry> } = {}) {
  return new InspectHostPlugins(parts.pluginRegistries ?? new Map(), registeredTools());
}

async function inspect(subject: InspectHostPlugins, ...hosts: readonly InspectedHost[]) {
  return {
    findings: await subject.execute({ projectRoot: "/project", userCacheRoot: CACHE_ROOT, hosts }),
  };
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
