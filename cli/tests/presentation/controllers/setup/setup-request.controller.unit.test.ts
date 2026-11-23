import { describe, expect, it } from "vitest";
import {
  buildSetupFlow,
  parseSetupRequest,
} from "../../../../src/presentation/controllers/setup/setup-request.controller.js";
import { CapturingOutput } from "../../../shared/testing/capturing-output.fake.js";
import {
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticMixedCatalog,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

const CATALOG = syntheticMixedCatalog();

describe("setup request", () => {
  it("reads the machine scope from --global and runs without a prompt when a flag is given", () => {
    const request = parseSetupRequest({ global: true }, new CapturingOutput(), CATALOG);

    expect(request.scope).toBe("user");
    expect(request.interactive).toBeFalsy();
    expect(request.plugins).toEqual({ mode: "none", names: [] });
  });

  it("names the tools and plugins the flags select", () => {
    const request = parseSetupRequest(
      { ai: SYNTHETIC_TOOL, ide: SYNTHETIC_IDE_TOOL, plugins: "alpha,beta" },
      new CapturingOutput(),
      CATALOG
    );

    expect(request.toolIds).toEqual({ aiTools: [SYNTHETIC_TOOL], ideTools: [SYNTHETIC_IDE_TOOL] });
    expect(request.plugins).toEqual({ mode: "named", names: ["alpha", "beta"] });
  });

  it("builds the flow of the project with the request's tools, plugins and scope", () => {
    const request = parseSetupRequest(
      { ai: SYNTHETIC_TOOL, scope: "project" },
      new CapturingOutput(),
      CATALOG
    );

    const flow = buildSetupFlow(
      { projectRoot: "/project", catalog: CATALOG, cmdOptions: { defaultMarketplace: false } },
      request
    );

    expect(flow).toMatchObject({
      projectRoot: "/project",
      aiTools: [SYNTHETIC_TOOL],
      scope: "project",
      registerDefaultMarketplace: false,
      force: false,
    });
  });
});
