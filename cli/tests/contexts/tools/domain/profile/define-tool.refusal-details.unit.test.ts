import { describe, expect, it } from "vitest";
import { defineAiTool } from "../../../../../src/contexts/tools/domain/profile/define-tool.js";
import { aiSpec, refusalOf, settings } from "../../testing/define-tool-spec.builder.js";

describe("what a refused profile carries", () => {
  const sayOf = (build: () => unknown) => {
    const { toolId, invariant, detail } = refusalOf(build);
    return { toolId, invariant, detail };
  };
  const shipped = (name: string, destination: string, delivery: "install" | "section") => ({
    name,
    content: {},
    destination,
    delivery,
  });

  it("names the tool and the directory it refuses", () => {
    expect(sayOf(() => defineAiTool({ ...aiSpec, directory: "/abs/" }))).toEqual({
      toolId: "claude",
      invariant: "directory-not-relative",
      detail: "'/abs/' must be relative to the project root.",
    });
    expect(sayOf(() => defineAiTool({ ...aiSpec, directory: ".x" }))).toEqual({
      toolId: "claude",
      invariant: "directory-without-trailing-slash",
      detail: "'.x' must end with '/'.",
    });
  });

  it("names the section no tool can declare", () => {
    expect(
      sayOf(() =>
        defineAiTool({ ...aiSpec, capabilities: () => ({ config: [settings], bogus: 1 }) })
      )
    ).toEqual({ toolId: "claude", invariant: "unknown-section", detail: "'bogus' is no section." });
  });

  it("says an AI tool needs a marketplace or a flat build contract", () => {
    expect(sayOf(() => defineAiTool({ ...aiSpec, buildContracts: {} }))).toEqual({
      toolId: "claude",
      invariant: "no-build-contract",
      detail: "an AI tool declares a marketplace or a flat build contract.",
    });
  });

  it("names the shipped file declared twice, and the one no section writes", () => {
    expect(
      sayOf(() =>
        defineAiTool({
          ...aiSpec,
          configAssets: [
            shipped("a.json", ".x/a", "install"),
            shipped("a.json", ".x/b", "install"),
          ],
        })
      )
    ).toEqual({
      toolId: "claude",
      invariant: "shipped-config-disagrees",
      detail: "'a.json' is shipped twice.",
    });
    expect(
      sayOf(() =>
        defineAiTool({ ...aiSpec, configAssets: [shipped("a.json", ".x/a.json", "section")] })
      )
    ).toEqual({
      toolId: "claude",
      invariant: "shipped-config-disagrees",
      detail: "'a.json' lands at .x/a.json, which no settings section writes.",
    });
  });
});
