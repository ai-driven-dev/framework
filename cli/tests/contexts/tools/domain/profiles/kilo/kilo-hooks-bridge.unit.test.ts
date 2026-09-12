import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
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
});
