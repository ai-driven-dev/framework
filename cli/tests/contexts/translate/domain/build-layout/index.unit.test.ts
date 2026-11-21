import { describe, expect, it } from "vitest";
import { translateBuildLayout } from "../../../../../src/contexts/translate/domain/build-layout/index.js";
import { aCanon } from "../../testing/canon-distribution.builder.js";
import { aStubBuildContract } from "../../testing/stub-build-contract.builder.js";

const canon = aCanon("plug", { "skills/hello/SKILL.md": "# hi\n" });

describe("translateBuildLayout", () => {
  it("builds a plugin's skills for a tool that has them", () => {
    expect(
      translateBuildLayout(canon, aStubBuildContract(), "marketplace").map((f) => f.relativePath)
    ).toEqual(["plugins/plug/skills/hello/SKILL.md"]);
  });

  it("builds no skill for a tool that has none", () => {
    const contract = aStubBuildContract();
    const bare = {
      ...contract,
      artifacts: { ...contract.artifacts, skills: { supported: false as const } },
    };
    expect(translateBuildLayout(canon, bare, "marketplace")).toEqual([]);
  });
});
