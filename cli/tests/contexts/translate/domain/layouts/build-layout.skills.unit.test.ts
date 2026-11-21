import { describe, expect, it } from "vitest";
import { FrameworkPlaceholderInPluginError } from "../../../../../src/contexts/translate/domain/translate.error.js";
import { translateBuildLayout } from "../../../../shared/testing/build-files.builder.js";
import { aCanon } from "../../testing/canon-distribution.builder.js";
import { CLAUDE_ROOT_TOKEN } from "../../testing/engine-kit.builder.js";
import {
  aStubBuildContract,
  aSupportedArtifact,
} from "../../testing/stub-build-contract.builder.js";

const PLUGIN = "aidd-test";
const entryContent = "---\nname: hello\n---\n\nSee @./reference.json and @../commit/SKILL.md\n";
const assetContent = '{ "entry": "run.sh" }\n';

function marketplaceFiles(files: Record<string, string>, contract = aStubBuildContract()) {
  const built = translateBuildLayout(aCanon(PLUGIN, files), contract, "marketplace");
  return Object.fromEntries(built.map((file) => [file.relativePath, file.content]));
}

describe("the marketplace layout of a plugin's skills", () => {
  it("builds nothing for a plugin shipping no skills", () => {
    expect(marketplaceFiles({ "README.md": "# Readme" })).toEqual({});
  });

  it("rewrites a skill's own markdown links and carries its asset byte for byte", () => {
    expect(
      marketplaceFiles({
        "skills/hello/SKILL.md": entryContent,
        "skills/hello/reference.json": assetContent,
      })
    ).toEqual({
      [`plugins/${PLUGIN}/skills/hello/SKILL.md`]:
        "---\nname: hello\n---\n\nSee [reference.json](./reference.json) and [commit/SKILL.md](../commit/SKILL.md)\n",
      [`plugins/${PLUGIN}/skills/hello/reference.json`]: assetContent,
    });
  });

  it("reshapes the skill's entry frontmatter, and no other file's", () => {
    const skillFrontmatter = (fm: Record<string, unknown>) => ({ ...fm, shaped: true });
    const contract = aStubBuildContract();
    const built = marketplaceFiles(
      {
        "skills/hello/SKILL.md": "# Entry\n",
        "skills/hello/actions/run.md": "# Action\n",
        "skills/hello/reference.json": assetContent,
      },
      {
        ...contract,
        artifacts: { ...contract.artifacts, skills: aSupportedArtifact({ skillFrontmatter }) },
      }
    );
    expect(built).toEqual({
      [`plugins/${PLUGIN}/skills/hello/SKILL.md`]: "---\nshaped: true\n---\n# Entry\n",
      [`plugins/${PLUGIN}/skills/hello/actions/run.md`]: "# Action\n",
      [`plugins/${PLUGIN}/skills/hello/reference.json`]: assetContent,
    });
  });

  it("carries a file that is not markdown untouched, whatever it names", () => {
    const raw = "See @./reference.json and @{{TOOLS}}/x.\n";
    expect(marketplaceFiles({ "skills/hello/notes.txt": raw })).toEqual({
      [`plugins/${PLUGIN}/skills/hello/notes.txt`]: raw,
    });
  });

  it("points a plugin-root reference from where the skill file lands", () => {
    const built = marketplaceFiles({
      "skills/hello/SKILL.md": `See @${CLAUDE_ROOT_TOKEN}/hooks/run.sh\n`,
    });
    expect(built[`plugins/${PLUGIN}/skills/hello/SKILL.md`]).toBe(
      "See [run.sh](../../hooks/run.sh)\n"
    );
  });

  it("refuses a skill naming the framework's tools placeholder", () => {
    expect(() =>
      marketplaceFiles({ "skills/hello/SKILL.md": "See @{{TOOLS}}/agents/planner.md.\n" })
    ).toThrow(new FrameworkPlaceholderInPluginError(PLUGIN, "hello/SKILL.md"));
  });
});
