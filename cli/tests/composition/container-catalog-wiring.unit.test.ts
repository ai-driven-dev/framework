import { describe, expect, it, vi } from "vitest";
import { wireInstallation } from "../../src/composition/installation.js";
import { bindContainer } from "../../src/composition/orchestration/deps-graph.js";
import { wireGlobal } from "../../src/composition/orchestration/global.js";
import { wireMarketplace } from "../../src/composition/orchestration/marketplace.js";
import { wirePlugin } from "../../src/composition/orchestration/plugin.js";
import { wireSetup } from "../../src/composition/orchestration/setup.js";
import { wireBase } from "../../src/composition/shared.js";
import { registeredTools, TOOL } from "../shared/testing/registered-tools.builder.js";
import { ScriptedPrompter } from "../shared/testing/scripted-prompter.fake.js";

/** Building the graph reads nothing: the root names a project that is never opened. */
const ROOT = "/aidd-catalog-wiring-unopened";

describe("the catalog the deps wire", () => {
  it("is the one the container was handed, for the use case that builds a framework", async () => {
    const catalogA = registeredTools();
    const catalogB = registeredTools();
    const askedA = vi.spyOn(catalogA, "aiToolId");
    const askedB = vi.spyOn(catalogB, "aiToolId");
    const depsA = await bindContainer(catalogA)(ROOT, { verbose: false }, undefined);
    await bindContainer(catalogB)(ROOT, { verbose: false }, undefined);
    askedA.mockClear();
    askedB.mockClear();

    depsA.frameworkBuild({ target: TOOL.claude, mode: "marketplace", outDir: ROOT, force: false });

    expect(askedA).toHaveBeenCalledWith(TOOL.claude);
    expect(askedB).not.toHaveBeenCalled();
  });

  it("is the one the setup wiring was handed, for the tools question a setup asks", async () => {
    const catalogA = registeredTools();
    const catalogB = registeredTools();
    const listedA = vi.spyOn(catalogA, "idsInCanonicalOrder");
    const listedB = vi.spyOn(catalogB, "idsInCanonicalOrder");
    const prompter = new ScriptedPrompter([]);
    vi.spyOn(prompter, "checkbox").mockResolvedValue([]);
    const wire = (catalog: typeof catalogA) => {
      const base = { ...wireBase({ projectRoot: ROOT, verbose: false, tools: catalog }), prompter };
      const inst = wireInstallation(base);
      const marketplace = wireMarketplace(base, inst);
      const plugin = wirePlugin(base, inst);
      return wireSetup({
        base,
        installation: inst,
        plugin,
        marketplace,
        global: wireGlobal({ base, installation: inst, marketplace, plugin }),
      });
    };
    const setupA = wire(catalogA);
    wire(catalogB);
    listedA.mockClear();
    listedB.mockClear();

    await setupA.chooseTools.execute({ interactive: true, aiTools: [], ideTools: [] });

    expect(listedA).toHaveBeenCalled();
    expect(listedB).not.toHaveBeenCalled();
  });
});
