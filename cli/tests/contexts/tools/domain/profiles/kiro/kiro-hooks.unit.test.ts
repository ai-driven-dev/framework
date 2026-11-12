import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectHooksFormat } from "../../../../../../src/contexts/tools/domain/capabilities/plugins-capability.js";
import { kiro } from "../../../../../../src/contexts/tools/domain/profiles/kiro/profile.js";

const format = kiro.capabilities.plugins.projectHooksFormat as ProjectHooksFormat;

const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

interface KiroHooksFile {
  readonly version: string;
  readonly hooks: readonly {
    readonly name: string;
    readonly trigger: string;
    readonly matcher?: string;
    readonly timeout?: number;
    readonly action: { readonly type: string; readonly command: string };
  }[];
}

function parse(content: string): KiroHooksFile {
  return JSON.parse(content) as KiroHooksFile;
}

/** A plugin's hooks.json holding these SessionStart items, each a command or another kind. */
function sessionStart(...items: readonly Record<string, unknown>[]): string {
  return JSON.stringify({ hooks: { SessionStart: [{ hooks: items }] } });
}

const MEMORY_HOOKS = sessionStart({
  type: "command",
  command: `node ${ROOT}/hooks/memory.cjs hook`,
  timeout: 5,
});

const PERSON_HOOK = {
  name: "lint",
  trigger: "PostToolUse",
  matcher: "fs_write",
  action: { type: "command", command: "./lint.sh" },
};
const PERSON_FILE = `${JSON.stringify({ version: "v1", hooks: [PERSON_HOOK] }, null, 2)}\n`;

