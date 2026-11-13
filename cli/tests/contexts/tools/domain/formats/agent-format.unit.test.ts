import { describe, expect, it } from "vitest";
import { modelWithEffort } from "../../../../../src/contexts/tools/domain/formats/agent-format.js";

describe("modelWithEffort()", () => {
  it("joins the model and the effort between the given delimiters", () => {
    expect(modelWithEffort({ model: "m", effort: "high" }, "[effort=", "]")).toBe("m[effort=high]");
    expect(modelWithEffort({ model: "m", effort: "high" }, "#")).toBe("m#high");
  });

  it("keeps the model alone when there is no effort", () => {
    expect(modelWithEffort({ model: "m" }, "#")).toBe("m");
  });

  it("answers nothing when there is an effort and no model", () => {
    expect(modelWithEffort({ effort: "high" }, "-")).toBeUndefined();
  });

  it("keeps a model that is not a string as it is", () => {
    expect(modelWithEffort({ model: 3, effort: "high" }, "-")).toBe(3);
  });
});
