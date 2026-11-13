import { describe, expect, it } from "vitest";
import { PROJECT, registryHome } from "../testing/registry-home.js";

const { write, readerFor } = registryHome();

/**
 * Every shape below was driven live against `GitHub Copilot CLI 1.0.82`; the fixtures carry
 * that file's shape, never its contents.
 */
describe("Copilot's own settings.json", () => {
  const PATH = ".copilot/settings.json";

  it("reads the refs its enabledPlugins carries", async () => {
    await write(
      PATH,
      JSON.stringify({
        extraKnownMarketplaces: { "aidd-framework": { source: { source: "directory" } } },
        enabledPlugins: { "aidd-telemetry@aidd-framework": true },
      })
    );

    expect(
      (await readerFor("copilot").read(PROJECT)).refs?.get("aidd-telemetry@aidd-framework")
    ).toEqual({ enabled: true });
  });

  // Measured: `copilot plugin uninstall` writes `false` and keeps the key, so
  // registered-but-off is an ordinary state on this host.
  it("reads an uninstalled plugin as registered and disabled, not as absent", async () => {
    await write(
      PATH,
      JSON.stringify({ enabledPlugins: { "aidd-telemetry@aidd-framework": false } })
    );

    expect(
      (await readerFor("copilot").read(PROJECT)).refs?.get("aidd-telemetry@aidd-framework")
    ).toEqual({ enabled: false });
  });

  // A settings file exists from the first `copilot` run and gains `enabledPlugins` only on
  // the first install, so its absence is "carries none" — a real answer, not a failed read.
  it("reads a settings file with no enabledPlugins as carrying none", async () => {
    await write(PATH, JSON.stringify({ extraKnownMarketplaces: {} }));

    const reading = await readerFor("copilot").read(PROJECT);

    expect(reading.refs?.size).toBe(0);
    expect(reading.unreadable).toBeUndefined();
  });

  it("distinguishes an absent settings file from an unreadable one", async () => {
    const reading = await readerFor("copilot").read(PROJECT);
    expect(reading.refs).toBeUndefined();
    expect(reading.absent).toBe(true);
    expect(reading.unreadable).toBeUndefined();
  });
});

describe("Copilot's settings.json, at the edges of its shape", () => {
  it("reads malformed JSON as unreadable, never as carrying no plugins", async () => {
    await write(".copilot/settings.json", "// comment\n{ not json");

    const reading = await readerFor("copilot").read(PROJECT);

    expect(reading.refs).toBeUndefined();
    expect(reading.unreadable).toBeDefined();
  });
});
