import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it, vi } from "vitest";
import { generateKiloHooksBridge } from "../../../../../../src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.js";

it("shows the startup message once for each session", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aidd-kilo-message-"));
  try {
    await mkdir(join(directory, "hooks", "probe"), { recursive: true });
    await mkdir(join(directory, "plugin"));
    await writeFile(
      join(directory, "hooks", "probe", "start.cjs"),
      'process.stdin.resume(); process.stdin.on("end", () => console.log(JSON.stringify({ systemMessage: "Update available" })));'
    );
    const root = "$" + "{CLAUDE_PLUGIN_ROOT}";
    const source = generateKiloHooksBridge(
      JSON.stringify({
        hooks: {
          SessionStart: [
            { matcher: "startup", hooks: [{ command: `node "${root}/hooks/start.cjs"` }] },
          ],
        },
      }),
      "probe"
    );
    const path = join(directory, "plugin", "bridge.mjs");
    await writeFile(path, source ?? "");
    const module = await import(pathToFileURL(path).href);
    const showToast = vi.fn(async () => {});
    const server = await module.default.server({ directory, client: { tui: { showToast } } });
    for (const id of ["one", "one", "two"]) {
      await server.event({ event: { type: "session.created", properties: { sessionID: id } } });
    }
    expect(showToast).toHaveBeenCalledTimes(2);
    expect(showToast).toHaveBeenCalledWith({
      body: { message: "Update available", variant: "info" },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("leaves the maintenance startup notice to the TUI", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aidd-kilo-maintenance-"));
  try {
    const root = "$" + "{CLAUDE_PLUGIN_ROOT}";
    const source = generateKiloHooksBridge(
      JSON.stringify({
        hooks: {
          SessionStart: [
            { matcher: "startup", hooks: [{ command: `node "${root}/hooks/session-start.cjs"` }] },
          ],
        },
      }),
      "aidd-maintenance"
    );
    const path = join(directory, "bridge.mjs");
    await writeFile(path, source ?? "");
    const module = await import(pathToFileURL(path).href);
    expect(
      module.default.server.sessionStartCallsFor({ type: "session.created" }, directory)
    ).toEqual([]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
