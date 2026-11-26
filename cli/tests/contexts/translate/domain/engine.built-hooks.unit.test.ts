import { describe, expect, it } from "vitest";
import { translate } from "../../../../src/contexts/translate/domain/engine.js";
import { manifestPathsOf } from "../../../shared/testing/manifest-probes-of.builder.js";
import { registeredTools } from "../../../shared/testing/registered-tools.builder.js";
import { aCanon } from "../testing/canon-distribution.builder.js";
import { claude, cursor } from "../testing/registered-profiles.builder.js";

const manifestPaths = manifestPathsOf(registeredTools());
const dist = aCanon("plug", { "hooks/hooks.json": `{"hooks":{}}`, "hooks/run.js": "run" });

describe("the built plugin files an install leaves out", () => {
  it("are the plugin's hooks when the tool keeps them in the project", () => {
    const { dropsBuiltFile } = translate(dist, { kind: "install", tool: cursor, manifestPaths });

    expect(dropsBuiltFile("hooks/run.js")).toBe(true);
    expect(dropsBuiltFile("hooks/hooks.json")).toBe(true);
    expect(dropsBuiltFile("skills/a/SKILL.md")).toBe(false);
  });

  it("are none when the tool's plugins carry their own hooks", () => {
    const { dropsBuiltFile } = translate(dist, { kind: "install", tool: claude, manifestPaths });

    expect(dropsBuiltFile("hooks/run.js")).toBe(false);
  });
});
