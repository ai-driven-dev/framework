import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { HostRecording } from "../../../../scripts/host-recording.mjs";
import {
  parseMarketplacesWithSource,
  parseNameSourceRows,
} from "../../../../src/contexts/host-registration/infrastructure/marketplace/marketplace-list-parsers.js";
import { InstallLocationsByNameReader } from "../../../../src/contexts/host-registration/infrastructure/marketplace/marketplace-registry-reader.js";
import { EnabledPluginsMapReader } from "../../../../src/contexts/host-registration/infrastructure/plugin-registry/enabled-plugins-map-reader.js";
import { TomlPluginTablesReader } from "../../../../src/contexts/host-registration/infrastructure/plugin-registry/toml-plugin-tables-reader.js";
import { newestRecording } from "../testing/recorded-host.builder.js";
import { scratchDirectory } from "../testing/scratch-directory.builder.js";

const disposers: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(disposers.splice(0).map((dispose) => dispose()));
});

function step(recording: HostRecording, id: string) {
  const found = recording.steps.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no recorded step '${id}'`);
  return found;
}

/** A recorded registry file, written back where the host kept it. Returns its path. */
async function registryFileOf(recording: HostRecording, id: string, relativePath: string) {
  const scratch = await scratchDirectory();
  disposers.push(scratch.dispose);
  const path = join(scratch.dir, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, step(recording, id).files[relativePath] ?? "");
  return path;
}

describe("the readers and list parsers over what each host really wrote and printed", () => {
  const claude = newestRecording("claude");
  const codex = newestRecording("codex");
  const copilot = newestRecording("copilot");

  it(`claude ${claude.version}: reads the marketplace registry it wrote`, async () => {
    const path = await registryFileOf(
      claude,
      "marketplace-list",
      ".claude/plugins/known_marketplaces.json"
    );

    const reading = await new InstallLocationsByNameReader(path).read();

    expect(reading.entries).toEqual(new Map([["mk-one", "<markets>/b"]]));
  });

  it(`codex ${codex.version}: reads the plugin table it wrote and parses its marketplace list`, async () => {
    const path = await registryFileOf(codex, "install", ".codex/config.toml");

    const reading = await new TomlPluginTablesReader(path).read("/unused");

    expect(reading.refs).toEqual(new Map([["p@cx-one", { enabled: true }]]));
    expect(parseMarketplacesWithSource("codex", step(codex, "marketplace-list").stdout)).toEqual(
      new Map([
        [
          "cx-one",
          {
            kind: "effective-list",
            root: "<markets>/a",
            sourceType: "local",
            source: "<markets>/a",
          },
        ],
      ])
    );
  });

  it(`copilot ${copilot.version}: reads the enabled plugin it wrote and parses its marketplace list`, async () => {
    const path = await registryFileOf(copilot, "install", ".copilot/settings.json");

    const reading = await new EnabledPluginsMapReader(path).read("/unused");

    expect(reading.refs).toEqual(new Map([["p@mk-one", { enabled: true }]]));
    expect(parseNameSourceRows("copilot", step(copilot, "marketplace-list").stdout)).toEqual(
      new Map([
        [
          "mk-one",
          {
            kind: "effective-list",
            root: "<markets>/a",
            sourceType: "local",
            source: "<markets>/a",
          },
        ],
        ["awesome-copilot", null],
      ])
    );
  });
});
