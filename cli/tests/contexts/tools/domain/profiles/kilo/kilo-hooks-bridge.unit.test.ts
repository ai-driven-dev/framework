import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
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

  it("returns no module when hooks.json has no supported replayable hooks", () => {
    expect(
      generateKiloHooksBridge(JSON.stringify({ hooks: { Stop: [] } }), "aidd-context")
    ).toBeNull();
  });

  it("generates a bridge when only Stop or PostToolUse is declared", () => {
    for (const event of ["Stop", "PostToolUse"]) {
      expect(
        generateKiloHooksBridge(
          JSON.stringify({
            hooks: {
              [event]: [{ hooks: [{ command: `node ${ROOT}/hooks/capture.cjs` }] }],
            },
          }),
          "probe"
        )
      ).not.toBeNull();
    }
  });

  it("dispatches real-shaped session/tool/idle events once and resets on the next busy turn", async () => {
    const directory = await mkdtemp(join(tmpdir(), "aidd-kilo-events-"));
    const output = join(directory, "calls.jsonl");
    const call = { command: `node ${ROOT}/hooks/capture.cjs --quiet` };
    const generated = generateKiloHooksBridge(
      JSON.stringify({
        hooks: {
          SessionStart: [{ hooks: [call] }],
          Stop: [{ hooks: [call] }],
          PostToolUse: [{ matcher: "read|write", hooks: [call] }],
        },
      }),
      "probe"
    );
    try {
      await mkdir(join(directory, "hooks", "probe"), { recursive: true });
      await mkdir(join(directory, "plugin"));
      await writeFile(
        join(directory, "hooks", "probe", "capture.cjs"),
        `const fs = require("node:fs"); let body = ""; process.stdin.on("data", chunk => body += chunk); process.stdin.on("end", () => fs.appendFileSync(${JSON.stringify(output)}, JSON.stringify({ args: process.argv.slice(2), payload: JSON.parse(body) }) + "\\n"));`
      );
      const modulePath = join(directory, "plugin", "bridge.mjs");
      await writeFile(modulePath, generated ?? "");
      const module = await import(pathToFileURL(modulePath).href);
      const server = await module.default.server({ directory: "/fallback" });
      const emit = (event: unknown) => server.event({ event });
      const created = {
        type: "session.created",
        properties: { sessionID: "ses_one", info: { directory } },
      };
      await emit(created);
      await emit(created);
      const part = {
        id: "prt_one",
        sessionID: "ses_one",
        messageID: "msg_one",
        callID: "call_one",
        type: "tool",
        tool: "read",
        state: { status: "completed", input: { filePath: "probe.txt" } },
      };
      const updated = (value: unknown) => ({
        type: "message.part.updated",
        properties: { sessionID: "ses_one", part: value },
      });
      await emit(updated({ ...part, state: { status: "running" } }));
      await emit(updated({ ...part, type: "text" }));
      await emit(updated({ ...part, tool: "" }));
      await emit(updated({ ...part, id: "" }));
      await emit(updated({}));
      await emit(undefined);
      await emit(updated({ ...part, id: "other", tool: "bash" }));
      await emit(updated({ ...part, id: "failed", state: { status: "error" } }));
      await emit(updated(part));
      await emit(updated(part));
      const idle = { type: "session.idle", properties: { sessionID: "ses_one" } };
      await emit(idle);
      await emit(idle);
      await emit({
        type: "session.status",
        properties: { sessionID: "ses_one", status: { type: "busy" } },
      });
      await emit(idle);
      await emit({ type: "unknown" });
      await vi.waitFor(
        async () => expect((await readFile(output, "utf8")).trim().split("\n")).toHaveLength(4),
        { timeout: 5000 }
      );
      await delay(100);
      const calls = (await readFile(output, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(calls).toHaveLength(4);
      expect(calls).toEqual(
        expect.arrayContaining([
          {
            args: ["--quiet"],
            payload: { hook_event_name: "SessionStart", session_id: "ses_one", cwd: directory },
          },
          {
            args: ["--quiet"],
            payload: {
              hook_event_name: "PostToolUse",
              session_id: "ses_one",
              cwd: directory,
              tool_name: "read",
              tool_input: { filePath: "probe.txt" },
            },
          },
          {
            args: ["--quiet"],
            payload: { hook_event_name: "Stop", session_id: "ses_one", cwd: directory },
          },
        ])
      );
      expect(calls.filter((call) => call.payload.hook_event_name === "Stop")).toHaveLength(2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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
    expect(generated).toContain("Kilo hook");

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

  it.each([
    { kind: "nonzero exit", cwdMissing: false, corruptEvent: false, error: "exited with code 7" },
    { kind: "spawn failure", cwdMissing: true, corruptEvent: false, error: "ENOENT" },
    { kind: "dispatch failure", cwdMissing: false, corruptEvent: true, error: "broken event" },
  ])("reports $kind without blocking the session", async ({ cwdMissing, corruptEvent, error }) => {
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
      const server = await module.default.server({
        directory: cwdMissing ? join(directory, "absent") : directory,
      });
      if (corruptEvent) {
        await server.event({
          event: {
            get properties() {
              throw new Error("broken event");
            },
          },
        });
      } else {
        await server.event({
          event: { type: "session.created", properties: { sessionID: "failed" } },
        });
      }
      await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining(error)), {
        timeout: 5000,
        interval: 20,
      });
      await delay(100);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
