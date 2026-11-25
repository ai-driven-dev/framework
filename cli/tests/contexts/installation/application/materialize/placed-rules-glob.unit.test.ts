import { describe, expect, it } from "vitest";
import { placedRulesGlob } from "../../../../../src/contexts/installation/application/materialize/placed-rules-glob.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const file = (relativePath: string) =>
  new InstallationFile({ relativePath, content: "", hash: FileHash.of("") });

describe("the glob an install lists a plugin's rules by", () => {
  const kilo = registeredTools().aiProfile(TOOL.kilo);

  it("names the plugin's rules when the install placed one", () => {
    expect(
      placedRulesGlob(kilo, {
        pluginName: "aidd-dev",
        files: [file(".kilo/agents/aidd-dev-a.md"), file(".kilo/rules/aidd-dev-01-a.md")],
      })
    ).toBe(".kilo/rules/aidd-dev-*.md");
  });

  it("names nothing when the install placed no rule of the plugin", () => {
    expect(
      placedRulesGlob(kilo, { pluginName: "aidd-dev", files: [file(".kilo/rules/aidd-pm-a.md")] })
    ).toBeNull();
  });

  it("names nothing for a tool that keeps each plugin's rules under its own folder", () => {
    expect(
      placedRulesGlob(registeredTools().aiProfile(TOOL.opencode), {
        pluginName: "aidd-dev",
        files: [file(".opencode/rules/aidd-dev/01-a.md")],
      })
    ).toBeNull();
  });
});
