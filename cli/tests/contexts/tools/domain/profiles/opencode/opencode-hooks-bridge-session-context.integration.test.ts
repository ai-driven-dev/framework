// What a SessionStart script prints only reaches OpenCode through the generated module's own
// spawn and its V1/V2 entrypoints, so proving it means writing, importing and running that file.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { generateOpencodeHooksBridge } from "../../../../../../src/contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.js";
import { REPOSITORY_ROOT } from "../../../../../helpers/repository-root.js";

// Built rather than written as a literal "${CLAUDE_PLUGIN_ROOT}" string: biome reads a plain
// string holding "${...}" as a forgotten template literal.
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

const HOOKS_JSON = JSON.stringify({
  hooks: {
    SessionStart: [
      {
        hooks: [
          { type: "command", command: `node ${ROOT}/hooks/as-json.cjs` },
          { type: "command", command: `node ${ROOT}/hooks/as-text.cjs` },
          { type: "command", command: `node ${ROOT}/hooks/silent.cjs` },
        ],
      },
    ],
  },
});

const SCRIPTS: Record<string, string> = {
  "as-json.cjs": `process.stdout.write(JSON.stringify({
    systemMessage: "shown to the person",
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "AIDD framework: v9.9.9" },
  }));`,
  "as-text.cjs": `process.stdout.write("plain context\\n");`,
  "silent.cjs": "",
};

const EXPECTED_CONTEXT = "AIDD framework: v9.9.9\n\nplain context";

type SystemTransform = (input: unknown, output: { system: string[] }) => Promise<void>;
type ContextHook = (event: { system: unknown[] }) => Promise<void>;

interface GeneratedModule {
  factory: (input: { directory: string }) => Promise<Record<string, unknown>>;
  setup: (ctx: unknown) => Promise<() => void>;
  sessionContextOf: (output: string) => string;
  directory: string;
}

const tempDirs: string[] = [];
afterEach(async () => {
  for (const dir of tempDirs.splice(0)) execFileSync("rm", ["-rf", dir]);
});

async function importGeneratedModule(): Promise<GeneratedModule> {
  const generated = generateOpencodeHooksBridge(HOOKS_JSON, "aidd-sample");
  if (generated === null) throw new Error("expected a generated module");
  const dir = await mkdtemp(join(tmpdir(), "aidd-opencode-bridge-context-"));
  tempDirs.push(dir);
  await mkdir(join(dir, "plugin"));
  await mkdir(join(dir, "hooks", "aidd-sample"), { recursive: true });
  await writeFile(
    join(dir, "hooks", "opencode-events.js"),
    await readFile(
      join(REPOSITORY_ROOT, "cli/assets/configs/opencode/opencode-events.js.txt"),
      "utf8"
    )
  );
  for (const [name, body] of Object.entries(SCRIPTS)) {
    await writeFile(join(dir, "hooks", "aidd-sample", name), body, "utf8");
  }
  const modulePath = join(dir, "plugin", "bridge.mjs");
  await writeFile(modulePath, generated, "utf8");
  const mod: Record<string, unknown> = await import(pathToFileURL(modulePath).href);
  const factory = mod.AiddSampleHooks as GeneratedModule["factory"];
  const plugin = mod.default as { setup: GeneratedModule["setup"] };
  const sessionContextOf = Reflect.get(factory, "sessionContextOf") as (o: string) => string;
  return { factory, setup: plugin.setup, sessionContextOf, directory: dir };
}

describe("the generated bridge hands SessionStart's output to every model call", () => {
  it("V1: the system transform adds each script's context, JSON and plain text alike", async () => {
    const { factory, directory } = await importGeneratedModule();
    const hooks = await factory({ directory });
    const transform = hooks["experimental.chat.system.transform"] as SystemTransform;

    const first = { system: ["base"] };
    await transform({}, first);
    const second = { system: [] as string[] };
    await transform({}, second);

    expect(first.system).toEqual(["base", EXPECTED_CONTEXT]);
    expect(second.system).toEqual([EXPECTED_CONTEXT]);
  });

  it("V2: setup registers a context hook pushing the same text as a system block", async () => {
    const { setup, directory } = await importGeneratedModule();
    const registered: Record<string, ContextHook> = {};
    let disposed = 0;
    const ctx = {
      location: { directory },
      event: {
        subscribe: async function* () {
          // No event: only the context hook is under test.
        },
      },
      session: {
        hook: async (name: string, callback: ContextHook) => {
          registered[name] = callback;
          return {
            dispose: async () => {
              disposed += 1;
            },
          };
        },
      },
    };

    const cleanup = await setup(ctx);
    const event = { system: [] as unknown[] };
    await registered.context?.(event);
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(event.system).toEqual([{ type: "text", text: EXPECTED_CONTEXT }]);
    expect(disposed).toBe(1);
  });

  it("V2 without a session hook API still sets up, adding nothing", async () => {
    const { setup } = await importGeneratedModule();
    const ctx = {
      // Nothing here awaits the scripts, so they must not run inside the directory the test
      // removes: Windows refuses to delete a live process's working directory.
      location: { directory: tmpdir() },
      event: {
        subscribe: async function* () {
          // No event.
        },
      },
    };

    await expect(setup(ctx)).resolves.toBeTypeOf("function");
  });

  it("reads a script's output the way Claude Code and Codex do", async () => {
    const { sessionContextOf } = await importGeneratedModule();

    expect(sessionContextOf("")).toBe("");
    expect(sessionContextOf("  plain  \n")).toBe("plain");
    expect(
      sessionContextOf(JSON.stringify({ hookSpecificOutput: { additionalContext: " ctx " } }))
    ).toBe("ctx");
    expect(sessionContextOf(JSON.stringify({ systemMessage: "only shown" }))).toBe("");
  });
});