describe("kiro's hooks file", () => {
  describe("merge", () => {
    it("writes one named hook per SessionStart command, in Kiro's v1 shape, with its timeout", () => {
      const { content, warnings } = format.merge(null, MEMORY_HOOKS, "aidd-context");

      expect(parse(content)).toEqual({
        version: "v1",
        hooks: [
          {
            name: "aidd-context-memory.cjs",
            trigger: "SessionStart",
            action: {
              type: "command",
              command: expect.stringContaining("'.kiro/hooks/aidd-context/memory.cjs'"),
            },
            timeout: 5,
          },
        ],
      });
      expect(warnings).toEqual([]);
    });

    it("skips every event other than SessionStart with a warning naming it", () => {
      const { content, warnings } = format.merge(
        null,
        JSON.stringify({
          hooks: {
            UserPromptSubmit: [{ hooks: [{ command: `node ${ROOT}/hooks/gate.cjs` }] }],
            SessionStart: [{ hooks: [{ command: `node ${ROOT}/hooks/start.cjs` }] }],
            PostToolUse: [
              { matcher: "Write|Edit", hooks: [{ command: `node ${ROOT}/hooks/post.cjs` }] },
            ],
            Stop: [{ hooks: [{ command: `node ${ROOT}/hooks/stop.cjs` }] }],
          },
        }),
        "probe"
      );

      expect(parse(content).hooks.map((hook) => `${hook.trigger} ${hook.name}`)).toEqual([
        "SessionStart probe-start.cjs",
      ]);
      expect(warnings).toEqual([
        "unmapped event 'UserPromptSubmit' skipped",
        "unmapped event 'PostToolUse' skipped",
        "unmapped event 'Stop' skipped",
      ]);
    });

    it("writes no matcher, which Kiro would read as a tool selector", () => {
      const { content } = format.merge(
        null,
        JSON.stringify({
          hooks: {
            SessionStart: [
              { matcher: "startup", hooks: [{ command: `node ${ROOT}/hooks/start.cjs` }] },
            ],
          },
        }),
        "probe"
      );

      expect(parse(content).hooks).toHaveLength(1);
      expect(parse(content).hooks[0]).not.toHaveProperty("matcher");
    });

    it("leaves Kiro's own default timeout when the source sets none", () => {
      const { content } = format.merge(
        null,
        sessionStart({ command: `node ${ROOT}/hooks/a.js` }),
        "probe"
      );

      expect(parse(content).hooks[0]).not.toHaveProperty("timeout");
    });

    it("drops what is not a plain node script command, keeping the ones beside it", () => {
      const { content } = format.merge(
        null,
        sessionStart(
          { command: `bun ${ROOT}/hooks/a.js` },
          { command: "node ./hooks/b.js" },
          { command: `FOO=1 node ${ROOT}/hooks/prefixed.js` },
          { type: "prompt", prompt: "not a command" },
          { command: `  node ${ROOT}/hooks/kept.js  ` },
          { command: `node   ${ROOT}/hooks/spaced.js` }
        ),
        "probe"
      );

      expect(parse(content).hooks.map((hook) => hook.name)).toEqual([
        "probe-kept.js",
        "probe-spaced.js",
      ]);
    });

    it("keeps a hook a person added to the file, before the plugin's", () => {
      const { content } = format.merge(PERSON_FILE, MEMORY_HOOKS, "aidd-context");

      expect(parse(content).hooks.map((hook) => hook.name)).toEqual([
        "lint",
        "aidd-context-memory.cjs",
      ]);
      expect(parse(content).hooks[0]).toEqual(PERSON_HOOK);
    });

    it("changes nothing when the same plugin is merged twice", () => {
      const { content: first } = format.merge(PERSON_FILE, MEMORY_HOOKS, "aidd-context");
      const { content: second } = format.merge(first, MEMORY_HOOKS, "aidd-context");

      expect(second).toBe(first);
    });

    it("replaces the plugin's earlier hooks rather than adding to them", () => {
      const { content: first } = format.merge(null, MEMORY_HOOKS, "aidd-context");
      const { content: second } = format.merge(
        first,
        sessionStart({ command: `node ${ROOT}/hooks/renamed.cjs` }),
        "aidd-context"
      );

      expect(parse(second).hooks.map((hook) => hook.name)).toEqual(["aidd-context-renamed.cjs"]);
    });

    it("tells a plugin from another whose name starts the same", () => {
      const tools = sessionStart({ command: `node ${ROOT}/hooks/tools.cjs` });
      const { content: first } = format.merge(null, tools, "aidd-dev-tools");
      const { content: second } = format.merge(
        first,
        sessionStart({ command: `node ${ROOT}/hooks/dev.cjs` }),
        "aidd-dev"
      );

      expect(parse(second).hooks.map((hook) => hook.name)).toEqual([
        "aidd-dev-tools-tools.cjs",
        "aidd-dev-dev.cjs",
      ]);
      expect(format.contributedEntries(second, "aidd-dev")).toHaveLength(1);
    });

    it("refuses a file it cannot parse rather than overwriting it", () => {
      expect(() => format.merge("{ not json", MEMORY_HOOKS, "aidd-context")).toThrow();
    });

    it("holds no hook for a plugin with no SessionStart command, a file Kiro reads as none", () => {
      const { content } = format.merge(
        null,
        JSON.stringify({
          hooks: { Stop: [{ hooks: [{ command: `node ${ROOT}/hooks/x.js` }] }] },
        }),
        "probe"
      );

      expect(parse(content)).toEqual({ version: "v1", hooks: [] });
      expect(format.merge(null, "{}", "probe").content).toBe(content);
    });
  });

  describe("unmerge", () => {
    it("removes the plugin's hooks and leaves a person's untouched", () => {
      const { content } = format.merge(PERSON_FILE, MEMORY_HOOKS, "aidd-context");

      expect(format.unmerge(content, "aidd-context")).toBe(PERSON_FILE);
    });
  });

  describe("contributedEntries", () => {
    it("lists the plugin's hooks with their event and command, and nothing of a person's", () => {
      const { content } = format.merge(PERSON_FILE, MEMORY_HOOKS, "aidd-context");
      const [hook] = parse(content).hooks.filter((entry) => entry.name !== "lint");

      expect(format.contributedEntries(content, "aidd-context")).toEqual([
        {
          event: "SessionStart",
          entry: { name: "aidd-context-memory.cjs", command: hook?.action.command, timeout: 5 },
        },
      ]);
      expect(format.contributedEntries(content, "lint")).toEqual([]);
    });
  });

  describe("isEmpty", () => {
    it("is true only once no hook is left", () => {
      const { content } = format.merge(null, MEMORY_HOOKS, "aidd-context");

      expect(format.isEmpty(content)).toBe(false);
      expect(format.isEmpty(format.unmerge(content, "aidd-context"))).toBe(true);
    });
  });

  it("puts a plugin's scripts under its own directory in .kiro/hooks/", () => {
    expect(format.scriptPath("aidd-context", "hooks/lib/host.cjs")).toBe(
      ".kiro/hooks/aidd-context/lib/host.cjs"
    );
    expect(format.scriptDir("aidd-context")).toBe(".kiro/hooks/aidd-context/");
  });

  describe("the launcher each command runs", () => {
    const created: string[] = [];

    afterEach(async () => {
      await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
    });

    async function workspace(): Promise<{ project: string; home: string }> {
      const base = await mkdtemp(join(tmpdir(), "aidd-kiro-hooks-"));
      created.push(base);
      const project = join(base, "project");
      const home = join(base, "home");
      await mkdir(project, { recursive: true });
      await mkdir(home, { recursive: true });
      return { project, home };
    }

    /** A script that records, in the directory it runs from, its arguments and whose copy it is. */
    async function plantProbe(root: string, copy = ""): Promise<void> {
      const dir = join(root, ".kiro", "hooks", "probe");
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, "probe.js"),
        `require("fs").writeFileSync(require("path").join(process.cwd(), "ran.txt"), ${JSON.stringify(copy)} + process.argv.slice(2).join(","));\n`
      );
    }

    function commandFor(args: string): string {
      const { content } = format.merge(
        null,
        sessionStart({ command: `node ${ROOT}/hooks/probe.js${args}` }),
        "probe"
      );
      const command = parse(content).hooks[0]?.action.command;
      if (command === undefined) throw new Error("no command generated");
      return command;
    }

    function run(command: string, cwd: string, home: string) {
      return spawnSync(command, {
        cwd,
        shell: true,
        timeout: 15_000,
        env: { ...process.env, HOME: home, USERPROFILE: home },
      });
    }

    it("runs the script installed in the project, passing its arguments through", async () => {
      const { project, home } = await workspace();
      await plantProbe(project);

      const result = run(commandFor(" --quiet two"), project, home);

      expect(result.status).toBe(0);
      expect(await readFile(join(project, "ran.txt"), "utf8")).toBe("--quiet,two");
    });

    it("runs the copy installed in the home directory, still running in the project", async () => {
      const { project, home } = await workspace();
      await plantProbe(home);

      const result = run(commandFor(""), project, home);

      expect(result.status).toBe(0);
      expect(await readFile(join(project, "ran.txt"), "utf8")).toBe("");
    });

    it("prefers the home copy, so a repository cannot have its own script run by a home install", async () => {
      const { project, home } = await workspace();
      await plantProbe(home, "home:");
      await plantProbe(project, "project:");

      const result = run(commandFor(""), project, home);

      expect(result.status).toBe(0);
      expect(await readFile(join(project, "ran.txt"), "utf8")).toBe("home:");
    });

    it("passes the script's own exit code to Kiro", async () => {
      const { project, home } = await workspace();
      const dir = join(project, ".kiro", "hooks", "probe");
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "probe.js"), "process.exit(2);\n");

      expect(run(commandFor(""), project, home).status).toBe(2);
    });

    it("exits cleanly and says so when neither scope has the script", async () => {
      const { project, home } = await workspace();

      const result = run(commandFor(""), project, home);

      expect(result.status).toBe(0);
      expect(result.stderr.toString()).toContain("hook script not found");
    });
  });
});
