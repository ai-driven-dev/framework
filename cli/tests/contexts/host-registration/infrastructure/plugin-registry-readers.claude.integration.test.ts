import { describe, expect, it } from "vitest";
import { PROJECT, registryHome } from "../testing/registry-home.js";

const { write, readerFor } = registryHome();

describe("Claude Code's own installed_plugins.json", () => {
  const PATH = ".claude/plugins/installed_plugins.json";

  it("counts a ref installed for this project, and one installed for the machine", async () => {
    await write(
      PATH,
      JSON.stringify({
        version: 1,
        plugins: {
          "aidd-telemetry@aidd-framework": [{ scope: "project", projectPath: PROJECT }],
          "aidd-dev@aidd-framework": [{ scope: "user" }],
        },
      })
    );

    const reading = await readerFor("claude").read(PROJECT);

    expect(reading.refs?.get("aidd-telemetry@aidd-framework")).toEqual({
      enabled: true,
      scope: "project",
    });
    expect(reading.refs?.get("aidd-dev@aidd-framework")).toEqual({ enabled: true, scope: "user" });
  });

  // `aidd` registers at project scope (`host-cli-adapter.ts`'s `scopeArgs`), so `projectPath` decides.
  it("does not count a ref installed only for another project", async () => {
    await write(
      PATH,
      JSON.stringify({
        version: 1,
        plugins: {
          "aidd-telemetry@aidd-framework": [{ scope: "project", projectPath: "/repo/theirs" }],
        },
      })
    );

    const reading = await readerFor("claude").read(PROJECT);

    expect(reading.refs?.has("aidd-telemetry@aidd-framework")).toBe(false);
    // A ref absent from a map that exists is `not-registered`, never the `unanswerable` an
    // unread registry produces.
    expect(reading.unreadable).toBeUndefined();
  });

  it("counts a ref carrying one entry for this project among entries for others", async () => {
    await write(
      PATH,
      JSON.stringify({
        version: 1,
        plugins: {
          "aidd-telemetry@aidd-framework": [
            { scope: "project", projectPath: "/repo/theirs" },
            { scope: "project", projectPath: PROJECT },
          ],
        },
      })
    );

    expect((await readerFor("claude").read(PROJECT)).refs?.size).toBe(1);
  });

  it("ignores an entry that names neither a scope nor a project", async () => {
    await write(
      PATH,
      JSON.stringify({
        version: 1,
        plugins: { "aidd-telemetry@aidd-framework": [{ version: "1" }] },
      })
    );

    expect((await readerFor("claude").read(PROJECT)).refs?.size).toBe(0);
  });

  it("reads an empty registry as an empty answer, not as unreadable", async () => {
    await write(PATH, JSON.stringify({ version: 1, plugins: {} }));

    const reading = await readerFor("claude").read(PROJECT);

    expect(reading.refs?.size).toBe(0);
    expect(reading.unreadable).toBeUndefined();
  });

  it("distinguishes an absent registry from an unreadable one", async () => {
    const reading = await readerFor("claude").read(PROJECT);

    expect(reading.refs).toBeUndefined();
    expect(reading.absent).toBe(true);
    expect(reading.unreadable).toBeUndefined();
  });

  /**
   * Copilot's own `~/.copilot/config.json` opens with two `//` lines, so a registry that
   * looks like JSON and turns out to be JSONC is a file a reader really does meet.
   */
  it("reads a JSONC registry as unreadable, never as carrying no plugins", async () => {
    await write(PATH, '// managed automatically\n{ "version": 1, "plugins": {} }\n');

    const reading = await readerFor("claude").read(PROJECT);

    expect(reading.refs).toBeUndefined();
    expect(reading.unreadable).toBeDefined();
  });

  it("reads a registry with no plugins object as unreadable rather than empty", async () => {
    await write(PATH, JSON.stringify({ version: 1 }));

    const reading = await readerFor("claude").read(PROJECT);

    expect(reading.refs).toBeUndefined();
  });
});

describe("Claude Code's registry, at the edges of its shape", () => {
  const PATH = ".claude/plugins/installed_plugins.json";

  it("reads a plugins field that is not an object as unreadable, naming what was expected", async () => {
    await write(PATH, JSON.stringify({ version: 1, plugins: 5 }));

    const reading = await readerFor("claude").read(PROJECT);

    expect(reading.refs).toBeUndefined();
    expect(reading.unreadable).toBe("no `plugins` object");
  });

  it("ignores a ref whose entries are not a list", async () => {
    await write(PATH, JSON.stringify({ version: 1, plugins: { "a@m": { scope: "user" } } }));

    const reading = await readerFor("claude").read(PROJECT);

    expect(reading.refs?.size).toBe(0);
  });

  it("answers user scope when one entry is user-scoped, whatever the others say", async () => {
    await write(
      PATH,
      JSON.stringify({
        version: 1,
        plugins: {
          "a@m": [{ scope: "project", projectPath: "/repo/other" }, { scope: "user" }],
        },
      })
    );

    const reading = await readerFor("claude").read(PROJECT);

    expect(reading.refs?.get("a@m")).toStrictEqual({ enabled: true, scope: "user" });
  });
});
