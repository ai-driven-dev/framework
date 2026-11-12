import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProjectHooksMaterializer } from "../../../src/contexts/framework/application/framework/translator/project-hooks-materializer.js";
import type { ToolBuildContract } from "../../../src/contexts/tools/contract/build-contract.js";
import { aiProfileOf } from "../../../src/contexts/tools/contract/tool-profile-lookup.js";
import { buildClaudeFlatContract } from "../../../src/contexts/tools/domain/profiles/claude/build.js";
import { buildCodexFlatContract } from "../../../src/contexts/tools/domain/profiles/codex/build.js";
import { buildCopilotFlatContract } from "../../../src/contexts/tools/domain/profiles/copilot/build.js";
import { buildCursorFlatContract } from "../../../src/contexts/tools/domain/profiles/cursor/build.js";
import { FlatBuildStrategy } from "../../../src/contexts/translate/application/strategies/flat-build-strategy.js";
import {
  type PluginComponentFile,
  PluginDistribution,
} from "../../../src/contexts/translate/domain/plugin-distribution.js";
import type { AssetProvider } from "../../../src/kernel/ports/asset-provider.js";
import { InMemoryFileAdapter } from "../../helpers/ports/in-memory-file-adapter.js";
import { catalogOf } from "./testing/catalog-of.js";

/**
 * Every route that merges a plugin's hooks into a file the project already holds. The file
 * holds this plugin's entries from an earlier run, another plugin's and a person's; merging the
 * plugin again must leave it once, and leave everything else as it was.
 */

const PLUGIN = "aidd-test";
const SRC = "/source/plugins/aidd-test";
const OUT = "/out";
// biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a plugin's hooks name
const ROOT = "${CLAUDE_PLUGIN_ROOT}";

const PLUGIN_HOOKS = JSON.stringify({
  hooks: {
    SessionStart: [{ hooks: [{ type: "command", command: `node ${ROOT}/hooks/start.cjs` }] }],
    PostToolUse: [
      {
        matcher: "Write|Edit",
        hooks: [{ type: "command", command: `node ${ROOT}/hooks/check.cjs`, timeout: 5 }],
      },
    ],
  },
});

const SCRIPTS = { "hooks/start.cjs": "start", "hooks/check.cjs": "check" } as const;

const PERSON = "echo person";
const PERSON_CHECK = "echo person-check";

const unused: AssetProvider = {
  loadConfigAsset: () => {
    throw new Error("not used");
  },
  loadSchema: () => ({}),
};

function sourceFs(seed: Record<string, string>): InMemoryFileAdapter {
  return new InMemoryFileAdapter({
    [`${SRC}/hooks/hooks.json`]: PLUGIN_HOOKS,
    ...Object.fromEntries(Object.entries(SCRIPTS).map(([rel, body]) => [`${SRC}/${rel}`, body])),
    ...seed,
  });
}

async function flatMerge(
  contract: ToolBuildContract,
  seed: Record<string, string>
): Promise<InMemoryFileAdapter> {
  const fs = sourceFs(seed);
  const strategy = new FlatBuildStrategy(fs, unused, contract, true, OUT, async () => true);
  await strategy.writeHooks(PLUGIN, SRC);
  return fs;
}

type Nested = { matcher?: string; hooks: { command: string }[] };
type Flat = { command: string };

/** The commands of one event, in order, whatever the file's shape. */
function commands(file: string | undefined, event: string): string[] {
  const parsed = JSON.parse(file ?? "{}") as { hooks?: Record<string, (Nested | Flat)[]> };
  return (parsed.hooks?.[event] ?? []).flatMap((entry) =>
    "hooks" in entry ? entry.hooks.map((item) => item.command) : [entry.command]
  );
}

/** A nested settings file as an earlier run of this plugin, another plugin and a person left
 * it. The PostToolUse group mixes a person's command with this plugin's. */
function nestedSeed(dir: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    ...extra,
    hooks: {
      SessionStart: [
        { hooks: [{ type: "command", command: `node ./${dir}${PLUGIN}/start.cjs` }] },
        { hooks: [{ type: "command", command: `node ./${dir}other/start.cjs` }] },
        { hooks: [{ type: "command", command: PERSON }] },
      ],
      PostToolUse: [
        {
          matcher: "Write|Edit",
          hooks: [
            { type: "command", command: PERSON_CHECK },
            { type: "command", command: `node ./${dir}${PLUGIN}/check.cjs`, timeout: 5 },
          ],
        },
      ],
    },
  });
}

