import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { wireHostRegistration } from "../../src/composition/host-registration.js";
import { nativeRegistrationsOf } from "../../src/composition/native-registrations.js";
import { DuplicateToolIdError, UnregisteredToolError } from "../../src/kernel/errors.js";
import { catalogOf, registeredConfig } from "../contexts/tools/testing/catalog-of.js";
import { listContractOf } from "../helpers/list-command-contract.js";

/**
 * What the host-registration derivation produces today, per native tool: the map keys, the
 * file each registry is read from, the kind of reader behind it and the kind of source a list
 * answers. Written before the derivation moves, so a path or a kind that drifts goes red here.
 */
const PROJECT = "/repo/mine";

let home: string;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "aidd-host-registry-derivation-"));
});

afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

async function write(relative: string, content: string): Promise<void> {
  const path = join(home, relative);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content, "utf8");
}

describe("the plugin registry readers", () => {
  it("are keyed by the three native tools, and by no other", () => {
    expect(
      [...wireHostRegistration(catalogOf(), home).pluginRegistries.keys()].sort()
    ).toStrictEqual(["claude", "codex", "copilot"]);
  });

  it.each([
    ["claude", join(".claude", "plugins", "installed_plugins.json")],
    ["codex", join(".codex", "config.toml")],
    ["copilot", join(".copilot", "settings.json")],
  ] as const)("read %s from its own registry file under the home", async (tool, relative) => {
    const reading = await wireHostRegistration(catalogOf(), home)
      .pluginRegistries.get(tool)
      ?.read(PROJECT);

    expect(reading).toStrictEqual({ location: join(home, relative), absent: true });
  });

  it("read codex from the home's .codex even when CODEX_HOME names another directory", async () => {
    const previous = process.env.CODEX_HOME;
    process.env.CODEX_HOME = join(home, "elsewhere");
    try {
      const reading = await wireHostRegistration(catalogOf(), home)
        .pluginRegistries.get("codex")
        ?.read(PROJECT);

      expect(reading?.location).toBe(join(home, ".codex", "config.toml"));
    } finally {
      if (previous === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previous;
    }
  });

  it("read claude as a JSON object of entries keyed by ref, each carrying its scope", async () => {
    await write(
      join(".claude", "plugins", "installed_plugins.json"),
      JSON.stringify({ plugins: { "a@m": [{ scope: "user" }] } })
    );

    const reading = await wireHostRegistration(catalogOf(), home)
      .pluginRegistries.get("claude")
      ?.read(PROJECT);

    expect(reading?.refs?.get("a@m")).toStrictEqual({ enabled: true, scope: "user" });
  });

  it("read codex as TOML plugin tables carrying an enabled flag and no scope", async () => {
    await write(join(".codex", "config.toml"), '[plugins."a@m"]\nenabled = false\n');

    const reading = await wireHostRegistration(catalogOf(), home)
      .pluginRegistries.get("codex")
      ?.read(PROJECT);

    expect(reading?.refs?.get("a@m")).toStrictEqual({ enabled: false });
  });

  it("read copilot as a JSON enabledPlugins map of booleans", async () => {
    await write(
      join(".copilot", "settings.json"),
      JSON.stringify({ enabledPlugins: { "a@m": false } })
    );

    const reading = await wireHostRegistration(catalogOf(), home)
      .pluginRegistries.get("copilot")
      ?.read(PROJECT);

    expect(reading?.refs?.get("a@m")).toStrictEqual({ enabled: false });
  });
});

describe("the marketplace registry readers", () => {
  it("are keyed by claude alone", () => {
    expect([...wireHostRegistration(catalogOf(), home).marketplaceRegistries.keys()]).toStrictEqual(
      ["claude"]
    );
  });

  it("read claude from known_marketplaces.json under the home, keyed by name", async () => {
    const reader = wireHostRegistration(catalogOf(), home).marketplaceRegistries.get("claude");
    expect(await reader?.read()).toStrictEqual({
      location: join(home, ".claude", "plugins", "known_marketplaces.json"),
      absent: true,
    });

    await write(
      join(".claude", "plugins", "known_marketplaces.json"),
      JSON.stringify({ m: { installLocation: join(home, "gone") } })
    );

    const reading = await reader?.read();
    expect(reading?.entries).toStrictEqual(new Map([["m", join(home, "gone")]]));
  });
});

describe("the native activators", () => {
  it("are keyed by the binary each activation declares", () => {
    expect([...wireHostRegistration(catalogOf(), home).hostActions.keys()].sort()).toStrictEqual([
      "claude",
      "codex",
      "copilot",
    ]);
  });
});

describe("the marketplace source list contracts", () => {
  it.each(["codex", "copilot"] as const)(
    "ask %s's own binary for its marketplace list as JSON",
    (binary) => {
      const contract = listContractOf(binary);
      expect(contract.binary).toBe(binary);
      expect(contract.args).toStrictEqual(["plugin", "marketplace", "list", "--json"]);
    }
  );

  it("read codex's list as rows carrying a marketplaceSource, an effective-list source", () => {
    const entries = listContractOf("codex").parse?.(
      JSON.stringify({
        marketplaces: [
          { name: "m", root: "/r", marketplaceSource: { sourceType: "local", source: "/s" } },
          { name: "n", root: "/r" },
        ],
      })
    );

    expect(entries).toStrictEqual(
      new Map([
        ["m", { kind: "effective-list", root: "/r", sourceType: "local", source: "/s" }],
        ["n", null],
      ])
    );
  });

  it("read copilot's list as name and source rows, only a Local source being proven", () => {
    const entries = listContractOf("copilot").parse?.(
      JSON.stringify([
        { name: "m", source: "Local: /s" },
        { name: "n", source: "GitHub: o/r" },
      ])
    );

    expect(entries).toStrictEqual(
      new Map([
        ["m", { kind: "effective-list", root: "/s", sourceType: "local", source: "/s" }],
        ["n", null],
      ])
    );
  });

  it("word each refusal after its own tool", () => {
    expect(listContractOf("codex").unavailableMessage).toBe(
      "Codex marketplace list --json unavailable; inspect the host CLI and retry"
    );
    expect(listContractOf("copilot").unavailableMessage).toBe(
      "Copilot CLI marketplace list --json unavailable; upgrade to a supported binary and retry"
    );
    expect(listContractOf("copilot").unverifiedMessage).toBe(
      "Copilot CLI marketplace list --json output shape is not verified; upgrade to a supported binary and reconcile manually"
    );
  });

  it("name the tool in each parse refusal, so a reader taken from a declaration keeps the wording", () => {
    const codex = listContractOf("codex").parse;
    const copilot = listContractOf("copilot").parse;

    expect(() => codex?.("{}")).toThrow("unexpected Codex JSON shape");
    expect(() => codex?.('{"marketplaces":[{"name":""}]}')).toThrow(
      "ambiguous Codex marketplace JSON row"
    );
    expect(() =>
      codex?.('{"marketplaces":[{"name":"m","root":"/r","marketplaceSource":{}}]}')
    ).toThrow("unproven Codex marketplace source shape");
    expect(() => copilot?.("{}")).toThrow("unexpected Copilot JSON shape");
    expect(() => copilot?.("[1]")).toThrow("ambiguous Copilot JSON row");
    expect(() => copilot?.('[{"name":"","source":""}]')).toThrow(
      "ambiguous Copilot marketplace JSON row"
    );
  });
});

describe("the native registrations the catalog is asked about", () => {
  it("leave a tool the catalog does not register without a driver", () => {
    const withoutClaude = catalogOf(
      catalogOf()
        .sortedById()
        .filter((profile) => profile.toolId !== "claude")
        .map((profile) => registeredConfig(profile.toolId))
    );

    const wired = wireHostRegistration(withoutClaude, home);

    expect([...wired.hostActions.keys()].sort()).toStrictEqual(["codex", "copilot"]);
    expect(wired.marketplaceRegistries.size).toBe(0);
  });

  it("refuse a tool the catalog calls native when no registration backs it", () => {
    expect(() => wireHostRegistration(catalogOf(), home, new Map())).toThrow(UnregisteredToolError);
  });

  it("refuse two profiles declaring the same id", () => {
    const claude = registeredConfig("claude");

    expect(() => nativeRegistrationsOf([claude, claude])).toThrow(DuplicateToolIdError);
  });
});
