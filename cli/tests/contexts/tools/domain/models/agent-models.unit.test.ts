import { describe, expect, it } from "vitest";
import { AGENT_MODELS } from "../../../../../src/contexts/tools/domain/models/agent-models.js";
import { catalogOf } from "../../../../shared/testing/catalog-of.builder.js";

describe("the model table", () => {
  it("orders the tiers from the most capable down, the order a report lists roles in", () => {
    expect(Object.keys(AGENT_MODELS.tiers)).toStrictEqual(["smart", "standard", "light"]);
  });

  it("offers each tool only providers it defines", () => {
    const catalog = catalogOf();
    for (const id of catalog.idsInCanonicalOrder("ai")) {
      for (const provider of catalog.aiProfile(id).agentModels()?.providers() ?? [])
        expect(AGENT_MODELS.providers).toHaveProperty(provider);
    }
  });
});
