import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  generateKiloHooksBridge,
  parseKiloSessionStartHooks,
} from "../../../../../../src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.js";

const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

describe("Kilo hooks bridge", () => {
  it("keeps only replayable SessionStart commands", () => {
    expect(
      parseKiloSessionStartHooks(
        JSON.stringify({
          hooks: {
            SessionStart: [
              {
                hooks: [
                  { command: `node ${ROOT}/hooks/update_memory.js --quiet` },
                  { command: "python ignored.py" },
                ],
              },
            ],
            Stop: [{ hooks: [{ command: `node ${ROOT}/hooks/stop.js` }] }],
          },
        })
      )
    ).toEqual([{ script: "update_memory.js", args: ["--quiet"] }]);
  });

  it("returns no module when hooks.json has no replayable SessionStart command", () => {
    expect(
      generateKiloHooksBridge(JSON.stringify({ hooks: { Stop: [] } }), "aidd-context")
    ).toBeNull();
  });

  it("generates an importable Kilo default descriptor and maps SessionStart to session.created", async () => {
    const generated = generateKiloHooksBridge(
      JSON.stringify({
        hooks: {
          SessionStart: [{ hooks: [{ command: `node ${ROOT}/hooks/update_memory.js` }] }],
        },
      }),
      "aidd-context"
    );

    expect(generated).toContain(
      'export default { id: "aidd-context-hooks", server: AiddContextKiloHooks }'
    );
    expect(generated).toContain('event?.type !== "session.created"');
    expect(generated).toContain('hook_event_name: "SessionStart"');
    expect(generated).toContain("Kilo session-start hook");

    const directory = await mkdtemp(join(tmpdir(), "aidd-kilo-hooks-bridge-"));
    try {
      const modulePath = join(directory, "bridge.mjs");
      await writeFile(modulePath, generated ?? "", "utf8");
      const module = (await import(pathToFileURL(modulePath).href)) as {
        default: {
          id: string;
          server: {
            sessionStartCallsFor: (event: unknown, cwd: string) => readonly unknown[];
          };
        };
      };
      expect(module.default.id).toBe("aidd-context-hooks");
      expect(
        module.default.server.sessionStartCallsFor({ type: "session.created" }, "/project")
      ).toEqual([
        {
          script: "update_memory.js",
          args: [],
          payload: { hook_event_name: "SessionStart", session_id: null, cwd: "/project" },
        },
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reports a hook that exits unsuccessfully without blocking the session", async () => {
    const generated = generateKiloHooksBridge(
      JSON.stringify({
        hooks: {
          SessionStart: [{ hooks: [{ command: `node ${ROOT}/hooks/fail.js` }] }],
        },
      }),
      "aidd-context"
    );
    const directory = await mkdtemp(join(tmpdir(), "aidd-kilo-hooks-failure-"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await mkdir(join(directory, "hooks", "aidd-context"), { recursive: true });
      await mkdir(join(directory, "plugin"), { recursive: true });
      await writeFile(
        join(directory, "hooks", "aidd-context", "fail.js"),
        "process.exit(7);",
        "utf8"
      );
      const modulePath = join(directory, "plugin", "aidd-context-hooks.mjs");
      await writeFile(modulePath, generated ?? "", "utf8");
      const module = (await import(pathToFileURL(modulePath).href)) as {
        default: {
          server: (input: {
            directory: string;
          }) => Promise<{ event: (input: { event: unknown }) => Promise<void> }>;
        };
      };
      const server = await module.default.server({ directory });
      await server.event({ event: { type: "session.created" } });
      await vi.waitFor(
        () => expect(warn).toHaveBeenCalledWith(expect.stringContaining("exited with code 7")),
        { timeout: 5000, interval: 20 }
      );
    } finally {
      warn.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
