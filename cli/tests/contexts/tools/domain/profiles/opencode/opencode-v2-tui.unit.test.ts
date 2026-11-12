import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it, vi } from "vitest";

it("shows the hook output for two sessions in the native TUI", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aidd-opencode-tui-"));
  try {
    const plugin = join(directory, ".opencode", "plugins", "aidd-maintenance-tui");
    const hooks = join(directory, ".opencode", "hooks", "aidd-maintenance");
    await mkdir(plugin, { recursive: true });
    await mkdir(hooks, { recursive: true });
    await copyFile(
      resolve("../plugins/aidd-maintenance/hooks/opencode-tui.js"),
      join(plugin, "tui.mjs")
    );
    await writeFile(
      join(hooks, "session-start.cjs"),
      'process.stdin.resume(); process.stdin.on("end", () => console.log(JSON.stringify({ systemMessage: "Update available" })));'
    );
    const module = await import(pathToFileURL(join(plugin, "tui.mjs")).href);
    const toast = vi.fn();
    let listener: (event: unknown) => Promise<void> = async () => {};
    const unsubscribe = vi.fn();
    const cleanup = module.default.setup({
      data: {
        on: (_: string, cb: typeof listener) => {
          listener = cb;
          return unsubscribe;
        },
      },
      ui: { toast: { show: toast } },
    });
    for (const sessionID of ["one", "two"]) {
      await listener({ data: { sessionID, location: { directory } } });
    }
    expect(toast).toHaveBeenCalledTimes(2);
    expect(toast).toHaveBeenCalledWith({ message: "Update available", variant: "info" });
    cleanup();
    expect(unsubscribe).toHaveBeenCalledOnce();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("shows a startup message that takes longer than five seconds", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aidd-opencode-timeout-"));
  try {
    const plugin = join(directory, ".opencode", "plugins", "aidd-maintenance-tui");
    const hooks = join(directory, ".opencode", "hooks", "aidd-maintenance");
    await mkdir(plugin, { recursive: true });
    await mkdir(hooks, { recursive: true });
    await copyFile(
      resolve("../plugins/aidd-maintenance/hooks/opencode-tui.js"),
      join(plugin, "tui.mjs")
    );
    await writeFile(
      join(hooks, "session-start.cjs"),
      'process.stdin.resume(); process.stdin.on("end", () => setTimeout(() => console.log(JSON.stringify({ systemMessage: "Slow network" })), 5100));'
    );
    const module = await import(pathToFileURL(join(plugin, "tui.mjs")).href);
    const toast = vi.fn();
    let listener: (event: unknown) => Promise<void> = async () => {};
    module.default.setup({
      data: {
        on: (_: string, cb: typeof listener) => {
          listener = cb;
          return () => {};
        },
      },
      ui: { toast: { show: toast } },
    });
    await listener({ data: { sessionID: "one", location: { directory } } });
    expect(toast).toHaveBeenCalledWith({ message: "Slow network", variant: "info" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);

it("shows the notice on opening the TUI and does not repeat it for its first session", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aidd-opencode-open-"));
  try {
    const plugin = join(directory, ".opencode", "plugins", "aidd-maintenance-tui");
    const hooks = join(directory, ".opencode", "hooks", "aidd-maintenance");
    await mkdir(plugin, { recursive: true });
    await mkdir(hooks, { recursive: true });
    await copyFile(
      resolve("../plugins/aidd-maintenance/hooks/opencode-tui.js"),
      join(plugin, "tui.mjs")
    );
    await writeFile(
      join(hooks, "session-start.cjs"),
      'process.stdin.resume(); process.stdin.on("end", () => console.log(JSON.stringify({ systemMessage: "Update available" })));'
    );
    const module = await import(pathToFileURL(join(plugin, "tui.mjs")).href);
    const toast = vi.fn();
    let listener: (event: unknown) => Promise<void> = async () => {};
    const cleanup = module.default.setup({
      location: { directory },
      data: {
        on: (_: string, cb: typeof listener) => {
          listener = cb;
          return () => {};
        },
      },
      ui: { toast: { show: toast } },
    });
    await vi.waitFor(() => expect(toast).toHaveBeenCalledOnce());
    const otherDirectory = join(directory, "another-project");
    await mkdir(otherDirectory);
    await listener({ data: { sessionID: "other", location: { directory: otherDirectory } } });
    expect(toast).toHaveBeenCalledTimes(2);
    await listener({ data: { sessionID: "one", location: { directory } } });
    expect(toast).toHaveBeenCalledTimes(2);
    await listener({ data: { sessionID: "two", location: { directory } } });
    expect(toast).toHaveBeenCalledTimes(3);
    cleanup();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
