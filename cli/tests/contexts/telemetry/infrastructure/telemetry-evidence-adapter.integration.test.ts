import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// Every tool, because `enabledPluginsCandidates` walks the whole registry: a partial
// registration throws before a single assertion is reached.
import "../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import "../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { TelemetryEvidenceAdapter } from "../../../../src/contexts/telemetry/infrastructure/telemetry-evidence-adapter.js";

/**
 * `HOME` is a throwaway directory for every case: `readRecorderDeclaration` checks the
 * user-scope Claude settings file, which a developer may have the plugin enabled in.
 */
const created: string[] = [];
const savedHome = process.env.HOME;

afterEach(() => {
  if (savedHome === undefined) delete process.env.HOME;
  else process.env.HOME = savedHome;
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
  created.length = 0;
});

function project(): string {
  const root = mkdtempSync(join(tmpdir(), "aidd-evidence-"));
  created.push(root);
  process.env.HOME = join(root, "home");
  mkdirSync(process.env.HOME, { recursive: true });
  return join(root, "project");
}

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function writeJson(path: string, value: unknown): void {
  write(path, JSON.stringify(value, null, 2));
}

const adapter = () => new TelemetryEvidenceAdapter();

describe("whether measurement is allowed here", () => {
  it("reads a project that turned it on", async () => {
    const root = project();
    writeJson(join(root, ".aidd", "config.json"), { telemetry: { enabled: true } });

    expect(await adapter().isTelemetryEnabled(root, {})).toBe(true);
  });

  it("reads a project that never decided as off, without a file to read", async () => {
    expect(await adapter().isTelemetryEnabled(project(), {})).toBe(false);
  });

  // The person's own refusal outranks the project's file — the rule `telemetry-switch.ts`
  // states and `repo.cjs` mirrors for the hook, checked here on the route the CLI takes.
  it("lets a person refuse in their own environment, over a project that turned it on", async () => {
    const root = project();
    writeJson(join(root, ".aidd", "config.json"), { telemetry: { enabled: true } });

    expect(await adapter().isTelemetryEnabled(root, { AIDD_TELEMETRY: "0" })).toBe(false);
  });

  it("treats a switch file that is not JSON as off, never as on", async () => {
    const root = project();
    write(join(root, ".aidd", "config.json"), "{ telemetry: enabled, }");

    expect(await adapter().isTelemetryEnabled(root, {})).toBe(false);
  });
});

describe("what the switch setup reports, beside the answer itself", () => {
  it("names the file it read, and reads a damaged one as unreadable rather than off", async () => {
    const root = project();
    write(join(root, ".aidd", "config.json"), "not json at all");

    const setup = await adapter().readSwitchSetup(root);

    expect(setup.path).toBe(join(root, ".aidd", "config.json"));
    expect(setup.readable).toBe(false);
    expect(setup.enabled).toBe(false);
  });

  // An absent file is a project that never chose, which is a different fact from one whose
  // file cannot be read — and only the second is something wrong.
  it("reads an absent file as readable and undecided", async () => {
    const setup = await adapter().readSwitchSetup(project());

    expect(setup.readable).toBe(true);
    expect(setup.enabled).toBe(false);
  });

  it("reads a project that turned it on as readable and enabled, naming the file", async () => {
    const root = project();
    writeJson(join(root, ".aidd", "config.json"), { telemetry: { enabled: true } });

    expect(await adapter().readSwitchSetup(root)).toStrictEqual({
      path: join(root, ".aidd", "config.json"),
      enabled: true,
      readable: true,
    });
  });

  it("reads a switch path that is a directory as unreadable, not as absent", async () => {
    const root = project();
    mkdirSync(join(root, ".aidd", "config.json"), { recursive: true });

    expect(await adapter().readSwitchSetup(root)).toStrictEqual({
      path: join(root, ".aidd", "config.json"),
      enabled: false,
      readable: false,
    });
  });
});

describe("where the recorder declaration is looked for", () => {
  it("checks the manifest, both enabledPlugins files, the three Claude hook scopes and Cursor's hooks file, once each", async () => {
    const root = project();
    const home = process.env.HOME ?? "";

    const declaration = await adapter().readRecorderDeclaration(root);

    expect(declaration).toStrictEqual({
      declared: false,
      declaredAt: [],
      locationsChecked: [
        join(root, ".aidd", "manifest.json"),
        join(root, ".claude", "settings.json"),
        join(root, ".github", "copilot", "settings.json"),
        join(root, ".claude", "settings.local.json"),
        join(home, ".claude", "settings.json"),
        join(root, ".cursor", "hooks.json"),
      ],
      unreadable: [],
    });
  });
});

