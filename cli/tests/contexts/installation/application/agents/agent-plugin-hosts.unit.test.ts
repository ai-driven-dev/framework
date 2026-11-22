import { describe, expect, it } from "vitest";
import { AgentPluginHosts } from "../../../../../src/contexts/installation/application/agents/agent-plugin-hosts.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

const source = { kind: "local", path: "/p" } as const;
const plugin = (scope: Scope) =>
  RecordedPlugin.fromMetadata({ name: "a", version: "1.0.0", source, strict: false, scope });
const HOSTS = [TOOL.claude, TOOL.cursor, TOOL.codex];

describe("AgentPluginHosts", () => {
  it("places nothing when neither manifest exists", async () => {
    const hosts = new AgentPluginHosts(
      new InMemoryManifestRepository(),
      new InMemoryManifestRepository()
    );

    await expect(hosts.locate(HOSTS)).resolves.toEqual({
      userPlugins: [],
      projectPlugins: [],
      installed: [],
      machine: [],
    });
  });

  it("tells project installs, project plugins, machine installs and user plugins apart", async () => {
    const project = aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(TOOL.claude, plugin("project"))
      .withTool(TOOL.cursor, [])
      .withPlugin(TOOL.cursor, plugin("user"))
      .build();
    const machine = aManifest()
      .withTool(TOOL.codex, [])
      .withPlugin(TOOL.codex, plugin("user"))
      .withTool(TOOL.cursor, [])
      .build();
    const hosts = new AgentPluginHosts(
      new InMemoryManifestRepository(project),
      new InMemoryManifestRepository(machine)
    );

    await expect(hosts.locate(HOSTS)).resolves.toEqual({
      userPlugins: [TOOL.codex],
      projectPlugins: [TOOL.claude],
      installed: [TOOL.claude, TOOL.cursor],
      machine: [TOOL.cursor, TOOL.codex],
    });
  });
});
