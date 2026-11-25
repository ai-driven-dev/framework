import { describe, expect, it } from "vitest";
import {
  agentFiles,
  baseOf,
  isEntry,
} from "../../../../../src/contexts/translate/domain/layouts/build-shared.js";
import { aCanon } from "../../testing/canon-distribution.builder.js";

describe("the build layouts' shared reads", () => {
  it("takes the last segment of a plugin-relative path", () => {
    expect(baseOf("skills/a/SKILL.md")).toBe("SKILL.md");
    expect(baseOf("plain.md")).toBe("plain.md");
  });

  it("knows a skill entry by its file name, wherever the skill sits", () => {
    expect(isEntry("skills/a/SKILL.md")).toBe(true);
    expect(isEntry("skills/a/actions/run.md")).toBe(false);
  });

  it("keeps only the markdown files of a plugin's agents", () => {
    const canon = aCanon("plug", { "agents/a.md": "# a", "agents/data.json": "{}" });
    expect(agentFiles(canon).map((file) => file.relativePath)).toEqual(["agents/a.md"]);
  });
});
