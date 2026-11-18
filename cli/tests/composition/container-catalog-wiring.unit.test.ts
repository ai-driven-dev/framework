import { describe, expect, it, vi } from "vitest";
import { createDeps } from "../../src/composition/container.js";
import { registeredTools, TOOL } from "../shared/testing/registered-tools.js";

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
});