describe("what the manifest says about the recorder", () => {
  async function declarationFor(manifest: unknown) {
    const root = project();
    writeJson(join(root, ".aidd", "manifest.json"), manifest);
    const declaration = await adapter().readRecorderDeclaration(root);
    return { declaration, manifestFile: join(root, ".aidd", "manifest.json") };
  }

  it("names the manifest alone as the declaring location", async () => {
    const { declaration, manifestFile } = await declarationFor({
      tools: { claude: { plugins: [{ name: "aidd-telemetry", version: "1.0.0" }] } },
    });

    expect(declaration.declaredAt).toStrictEqual([manifestFile]);
    expect(declaration.unreadable).toStrictEqual([]);
  });

  it("finds the recorder under a second tool when the first declares other plugins only", async () => {
    const { declaration, manifestFile } = await declarationFor({
      tools: {
        codex: { plugins: [{ name: "aidd-dev", version: "1.0.0" }] },
        claude: {
          plugins: [
            { name: "aidd-dev", version: "1.0.0" },
            { name: "aidd-telemetry", version: "1.0.0" },
          ],
        },
      },
    });

    expect(declaration.declaredAt).toStrictEqual([manifestFile]);
  });

  it("reads a manifest declaring only other plugins as not declaring the recorder", async () => {
    const { declaration } = await declarationFor({
      tools: { claude: { plugins: [{ name: "aidd-dev", version: "1.0.0" }] } },
    });

    expect(declaration.declared).toBe(false);
    expect(declaration.unreadable).toStrictEqual([]);
  });

  it.each([
    ["a JSON null", null],
    ["no tools key", {}],
    ["a tool entry that is not an object", { tools: { claude: "installed" } }],
    ["a plugins value that is not a list", { tools: { claude: { plugins: "aidd-telemetry" } } }],
    [
      "a plugin entry that is not an object",
      { tools: { claude: { plugins: ["aidd-telemetry"] } } },
    ],
  ])("reads a manifest holding %s as not declaring, and not as unreadable", async (_, manifest) => {
    const { declaration } = await declarationFor(manifest);

    expect(declaration.declared).toBe(false);
    expect(declaration.declaredAt).toStrictEqual([]);
    expect(declaration.unreadable).toStrictEqual([]);
  });

  it("names a damaged manifest as the one unreadable location", async () => {
    const root = project();
    write(join(root, ".aidd", "manifest.json"), "{ tools: ");

    const declaration = await adapter().readRecorderDeclaration(root);

    expect(declaration.unreadable).toStrictEqual([join(root, ".aidd", "manifest.json")]);
    expect(declaration.declaredAt).toStrictEqual([]);
  });

  it("names a manifest path that is a directory as unreadable, never as absent", async () => {
    const root = project();
    mkdirSync(join(root, ".aidd", "manifest.json"), { recursive: true });

    const declaration = await adapter().readRecorderDeclaration(root);

    expect(declaration.unreadable).toStrictEqual([join(root, ".aidd", "manifest.json")]);
  });
});

describe("what a tool's enabledPlugins says about the recorder", () => {
  it("names Copilot's settings file alone when only it enables the recorder", async () => {
    const root = project();
    writeJson(join(root, ".github", "copilot", "settings.json"), {
      enabledPlugins: { "aidd-telemetry@aidd-framework": true },
    });

    const declaration = await adapter().readRecorderDeclaration(root);

    expect(declaration.declaredAt).toStrictEqual([
      join(root, ".github", "copilot", "settings.json"),
    ]);
    expect(declaration.unreadable).toStrictEqual([]);
  });

  it("finds the recorder among other enabled plugins", async () => {
    const root = project();
    writeJson(join(root, ".claude", "settings.json"), {
      enabledPlugins: { "aidd-dev@aidd-framework": true, "aidd-telemetry@aidd-framework": true },
    });

    expect((await adapter().readRecorderDeclaration(root)).declaredAt).toStrictEqual([
      join(root, ".claude", "settings.json"),
    ]);
  });

  it("reads a key enabling some other plugin as not declaring the recorder", async () => {
    const root = project();
    writeJson(join(root, ".claude", "settings.json"), {
      enabledPlugins: { "aidd-dev@aidd-framework": true },
    });

    const declaration = await adapter().readRecorderDeclaration(root);

    expect(declaration.declared).toBe(false);
    expect(declaration.unreadable).toStrictEqual([]);
  });

  it.each([
    ["a JSON null", null],
    ["no enabledPlugins key", {}],
  ])(
    "reads a settings file holding %s as not declaring, and not as unreadable",
    async (_, settings) => {
      const root = project();
      writeJson(join(root, ".claude", "settings.json"), settings);

      const declaration = await adapter().readRecorderDeclaration(root);

      expect(declaration.declaredAt).toStrictEqual([]);
      expect(declaration.unreadable).toStrictEqual([]);
    }
  );

  it("names a damaged settings file as the one unreadable location", async () => {
    const root = project();
    write(join(root, ".github", "copilot", "settings.json"), "{ enabledPlugins: ");

    const declaration = await adapter().readRecorderDeclaration(root);

    expect(declaration.unreadable).toStrictEqual([
      join(root, ".github", "copilot", "settings.json"),
    ]);
    expect(declaration.declaredAt).toStrictEqual([]);
  });
});

