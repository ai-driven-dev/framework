import { describe, expect, it } from "vitest";
import {
  agentFrontmatterOf,
  modelWithEffort,
} from "../../../../../../src/contexts/tools/domain/formats/agents/agent-format.js";

describe("joining a model and an effort", () => {
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

describe("an agent frontmatter declared as data", () => {
  const source = { name: "n", description: "d", model: "m", effort: "high", tools: "x" };

  it("keeps only the declared keys, in their declared order", () => {
    const write = agentFrontmatterOf({ keep: ["model", "name"] });
    expect(Object.entries(write(source))).toStrictEqual([
      ["model", "m"],
      ["name", "n"],
    ]);
  });

  it("reads a renamed key from its source key", () => {
    const write = agentFrontmatterOf({ keep: ["variant"], rename: { variant: "effort" } });
    expect(write(source)).toStrictEqual({ variant: "high" });
  });

  it("writes a default for a key the source leaves out, and keeps the one it carries", () => {
    const write = agentFrontmatterOf({ keep: ["shared"], defaults: { shared: true } });
    expect([write(source), write({ shared: false })]).toStrictEqual([
      { shared: true },
      { shared: false },
    ]);
  });

  it("folds the effort into the model id between the declared delimiters", () => {
    const write = agentFrontmatterOf({ keep: ["model"], effortInModel: { open: "#" } });
    expect(write(source)).toStrictEqual({ model: "m#high" });
  });

  it("appends every fixed value after the kept keys", () => {
    const write = agentFrontmatterOf({ keep: ["name"], set: { mode: "subagent" } });
    expect(Object.entries(write(source))).toStrictEqual([
      ["name", "n"],
      ["mode", "subagent"],
    ]);
  });
});
