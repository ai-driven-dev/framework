import { describe, expect, it, vi } from "vitest";
import { createDeps } from "../../src/composition/container.js";
import { wireInstallation } from "../../src/composition/installation.js";
import { wireGlobal } from "../../src/composition/orchestration/global.js";
import { wireMarketplace } from "../../src/composition/orchestration/marketplace.js";
import { wirePlugin } from "../../src/composition/orchestration/plugin.js";
import { wireSetup } from "../../src/composition/orchestration/setup.js";
import { wireBase } from "../../src/composition/shared.js";
import { registeredTools, TOOL } from "../shared/testing/registered-tools.js";
import { ScriptedPrompter } from "../shared/testing/scripted-prompter.js";

/** Building the graph reads nothing: the root names a project that is never opened. */
const ROOT = "/aidd-catalog-wiring-unopened";

describe("the catalog the deps wire", () => {
  it("is the one createDeps was handed, for the use case that builds a framework", async () => {
    const catalogA = registeredTools();
    const catalogB = registeredTools();
    const askedA = vi.spyOn(catalogA, "aiToolId");
    const askedB = vi.spyOn(catalogB, "aiToolId");
    const depsA = await createDeps(ROOT, { verbose: false }, undefined, catalogA);
    await createDeps(ROOT, { verbose: false }, undefined, catalogB);
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
      const base = { ...wireBase(ROOT, { verbose: false }, undefined, catalog), prompter };
      const inst = wireInstallation(base);
      const marketplace = wireMarketplace(base, inst);
      const plugin = wirePlugin(base, inst);
      return wireSetup(
        base,
        inst,
        plugin,
        marketplace,
        wireGlobal(base, inst, marketplace, plugin)
      );
    };
    const setupA = wire(catalogA);
    wire(catalogB);
    listedA.mockClear();
    listedB.mockClear();

    await setupA.setupToolsPromptUseCase.execute({ interactive: true, aiTools: [], ideTools: [] });

    expect(listedA).toHaveBeenCalled();
    expect(listedB).not.toHaveBeenCalled();
  });
});
