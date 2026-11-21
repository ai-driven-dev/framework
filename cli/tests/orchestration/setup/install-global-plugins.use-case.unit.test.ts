import { describe, expect, it, vi } from "vitest";
import type { PluginSourceMatch } from "../../../src/contexts/distribution/contract/plugin-source-match.js";
import {
  InstallGlobalPlugins,
  type InstallGlobalPluginsRequest,
} from "../../../src/orchestration/setup/install-global-plugins.use-case.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

function match(name: string, recommended: boolean): PluginSourceMatch {
  return {
    marketplaceName: "aidd-framework",
    githubMarketplace: true,
    entry: {
      name,
      source: { kind: "local", path: `./plugins/${name}` },
      recommended,
      strict: true,
    },
    source: { kind: "local", path: `/fw/plugins/${name}` },
  };
}

const DEV = match("aidd-dev", true);
const PM = match("aidd-pm", false);

function setup() {
  const list = vi.fn(async () => [DEV, PM]);
  const install = vi.fn(async () => {});
  return {
    list,
    install,
    useCase: new InstallGlobalPlugins({ execute: list }, { execute: install }),
  };
}

function run(
  useCase: InstallGlobalPlugins,
  mode: InstallGlobalPluginsRequest["mode"],
  pluginNames: string[] = []
) {
  return useCase.execute({
    projectRoot: "/project",
    toolIds: [TOOL.opencode],
    mode,
    pluginNames,
  });
}

describe("InstallGlobalPlugins", () => {
  it("hands every plugin of the catalogue to the installer for --plugins all, and names them", async () => {
    const { useCase, install } = setup();

    const result = await run(useCase, "all");

    expect(result.plugins).toEqual(["aidd-dev", "aidd-pm"]);
    expect(install).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: [DEV, PM],
        projectRoot: "/project",
        toolIds: [TOOL.opencode],
      })
    );
  });

  it("keeps the recommended plugins alone", async () => {
    const { useCase, install } = setup();

    expect((await run(useCase, "recommended")).plugins).toEqual(["aidd-dev"]);
    expect(install).toHaveBeenCalledWith(expect.objectContaining({ plugins: [DEV] }));
  });

  it("keeps the named plugins alone", async () => {
    const { useCase } = setup();

    expect((await run(useCase, "named", ["aidd-pm"])).plugins).toEqual(["aidd-pm"]);
  });

  it("refuses a named plugin the catalog does not carry, before installing anything", async () => {
    const { useCase, install } = setup();

    await expect(run(useCase, "named", ["aidd-nope"])).rejects.toThrow(
      "Not in the framework catalog: aidd-nope."
    );
    expect(install).not.toHaveBeenCalled();
  });

  it.each(["none", "interactive"] as const)(
    "installs nothing, and reads no catalogue, in %s mode",
    async (mode) => {
      const { useCase, list, install } = setup();

      expect((await run(useCase, mode)).plugins).toEqual([]);
      expect(list).not.toHaveBeenCalled();
      expect(install).not.toHaveBeenCalled();
    }
  );

  it("reads the catalogue of the project it installs for", async () => {
    const { useCase, list } = setup();

    await run(useCase, "all");

    expect(list).toHaveBeenCalledWith({ projectRoot: "/project" });
  });

  it("names every plugin the catalog does not carry", async () => {
    const { useCase } = setup();

    await expect(run(useCase, "named", ["aidd-nope", "aidd-gone"])).rejects.toThrow(
      "Not in the framework catalog: aidd-nope, aidd-gone."
    );
  });
});