describe("what a hooks block says about the recorder", () => {
  it("names the user-scope Claude settings file when its hooks block invokes the entry point", async () => {
    const root = project();
    const homeSettings = join(process.env.HOME ?? "", ".claude", "settings.json");
    writeJson(homeSettings, {
      hooks: {
        SessionStart: [
          {
            hooks: [{ type: "command", command: "node .claude/hooks/aidd-telemetry/journal.cjs" }],
          },
        ],
      },
    });

    const declaration = await adapter().readRecorderDeclaration(root);

    expect(declaration.declaredAt).toStrictEqual([homeSettings]);
    expect(declaration.unreadable).toStrictEqual([]);
  });

  it("names Cursor's hooks file when it invokes the entry point from the recorder's own script dir", async () => {
    const root = project();
    writeJson(join(root, ".cursor", "hooks.json"), {
      version: 1,
      hooks: {
        sessionStart: [
          { command: "node ./other/journal.cjs" },
          { command: "node .cursor/hooks/aidd-telemetry/journal.cjs" },
        ],
      },
    });

    const declaration = await adapter().readRecorderDeclaration(root);

    expect(declaration.declaredAt).toStrictEqual([join(root, ".cursor", "hooks.json")]);
  });

  it("refuses the recorder's own script name under a directory that is not its hooks dir", async () => {
    const root = project();
    writeJson(join(root, ".cursor", "hooks.json"), {
      version: 1,
      hooks: { sessionStart: [{ command: "node ./vendor/aidd-telemetry/journal.cjs" }] },
    });

    expect((await adapter().readRecorderDeclaration(root)).declared).toBe(false);
  });

  it("refuses another script under the plugin token, however its hooks dir is named", async () => {
    const root = project();
    writeJson(join(root, ".claude", "settings.local.json"), {
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: "command",
                // biome-ignore lint/suspicious/noTemplateCurlyInString: Claude Code resolves this placeholder, the settings file carries it verbatim
                command: "node ${CLAUDE_PLUGIN_ROOT}/hooks/other.cjs",
              },
            ],
          },
        ],
      },
    });

    expect((await adapter().readRecorderDeclaration(root)).declared).toBe(false);
  });

  it("names a damaged hooks file as the one unreadable location", async () => {
    const root = project();
    write(join(root, ".cursor", "hooks.json"), "{ version: 1, ");

    const declaration = await adapter().readRecorderDeclaration(root);

    expect(declaration.unreadable).toStrictEqual([join(root, ".cursor", "hooks.json")]);
    expect(declaration.declaredAt).toStrictEqual([]);
  });
});

describe("whether anything is declared to do the recording", () => {
  it("finds the recorder in the manifest a plugin install writes", async () => {
    const root = project();
    writeJson(join(root, ".aidd", "manifest.json"), {
      tools: { claude: { plugins: [{ name: "aidd-telemetry", version: "1.0.0" }] } },
    });

    const declaration = await adapter().readRecorderDeclaration(root);

    expect(declaration.declared).toBe(true);
    expect(declaration.declaredAt).toContain(join(root, ".aidd", "manifest.json"));
  });

  // The marketplace half of the key is this project's own choice, so the match is on the
  // plugin's name and the `@` that follows it, never the whole key.
  it("finds it in enabledPlugins whatever marketplace the key names", async () => {
    const root = project();
    writeJson(join(root, ".claude", "settings.json"), {
      enabledPlugins: { "aidd-telemetry@some-marketplace": true },
    });

    expect((await adapter().readRecorderDeclaration(root)).declared).toBe(true);
  });

  it("finds it in a Claude hooks block that names the entry point by its plugin token", async () => {
    const root = project();
    writeJson(join(root, ".claude", "settings.local.json"), {
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: "command",
                // biome-ignore lint/suspicious/noTemplateCurlyInString: Claude Code resolves this placeholder, the settings file carries it verbatim
                command: "node ${CLAUDE_PLUGIN_ROOT}/hooks/journal.cjs session-start",
              },
            ],
          },
        ],
      },
    });

    expect((await adapter().readRecorderDeclaration(root)).declared).toBe(true);
  });

  // A bare `journal.cjs` is any plugin's journal, not this one's — matching it would read
  // somebody else's hook as this recorder being installed.
  it("refuses a hooks block naming a bare journal.cjs belonging to some other plugin", async () => {
    const root = project();
    writeJson(join(root, ".cursor", "hooks.json"), {
      version: 1,
      hooks: { SessionStart: [{ command: "node ./somewhere-else/journal.cjs" }] },
    });

    expect((await adapter().readRecorderDeclaration(root)).declared).toBe(false);
  });

  it("reports nothing declared, and still names every location it looked in", async () => {
    const declaration = await adapter().readRecorderDeclaration(project());

    expect(declaration.declared).toBe(false);
    expect(declaration.declaredAt).toEqual([]);
    expect(declaration.locationsChecked.length).toBeGreaterThan(3);
    expect(new Set(declaration.locationsChecked).size).toBe(declaration.locationsChecked.length);
  });

  // A file that is there and damaged is not a file that says "not declared": the first is
  // something to fix, the second is an ordinary state.
  it("names a damaged location as unreadable rather than counting it as undeclared", async () => {
    const root = project();
    write(join(root, ".aidd", "manifest.json"), "{ tools: ");

    const declaration = await adapter().readRecorderDeclaration(root);

    expect(declaration.unreadable).toContain(join(root, ".aidd", "manifest.json"));
    expect(declaration.declared).toBe(false);
  });
});