describe("a flat build merging a plugin into a shared file it already wrote to", () => {
  it("claude: .claude/settings.json strips the plugin's own entries, keeping the rest", async () => {
    const dir = ".claude/hooks/";
    const fs = await flatMerge(buildClaudeFlatContract(), {
      [`${OUT}/.claude/settings.json`]: nestedSeed(dir, { model: "opus" }),
    });
    const file = fs.getFile(`${OUT}/.claude/settings.json`);

    expect(JSON.parse(file ?? "{}").model).toBe("opus");
    expect(commands(file, "SessionStart")).toStrictEqual([
      `node ./${dir}other/start.cjs`,
      PERSON,
      `node ./${dir}${PLUGIN}/start.cjs`,
    ]);
    expect(commands(file, "PostToolUse")).toStrictEqual([
      PERSON_CHECK,
      `node ./${dir}${PLUGIN}/check.cjs`,
    ]);
  });

  it("codex: .codex/hooks.json strips the plugin's own entries, keeping the rest", async () => {
    const dir = ".codex/hooks/";
    const fs = await flatMerge(buildCodexFlatContract(), {
      [`${OUT}/.codex/hooks.json`]: nestedSeed(dir),
    });
    const file = fs.getFile(`${OUT}/.codex/hooks.json`);

    expect(commands(file, "SessionStart")).toStrictEqual([
      `node ./${dir}other/start.cjs`,
      PERSON,
      `node ./${dir}${PLUGIN}/start.cjs`,
    ]);
    expect(commands(file, "PostToolUse")).toStrictEqual([
      PERSON_CHECK,
      `node ./${dir}${PLUGIN}/check.cjs`,
    ]);
  });

  it("cursor: .cursor/hooks.json strips the plugin's own entries, keeping the rest", async () => {
    const dir = ".cursor/hooks/";
    const fs = await flatMerge(buildCursorFlatContract(), {
      [`${OUT}/.cursor/hooks.json`]: JSON.stringify({
        version: 1,
        hooks: {
          sessionStart: [
            { command: `node ./${dir}${PLUGIN}/start.cjs` },
            { command: `node ./${dir}other/start.cjs` },
            { command: PERSON },
          ],
          postToolUse: [
            { command: PERSON_CHECK, matcher: "Write|Edit" },
            { command: `node ./${dir}${PLUGIN}/check.cjs`, matcher: "Write|Edit", timeout: 5 },
          ],
        },
      }),
    });
    const file = fs.getFile(`${OUT}/.cursor/hooks.json`);

    expect(commands(file, "sessionStart")).toStrictEqual([
      `node ./${dir}other/start.cjs`,
      PERSON,
      `node ./${dir}${PLUGIN}/start.cjs`,
    ]);
    expect(commands(file, "postToolUse")).toStrictEqual([
      PERSON_CHECK,
      `node ./${dir}${PLUGIN}/check.cjs`,
    ]);
  });

  it("copilot: no shared file; a forced build rewrites the plugin's own file whole", async () => {
    const dir = ".github/hooks/";
    const own = `${OUT}/${dir}${PLUGIN}.hooks.json`;
    const fs = await flatMerge(buildCopilotFlatContract(), {
      [own]: JSON.stringify({
        version: 1,
        hooks: {
          SessionStart: [
            { type: "command", command: `node ./${dir}${PLUGIN}/start.cjs` },
            { type: "command", command: PERSON },
          ],
        },
      }),
    });
    const file = fs.getFile(own);

    expect(commands(file, "SessionStart")).toStrictEqual([`node ./${dir}${PLUGIN}/start.cjs`]);
    expect(commands(file, "PostToolUse")).toStrictEqual([`node ./${dir}${PLUGIN}/check.cjs`]);
  });
});

describe("plugin install merging a plugin into the project's hooks file again", () => {
  const PROJECT = "/project";
  const HOOKS = join(PROJECT, ".cursor", "hooks.json");

  function dist(): PluginDistribution {
    const hooks: PluginComponentFile[] = [
      { relativePath: "hooks/hooks.json", content: PLUGIN_HOOKS },
      ...Object.entries(SCRIPTS).map(([relativePath, content]) => ({ relativePath, content })),
    ];
    return new PluginDistribution({
      manifest: { name: PLUGIN, version: "1.0.0" },
      format: "claude",
      files: hooks,
      components: { commands: [], agents: [], rules: [], skills: [], hooks, mcp: [] },
    });
  }

  it("cursor: .cursor/hooks.json strips the plugin's own entries, keeping the rest", async () => {
    const dir = ".cursor/hooks/";
    const fs = new InMemoryFileAdapter({
      [HOOKS]: JSON.stringify({
        version: 1,
        hooks: {
          sessionStart: [{ command: `node ./${dir}other/start.cjs` }, { command: PERSON }],
          postToolUse: [{ command: PERSON_CHECK, matcher: "Write|Edit" }],
        },
      }),
    });
    const materializer = new ProjectHooksMaterializer(fs);
    const first = await materializer.materializeWithProvenance(
      dist(),
      aiProfileOf(catalogOf().sortedById(), "cursor"),
      PROJECT
    );

    await materializer.materializeWithProvenance(
      dist(),
      aiProfileOf(catalogOf().sortedById(), "cursor"),
      PROJECT,
      first.projectHooks
    );
    const file = fs.getFile(HOOKS);

    expect(commands(file, "sessionStart")).toStrictEqual([
      `node ./${dir}other/start.cjs`,
      PERSON,
      `node ./${dir}${PLUGIN}/start.cjs`,
    ]);
    expect(commands(file, "postToolUse")).toStrictEqual([
      PERSON_CHECK,
      `node ./${dir}${PLUGIN}/check.cjs`,
    ]);
  });
});
