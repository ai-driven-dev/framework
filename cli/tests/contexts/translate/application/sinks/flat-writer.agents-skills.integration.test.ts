import { describe, expect, it } from "vitest";
import { FrameworkPlaceholderInPluginError } from "../../../../../src/contexts/translate/domain/translate.error.js";
import {
  agentsIn,
  skillsIn,
} from "../../../../../src/shared/domain/materialization/artifact-path.js";
import { flatArtifactLayout } from "../../../../../src/shared/domain/materialization/flat-paths.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import {
  STUB_LAYOUT,
  STUB_OUT,
  STUB_PLUGIN_SRC,
  stubContract,
  stubWrite,
  supportedArtifact,
  writtenUnder,
} from "../../testing/flat-writer-world.builder.js";

const SINGLE_LEVEL = flatArtifactLayout(".stub/", {
  skills: "single-level",
  agent: { ext: ".md" },
});

describe("the agents a flat layout writes", () => {
  const reviewer = "---\nname: reviewer\n---\n\nReview the diff.\n";

  it("writes each agent markdown at the path the layout names, and nothing else under agents/", async () => {
    const memFs = new InMemoryFileAdapter({
      [`${STUB_PLUGIN_SRC}/agents/reviewer.md`]: reviewer,
      [`${STUB_PLUGIN_SRC}/agents/notes.txt`]: "not an agent",
    });
    const written = await stubWrite(memFs, stubContract());
    expect(written).toBe(1);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({
      [`${STUB_OUT}/.stub/agents/aidd-test-reviewer.md`]:
        "---\nname: 'reviewer'\n---\n\nReview the diff.\n",
    });
  });

  it("hands the agent to the layout's own transform when it declares one", async () => {
    const memFs = new InMemoryFileAdapter({ [`${STUB_PLUGIN_SRC}/agents/reviewer.md`]: reviewer });
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        agents: supportedArtifact(agentsIn(STUB_LAYOUT), {
          transform: (content, plugin, base) => `${plugin}:${base}\n${content}`,
        }),
      },
    });
    await stubWrite(memFs, contract);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({
      [`${STUB_OUT}/.stub/agents/aidd-test-reviewer.md`]: `aidd-test:reviewer.md\n${reviewer}`,
    });
  });

  it("writes nothing for a layout hosting no agent", async () => {
    const memFs = new InMemoryFileAdapter({ [`${STUB_PLUGIN_SRC}/agents/reviewer.md`]: reviewer });
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        agents: { supported: false, reason: "off in this test" },
      },
    });
    expect(await stubWrite(memFs, contract)).toBe(0);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({});
  });

  it("names the agent that references the framework's tools directory", async () => {
    const memFs = new InMemoryFileAdapter({
      [`${STUB_PLUGIN_SRC}/agents/nested/reviewer.md`]: "See @{{TOOLS}}/x.md\n",
    });
    await expect(stubWrite(memFs, stubContract())).rejects.toThrow(
      new FrameworkPlaceholderInPluginError("aidd-test", "agents/nested/reviewer.md")
    );
  });
});

describe("a flat build with a collision and a placeholder", () => {
  it("names the placeholder first, before any destination is looked at", async () => {
    const memFs = new InMemoryFileAdapter({
      [`${STUB_PLUGIN_SRC}/agents/a.md`]: "# a\n",
      [`${STUB_PLUGIN_SRC}/agents/z.md`]: "See @{{TOOLS}}/x.md\n",
      [`${STUB_OUT}/.stub/agents/aidd-test-a.md`]: "already built\n",
    });
    await expect(stubWrite(memFs, stubContract())).rejects.toThrow(
      new FrameworkPlaceholderInPluginError("aidd-test", "agents/z.md")
    );
    expect(memFs.getFile(`${STUB_OUT}/.stub/agents/aidd-test-a.md`)).toBe("already built\n");
  });
});

describe("the skills a flat layout writes", () => {
  const entry = "---\nname: hello\n---\n\nHello, see @./reference.json\n";
  const asset = '{ "see": "@./SKILL.md" }\n';

  function skillFs(): InMemoryFileAdapter {
    return new InMemoryFileAdapter({
      [`${STUB_PLUGIN_SRC}/skills/hello/SKILL.md`]: entry,
      [`${STUB_PLUGIN_SRC}/skills/hello/reference.json`]: asset,
    });
  }

  it("rewrites a skill markdown's own links and carries every other file as it is", async () => {
    const memFs = skillFs();
    expect(await stubWrite(memFs, stubContract())).toBe(2);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({
      [`${STUB_OUT}/.stub/skills/aidd-test/hello/SKILL.md`]:
        "---\nname: hello\n---\n\nHello, see [reference.json](./reference.json)\n",
      [`${STUB_OUT}/.stub/skills/aidd-test/hello/reference.json`]: asset,
    });
  });

  it("names the entry file after its own folder where the layout asks for it", async () => {
    const memFs = skillFs();
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        skills: supportedArtifact(skillsIn(SINGLE_LEVEL), {
          rewriteSkillName: true,
        }),
      },
    });
    await stubWrite(memFs, contract);
    expect(memFs.getFile(`${STUB_OUT}/.stub/skills/aidd-test-hello/SKILL.md`)).toBe(
      "---\nname: 'aidd-test-hello'\n---\n\nHello, see [reference.json](./reference.json)\n"
    );
  });

  it("leaves the entry file alone when its flat destination has no folder to name it after", async () => {
    const memFs = new InMemoryFileAdapter({
      [`${STUB_PLUGIN_SRC}/skills/hello/SKILL.md`]: entry,
    });
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        skills: supportedArtifact({ kind: "file", at: "SKILL.md" }, { rewriteSkillName: true }),
      },
    });
    await stubWrite(memFs, contract);
    expect(memFs.getFile(`${STUB_OUT}/SKILL.md`)).toBe(
      "---\nname: hello\n---\n\nHello, see [reference.json](./reference.json)\n"
    );
  });

  it("writes nothing for a layout hosting no skill", async () => {
    const memFs = skillFs();
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        skills: { supported: false, reason: "off in this test" },
      },
    });
    expect(await stubWrite(memFs, contract)).toBe(0);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({});
  });
});