describe("a payload that matched no known host", () => {
  it("reads the moment one arrived", async () => {
    const root = project();
    write(
      join(root, "aidd_docs", "runs", "_unrecognised.jsonl"),
      `${JSON.stringify({ type: "unrecognised_payload", at: "2026-03-02T08:00:00Z" })}\n`
    );

    expect(await adapter().readUnrecognisedPayload(root)).toEqual({ at: "2026-03-02T08:00:00Z" });
  });

  it("answers nothing when the file is absent", async () => {
    expect(await adapter().readUnrecognisedPayload(project())).toBeNull();
  });

  it("answers nothing for a line that is not one of these records", async () => {
    const root = project();
    write(join(root, "aidd_docs", "runs", "_unrecognised.jsonl"), '{"type":"something-else"}\n');

    expect(await adapter().readUnrecognisedPayload(root)).toBeNull();
  });

  it("answers nothing for another record kind even when it carries a moment", async () => {
    const root = project();
    write(
      join(root, "aidd_docs", "runs", "_unrecognised.jsonl"),
      `${JSON.stringify({ type: "something-else", at: "2026-03-02T08:00:00Z" })}\n`
    );

    expect(await adapter().readUnrecognisedPayload(root)).toBeNull();
  });

  it("answers nothing when the moment is not a string", async () => {
    const root = project();
    write(
      join(root, "aidd_docs", "runs", "_unrecognised.jsonl"),
      `${JSON.stringify({ type: "unrecognised_payload", at: 1772438400 })}\n`
    );

    expect(await adapter().readUnrecognisedPayload(root)).toBeNull();
  });

  it("skips blank lines before the first record", async () => {
    const root = project();
    write(
      join(root, "aidd_docs", "runs", "_unrecognised.jsonl"),
      `\n   \n${JSON.stringify({ type: "unrecognised_payload", at: "2026-03-02T08:00:00Z" })}\n`
    );

    expect(await adapter().readUnrecognisedPayload(root)).toStrictEqual({
      at: "2026-03-02T08:00:00Z",
    });
  });

  // The hook writing this file anchors at the repository root, never at the directory a
  // session started from, so a reader must walk up rather than join onto `projectRoot`.
  it("finds the file from a subdirectory of the repository, not only from its root", async () => {
    const root = project();
    mkdirSync(join(root, ".git"), { recursive: true });
    write(
      join(root, "aidd_docs", "runs", "_unrecognised.jsonl"),
      `${JSON.stringify({ type: "unrecognised_payload", at: "2026-03-02T08:00:00Z" })}\n`
    );
    const subdirectory = join(root, "packages", "app");
    mkdirSync(subdirectory, { recursive: true });

    expect(await adapter().readUnrecognisedPayload(subdirectory)).toEqual({
      at: "2026-03-02T08:00:00Z",
    });
  });
});

describe("an export a deleted command left behind in a tool's own settings", () => {
  it("names the file and the keys still in it", async () => {
    const root = project();
    writeJson(join(root, ".claude", "settings.json"), {
      env: {
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://example.invalid",
        CLAUDE_CODE_ENABLE_TELEMETRY: "1",
      },
    });

    const leftovers = await adapter().findLeftoverExportConfig(root);

    expect(leftovers).toHaveLength(1);
    expect(leftovers[0]?.path).toBe(join(root, ".claude", "settings.json"));
    expect(leftovers[0]?.keys.length).toBeGreaterThan(0);
  });

  it("finds none in a project whose settings carry no export at all", async () => {
    const root = project();
    writeJson(join(root, ".claude", "settings.json"), { env: {} });

    expect(await adapter().findLeftoverExportConfig(root)).toEqual([]);
  });
});
