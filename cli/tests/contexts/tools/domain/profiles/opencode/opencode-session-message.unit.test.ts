import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it, vi } from "vitest";
import { generateOpencodeHooksBridge } from "../../../../../../src/contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.js";

it("shows a startup message once per session", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aidd-opencode-message-"));
  try {
    await mkdir(join(directory, "hooks", "probe"), { recursive: true });
    await mkdir(join(directory, "plugins"));
    await writeFile(
      join(directory, "hooks", "opencode-events.js"),
      "export async function setupOpencodeEvents(ctx, factory) { return factory(ctx); }\n"
    );
    await writeFile(join(directory, "package.json"), '{"type":"module"}');
    await writeFile(
      join(directory, "hooks", "probe", "start.cjs"),
      'process.stdin.resume(); process.stdin.on("end", () => console.log(JSON.stringify({ systemMessage: "Update available" })));'
    );
    const root = "$" + "{CLAUDE_PLUGIN_ROOT}";
    const source = generateOpencodeHooksBridge(
      JSON.stringify({
        hooks: {
          SessionStart: [
            { matcher: "startup", hooks: [{ command: `node "${root}/hooks/start.cjs"` }] },
          ],
        },
      }),
      "probe"
    );
    const path = join(directory, "plugins", "bridge.mjs");
    await writeFile(path, source ?? "");
    const module = await import(pathToFileURL(path).href);
    const showToast = vi.fn(async () => {});
    const server = await module.default.server({ directory, client: { tui: { showToast } } });
    expect(showToast).not.toHaveBeenCalled();
    for (const id of ["one", "one", "two"]) {
      await server.event({
        event: { type: "session.created", properties: { info: { id, directory } } },
      });
    }
    expect(showToast).toHaveBeenCalledTimes(2);
    expect(showToast).toHaveBeenCalledWith({
      body: { message: "Update available", variant: "info" },
    });
    await mkdir(join(directory, "plugins", "probe-tui"));
    await writeFile(join(directory, "plugins", "probe-tui", "tui.js"), "");
    const v2 = await module.default.setup({ directory, client: { tui: { showToast } } });
    await v2.event({ event: { type: "session.created", properties: { info: { id: "three" } } } });
    expect(showToast).toHaveBeenCalledTimes(2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
