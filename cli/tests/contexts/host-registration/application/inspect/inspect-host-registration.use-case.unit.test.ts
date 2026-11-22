import { describe, expect, it } from "vitest";
import { InspectHostMarketplaceSources } from "../../../../../src/contexts/host-registration/application/inspect/inspect-host-marketplace-sources.use-case.js";
import { InspectHostPlugins } from "../../../../../src/contexts/host-registration/application/inspect/inspect-host-plugins.use-case.js";
import { InspectHostRegistration } from "../../../../../src/contexts/host-registration/application/inspect/inspect-host-registration.use-case.js";
import { catalogIdentityReader } from "../../../../../src/contexts/host-registration/infrastructure/marketplace/marketplace-registry-reader.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeHostMarketplaceRegistry } from "../../testing/fake-host-marketplace-registry.fake.js";
import { FakeHostPluginRegistry } from "../../testing/fake-host-plugin-registry.fake.js";

const REF = "aidd-dev@aidd-framework";
const LOCATION = "/home/.claude/plugins/installed_plugins.json";
const MARKETPLACE_LOCATION = "/home/.claude/plugins/known_marketplaces.json";
const NAME = "aidd-framework";

describe("inspecting a host's registries together", () => {
  it("lists every plugin finding before any marketplace one", async () => {
    const fs = new InMemoryFileAdapter();
    const catalog = (dir: string, ...pluginNames: string[]) =>
      fs.setFile(
        `${dir}/.claude-plugin/marketplace.json`,
        JSON.stringify({ name: NAME, plugins: pluginNames.map((name) => ({ name })) })
      );
    catalog("/built", "aidd-dev", "aidd-vcs");
    catalog("/registered", "aidd-dev");
    const tools = registeredTools();
    const subject = new InspectHostRegistration(
      new InspectHostPlugins(
        new Map([
          [TOOL.claude, new FakeHostPluginRegistry({ location: LOCATION, refs: new Map() })],
        ]),
        tools
      ),
      new InspectHostMarketplaceSources(
        fs,
        catalogIdentityReader(fs),
        new Map([
          [
            TOOL.claude,
            new FakeHostMarketplaceRegistry({
              location: MARKETPLACE_LOCATION,
              entries: new Map([[NAME, "/registered"]]),
            }),
          ],
        ]),
        "linux",
        tools
      )
    );

    const { findings } = await subject.execute({
      projectRoot: "/project",
      userCacheRoot: "/home/.config/aidd",
      hosts: [
        {
          tool: TOOL.claude,
          expectedPlugins: [{ plugin: "aidd-dev", ref: REF }],
          marketplaces: [{ name: NAME, builtDir: "/built" }],
        },
      ],
    });

    expect(findings.map((finding) => finding.kind)).toEqual(["plugin-missing", "source-conflict"]);
  });
});
