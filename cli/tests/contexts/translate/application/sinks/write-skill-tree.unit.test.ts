import { describe, expect, it } from "vitest";
import { writeSkillTree } from "../../../../../src/contexts/translate/application/sinks/write-skill-tree.js";
import { FrameworkPlaceholderInPluginError } from "../../../../../src/contexts/translate/domain/translate.error.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { WindowsListingFileAdapter } from "../../../../shared/testing/windows-listing-file-adapter.fake.js";
import { CLAUDE_ROOT_TOKEN } from "../../testing/engine-kit.builder.js";

const PLUGIN = "aidd-test";
const PLUGIN_SRC = "/src/plugins/aidd-test";
const PLUGIN_OUT = "/out/plugins/aidd-test";

const entryContent = "---\nname: hello\n---\n\nSee @./reference.json and @../commit/SKILL.md\n";
const assetContent = '{ "entry": "run.sh" }\n';

function fsWith(files: Record<string, string>): InMemoryFileAdapter {
  return new InMemoryFileAdapter(files);
}

function writtenUnder(fs: InMemoryFileAdapter, dir: string): Record<string, string | undefined> {
  return Object.fromEntries(fs.listUnder(dir).map((path) => [path, fs.getFile(path)]));
}

describe("writeSkillTree", () => {
  it("writes nothing for a plugin shipping no skills directory", async () => {
    const fs = fsWith({ [`${PLUGIN_SRC}/agents/reviewer.md`]: "# Reviewer" });
    expect(
      await writeSkillTree({ fs, pluginName: PLUGIN, pluginSrc: PLUGIN_SRC, pluginOut: PLUGIN_OUT })
    ).toBe(0);
    expect(writtenUnder(fs, PLUGIN_OUT)).toEqual({});
  });

  it("rewrites a skill's own markdown links and carries its asset byte for byte", async () => {
    const fs = fsWith({
      [`${PLUGIN_SRC}/skills/hello/SKILL.md`]: entryContent,
      [`${PLUGIN_SRC}/skills/hello/reference.json`]: assetContent,
    });
    expect(
      await writeSkillTree({ fs, pluginName: PLUGIN, pluginSrc: PLUGIN_SRC, pluginOut: PLUGIN_OUT })
    ).toBe(2);
    expect(writtenUnder(fs, PLUGIN_OUT)).toEqual({
      [`${PLUGIN_OUT}/skills/hello/SKILL.md`]:
        "---\nname: hello\n---\n\nSee [reference.json](./reference.json) and [commit/SKILL.md](../commit/SKILL.md)\n",
      [`${PLUGIN_OUT}/skills/hello/reference.json`]: assetContent,
    });
  });

  it("hands the skill's entry file to the transform, and no other file", async () => {
    const fs = fsWith({
      [`${PLUGIN_SRC}/skills/hello/SKILL.md`]: "# Entry\n",
      [`${PLUGIN_SRC}/skills/hello/actions/run.md`]: "# Action\n",
      [`${PLUGIN_SRC}/skills/hello/reference.json`]: assetContent,
    });
    const transform = (content: string, plugin: string, base: string): string =>
      `${plugin}:${base}\n${content}`;
    expect(
      await writeSkillTree({
        fs,
        pluginName: PLUGIN,
        pluginSrc: PLUGIN_SRC,
        pluginOut: PLUGIN_OUT,
        transform,
      })
    ).toBe(3);
    expect(writtenUnder(fs, PLUGIN_OUT)).toEqual({
      [`${PLUGIN_OUT}/skills/hello/SKILL.md`]: "aidd-test:SKILL.md\n# Entry\n",
      [`${PLUGIN_OUT}/skills/hello/actions/run.md`]: "# Action\n",
      [`${PLUGIN_OUT}/skills/hello/reference.json`]: assetContent,
    });
  });

  it("carries a file that is not markdown untouched, whatever it names", async () => {
    const raw = "See @./reference.json and @{{TOOLS}}/x.\n";
    const fs = fsWith({ [`${PLUGIN_SRC}/skills/hello/notes.txt`]: raw });
    expect(
      await writeSkillTree({ fs, pluginName: PLUGIN, pluginSrc: PLUGIN_SRC, pluginOut: PLUGIN_OUT })
    ).toBe(1);
    expect(fs.getFile(`${PLUGIN_OUT}/skills/hello/notes.txt`)).toBe(raw);
  });

  it("points a plugin-root reference from where the skill file lands", async () => {
    const fs = fsWith({
      [`${PLUGIN_SRC}/skills/hello/SKILL.md`]: `See @${CLAUDE_ROOT_TOKEN}/hooks/run.sh\n`,
    });
    await writeSkillTree({ fs, pluginName: PLUGIN, pluginSrc: PLUGIN_SRC, pluginOut: PLUGIN_OUT });
    expect(fs.getFile(`${PLUGIN_OUT}/skills/hello/SKILL.md`)).toBe(
      "See [run.sh](../../hooks/run.sh)\n"
    );
  });

  it("refuses a skill naming the framework's tools placeholder", async () => {
    const fs = fsWith({
      [`${PLUGIN_SRC}/skills/hello/SKILL.md`]: "See @{{TOOLS}}/agents/planner.md.\n",
    });
    await expect(
      writeSkillTree({ fs, pluginName: PLUGIN, pluginSrc: PLUGIN_SRC, pluginOut: PLUGIN_OUT })
    ).rejects.toThrow(new FrameworkPlaceholderInPluginError(PLUGIN, "hello/SKILL.md"));
  });

  it("names the file in the refusal with forward slashes", async () => {
    const fs = new WindowsListingFileAdapter({
      [`${PLUGIN_SRC}/skills/win/SKILL.md`]: "See @{{TOOLS}}/x.md.\n",
    });
    await expect(
      writeSkillTree({ fs, pluginName: PLUGIN, pluginSrc: PLUGIN_SRC, pluginOut: PLUGIN_OUT })
    ).rejects.toThrow(new FrameworkPlaceholderInPluginError(PLUGIN, "win/SKILL.md"));
  });
});
