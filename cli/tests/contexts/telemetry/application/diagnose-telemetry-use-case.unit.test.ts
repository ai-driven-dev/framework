import { describe, expect, it } from "vitest";
import "../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import "../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import "../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import { Manifest } from "../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../../../src/contexts/framework/domain/ports/manifest-repository.js";
import { DiagnoseTelemetryUseCase } from "../../../../src/contexts/telemetry/application/diagnose-telemetry-use-case.js";
import type { HookTrustReader } from "../../../../src/contexts/telemetry/domain/ports/hook-trust-reader.js";
import type { RunJournal } from "../../../../src/contexts/telemetry/domain/ports/run-journal-reader.js";
import type {
  LocalCostCandidateRecord,
  LocalCostReadResult,
  SessionCostReader,
} from "../../../../src/contexts/telemetry/domain/ports/session-cost-reader.js";
import type { VersionControl } from "../../../../src/contexts/telemetry/domain/ports/version-control.js";
import type { TelemetryCodexHookTrust } from "../../../../src/contexts/telemetry/domain/telemetry-claim.js";
import type { HostPluginRegistryReader } from "../../../../src/contexts/tools/domain/ports/host-plugin-registry-reader.js";
import type { AiToolId } from "../../../../src/kernel/tool.js";
import { installedPluginsFromManifest } from "../../../../src/runtime/wiring/installed-plugins-from-manifest.js";
import { FakeCurrentVersion } from "../../../helpers/ports/fake-current-version.js";
import { InMemoryManifestRepository } from "../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryPersonIdentityStore } from "../../../helpers/ports/in-memory-person-identity-store.js";
import { InMemoryRunJournalReader } from "../../../helpers/ports/in-memory-run-journal-reader.js";
import { InMemoryTelemetrySink } from "../../../helpers/ports/in-memory-telemetry-sink.js";
import { StubTelemetryEvidenceReader as StubEvidenceReader } from "../../../helpers/ports/stub-telemetry-evidence-reader.js";

class StubHookTrustReader implements HookTrustReader {
  trust: TelemetryCodexHookTrust = {
    readable: true,
    trusted: true,
    configPath: "/home/.codex/config.toml",
  };

  reads = 0;

  async read(): Promise<TelemetryCodexHookTrust> {
    this.reads += 1;
    return this.trust;
  }
}

function versionControl(isRepository: boolean): VersionControl {
  return {
    installCommitMessageDelegate: async () => ({ lineAdded: false }),
    removeCommitMessageDelegate: async () => ({ removed: false }),
    listTrackedFiles: async () => [],
    isRepository: async () => isRepository,
    readCommitTrailerSetup: async () => ({
      delegate: "absent" as const,
      callSite: "no-hook-file" as const,
      hookHasOtherContent: false,
    }),
    hasHistoryFor: async () => false,
  };
}

class StubSessionCostReader implements SessionCostReader {
  constructor(
    private readonly result: LocalCostReadResult = { records: [], sessionFound: false },
    private readonly failure?: string
  ) {}

  async read(): Promise<LocalCostReadResult> {
    if (this.failure !== undefined) throw new Error(this.failure);
    return this.result;
  }
}

function sessionStart(vendorId: string, at = "2026-08-20T09:00:00Z"): RunJournal["session"] {
  return {
    type: "session_start",
    at,
    run_id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    tool: "claude-code",
    vendor_id: vendorId,
  };
}

function candidate(overrides: Partial<LocalCostCandidateRecord> = {}): LocalCostCandidateRecord {
  return {
    kind: "request",
    vendor_id: "s-1",
    vendor_field: "session_id",
    event_timestamp: "2026-08-20T09:01:00Z",
    ...overrides,
  };
}

function buildUseCase(options: {
  evidence?: StubEvidenceReader;
  isRepository?: boolean;
  journals?: readonly RunJournal[];
  readers?: ReadonlyMap<AiToolId, SessionCostReader>;
  hookTrustReader?: StubHookTrustReader;
  manifestRepo?: ManifestRepository;
  hostRegistries?: ReadonlyMap<AiToolId, HostPluginRegistryReader>;
}) {
  const evidence = options.evidence ?? new StubEvidenceReader();
  const journalReader = new InMemoryRunJournalReader();
  for (const [index, journal] of (options.journals ?? []).entries()) {
    journalReader.set(journal.session?.vendor_id ?? `no-session-${index}`, journal);
  }
  const hookTrustReader = options.hookTrustReader ?? new StubHookTrustReader();
  const useCase = new DiagnoseTelemetryUseCase(
    evidence,
    versionControl(options.isRepository ?? true),
    journalReader,
    options.readers ?? new Map(),
    hookTrustReader,
    new InMemoryPersonIdentityStore(),
    new InMemoryTelemetrySink(),
    new FakeCurrentVersion("9.9.9-check"),
    installedPluginsFromManifest(
      options.manifestRepo ?? {
        path: "/test-project/.aidd/manifest.json",
        load: async () => null,
        save: async () => {},
        delete: async () => {},
      }
    ),
    options.hostRegistries ?? new Map()
  );
  return { useCase, evidence, hookTrustReader, journalReader };
}

function runOptions(env: NodeJS.ProcessEnv = {}) {
  return { projectRoot: "/repo", homeDir: "/home/dev", env };
}

describe("DiagnoseTelemetryUseCase — gating", () => {
  it("stops at the switch before judging anything else", async () => {
    const evidence = new StubEvidenceReader();
    evidence.enabled = false;
    const { useCase } = buildUseCase({ evidence });

    const result = await useCase.execute(runOptions());

    expect(result.gate).toMatch(/measurement is off/u);
    expect("claims" in result).toBe(false);
  });

  it("names a non-repository, never blaming the hook, once the switch is on", async () => {
    const { useCase } = buildUseCase({ isRepository: false });

    const result = await useCase.execute(runOptions());

    expect(result.gate).toMatch(/not a git repository/u);
  });
});

// A stale export in a tool's own settings file exports whether or not this project's switch is
// on, so it is gathered and reported on both sides of the gate, never folded into a claim.
describe("DiagnoseTelemetryUseCase — a leftover export config", () => {
  const LEFTOVER = [
    { path: "/repo/.claude/settings.local.json", keys: ["CLAUDE_CODE_ENABLE_TELEMETRY"] },
  ];

  it("is reported even when the switch is off and the run is gated", async () => {
    const evidence = new StubEvidenceReader();
    evidence.enabled = false;
    evidence.leftoverExport = LEFTOVER;
    const { useCase } = buildUseCase({ evidence });

    const result = await useCase.execute(runOptions());

    expect(result.gate).toMatch(/measurement is off/u);
    expect(result.leftoverExportConfig).toEqual(LEFTOVER);
  });

  it("is reported alongside the four claims when the switch is on", async () => {
    const evidence = new StubEvidenceReader();
    evidence.leftoverExport = LEFTOVER;
    const { useCase } = buildUseCase({ evidence });

    const result = await useCase.execute(runOptions());

    if (result.gate !== undefined) throw new Error("expected the run to pass the gate");
    expect(result.leftoverExportConfig).toEqual(LEFTOVER);
    // Never folded into the health count: "no claim mentions exporting" is a hard rule
    // (telemetry-claim.unit.test.ts) this must not get near.
    expect(result.claims.some((claim) => claim.claim.toString().includes("export"))).toBe(false);
  });

  it("reports an empty list on a clean machine, never omitting the field", async () => {
    const { useCase } = buildUseCase({});

    const result = await useCase.execute(runOptions());

    expect(result.leftoverExportConfig).toEqual([]);
  });
});

describe("DiagnoseTelemetryUseCase — gathering local evidence", () => {
  it("reads the run journal once per check, never once for setup and again for evidence", async () => {
    const journal: RunJournal = {
      session: sessionStart("s-1"),
      boundaries: [
        { type: "step_start", at: "2026-08-20T09:00:30Z", skill: "aidd-dev:02-implement" },
      ],
      filesWritten: [],
      taskDeclarations: [],
    };
    const { useCase, journalReader } = buildUseCase({ journals: [journal] });

    const result = await useCase.execute(runOptions({ CLAUDE_CODE_SESSION_ID: "s-1" }));

    if (result.gate !== undefined) throw new Error("expected the run to pass the gate");
    expect(journalReader.listCalls).toBe(1);
  });

  it("reads every covered tool's own files for every journalled session", async () => {
    const journal: RunJournal = {
      session: sessionStart("s-1"),
      // The pause is what caps the step interval, and is why the candidate below falls inside
      // one at all: a journal whose only line is the opener witnesses no later moment.
      boundaries: [
        { type: "step_start", at: "2026-08-20T09:00:30Z", skill: "aidd-dev:02-implement" },
        { type: "turn_end", at: "2026-08-20T09:30:00Z" },
      ],
      filesWritten: [],
      taskDeclarations: [],
    };
    const claudeReader = new StubSessionCostReader({ records: [candidate()], sessionFound: true });
    const { useCase } = buildUseCase({
      journals: [journal],
      readers: new Map([["claude", claudeReader]]),
    });

    const result = await useCase.execute(runOptions({ CLAUDE_CODE_SESSION_ID: "s-1" }));

    if (result.gate !== undefined) throw new Error("expected the run to pass the gate");
    expect(result.claims.find((c) => c.claim === "tool-files-readable")?.verdict).toBe("ok");
    expect(result.claims.find((c) => c.claim === "records-join")?.verdict).toBe("ok");
  });

  // Copilot fires no stop event, so a Copilot session that opened a skill and then wrote no file
  // leaves a journal whose only line is the opener, and the step it opened covers nothing.
  it("says records join nothing when the journal's only line is the step that opened", async () => {
    const journal: RunJournal = {
      session: sessionStart("s-1"),
      boundaries: [
        { type: "step_start", at: "2026-08-20T09:00:30Z", skill: "aidd-dev:02-implement" },
      ],
      filesWritten: [],
      taskDeclarations: [],
    };
    const claudeReader = new StubSessionCostReader({ records: [candidate()], sessionFound: true });
    const { useCase } = buildUseCase({
      journals: [journal],
      readers: new Map([["claude", claudeReader]]),
    });

    const result = await useCase.execute(runOptions({ CLAUDE_CODE_SESSION_ID: "s-1" }));

    if (result.gate !== undefined) throw new Error("expected the run to pass the gate");
    const join = result.claims.find((claim) => claim.claim === "records-join");
    expect(join?.verdict).toBe("fail");
    expect(join?.reason).toBe("all-unattributed");
  });

  it("names a reader that threw as failing to read, never crashing the whole diagnostic", async () => {
    const journal: RunJournal = {
      session: sessionStart("s-1"),
      boundaries: [],
      filesWritten: [],
      taskDeclarations: [],
    };
    const brokenReader = new StubSessionCostReader(undefined, "ENOENT: no such file");
    const { useCase } = buildUseCase({
      journals: [journal],
      readers: new Map([["claude", brokenReader]]),
    });

    const result = await useCase.execute(runOptions());

    if (result.gate !== undefined) throw new Error("expected the run to pass the gate");
    expect(result.claims.find((c) => c.claim === "tool-files-readable")?.detail).toContain(
      "ENOENT"
    );
  });

  it("only consults Codex's own hook trust for a Codex-anchored session", async () => {
    const hookTrustReader = new StubHookTrustReader();
    hookTrustReader.trust = {
      readable: true,
      trusted: false,
      configPath: "/home/.codex/config.toml",
    };
    const { useCase } = buildUseCase({ hookTrustReader });

    const claudeAnchored = await useCase.execute(runOptions({ CLAUDE_CODE_SESSION_ID: "s-1" }));
    if (claudeAnchored.gate !== undefined) throw new Error("expected the run to pass the gate");
    expect(claudeAnchored.claims.find((c) => c.claim === "hook-fired")?.reason).toBe(
      "recorder-declared-nowhere"
    );

    const codexAnchored = await useCase.execute(runOptions({ CODEX_THREAD_ID: "codex-1" }));
    if (codexAnchored.gate !== undefined) throw new Error("expected the run to pass the gate");
    expect(codexAnchored.claims.find((c) => c.claim === "hook-fired")?.reason).toBe(
      "untrusted-codex-hook"
    );
  });

  it("names every uncovered tool with its own reason", async () => {
    const { useCase } = buildUseCase({});

    const result = await useCase.execute(runOptions());

    if (result.gate !== undefined) throw new Error("expected the run to pass the gate");
    expect(result.uncovered.length).toBeGreaterThan(0);
    for (const uncovered of result.uncovered) expect(uncovered.reason.length).toBeGreaterThan(0);
  });
});

describe("DiagnoseTelemetryUseCase — every claim is judged", () => {
  it("never lets absent evidence produce an ok: no claim is ever left unjudged", async () => {
    const { useCase } = buildUseCase({});

    const result = await useCase.execute(runOptions());

    if (result.gate !== undefined) throw new Error("expected the run to pass the gate");
    for (const claim of result.claims) expect(["ok", "fail", "unknown"]).toContain(claim.verdict);
  });
});

// The first claim judges by the same recorder declaration `gatherSetup` reads, never by the
// absence of a run file, which looks identical whether or not the recorder was declared.
describe("DiagnoseTelemetryUseCase — the first claim reads the same declaration setup prints", () => {
  it("reports nothing to evaluate when the setup's own recorder declaration is true", async () => {
    const evidence = new StubEvidenceReader();
    evidence.recorderDeclaration = {
      declared: true,
      declaredAt: ["/repo/.claude/settings.json"],
      locationsChecked: ["/repo/.aidd/manifest.json", "/repo/.claude/settings.json"],
      unreadable: [],
    };
    const { useCase } = buildUseCase({ evidence });

    const result = await useCase.execute(runOptions());

    if (result.gate !== undefined) throw new Error("expected the run to pass the gate");
    expect(result.setup.recorderDeclaration.declared).toBe(true);
    const hookFired = result.claims.find((c) => c.claim === "hook-fired");
    expect(hookFired?.verdict).toBe("unknown");
    expect(hookFired?.reason).toBe("recorder-declared-not-yet-fired");
  });

  it("fails, naming the recorder, when the setup's own recorder declaration is false", async () => {
    const evidence = new StubEvidenceReader();
    evidence.recorderDeclaration = {
      declared: false,
      declaredAt: [],
      locationsChecked: ["/repo/.aidd/manifest.json"],
      unreadable: [],
    };
    const { useCase } = buildUseCase({ evidence });

    const result = await useCase.execute(runOptions());

    if (result.gate !== undefined) throw new Error("expected the run to pass the gate");
    expect(result.setup.recorderDeclaration.declared).toBe(false);
    const hookFired = result.claims.find((c) => c.claim === "hook-fired");
    expect(hookFired?.verdict).toBe("fail");
    expect(hookFired?.detail).toMatch(/recorder is declared nowhere/u);
  });

  it("reads unknown, never a failure, when the setup's own recorder declaration could not be read", async () => {
    const evidence = new StubEvidenceReader();
    evidence.recorderDeclaration = {
      declared: false,
      declaredAt: [],
      locationsChecked: ["/repo/.aidd/manifest.json", "/repo/.claude/settings.json"],
      unreadable: ["/repo/.claude/settings.json"],
    };
    const { useCase } = buildUseCase({ evidence });

    const result = await useCase.execute(runOptions());

    if (result.gate !== undefined) throw new Error("expected the run to pass the gate");
    const hookFired = result.claims.find((c) => c.claim === "hook-fired");
    expect(hookFired?.verdict).toBe("unknown");
    expect(hookFired?.reason).toBe("recorder-declaration-unreadable");
    expect(hookFired?.detail).not.toContain("FAIL");
  });
});

describe("the versions check reports", () => {
  function sessionAt(at: string, pluginVersion?: string): RunJournal {
    return {
      boundaries: [],
      filesWritten: [],
      taskDeclarations: [],
      session: {
        type: "session_start",
        at,
        run_id: `run-${at}`,
        tool: "claude-code",
        vendor_id: `vendor-${at}`,
        ...(pluginVersion === undefined ? {} : { plugin_version: pluginVersion }),
      },
    };
  }

  it("names this CLI's own version, which a person always has since nothing reads without it", async () => {
    const { useCase } = buildUseCase({});

    const result = await useCase.execute(runOptions());

    expect(result.setup.versions.cli).toBe("9.9.9-check");
  });

  it("reports the plugin version the hook itself stamped, never one re-derived here", async () => {
    const { useCase } = buildUseCase({ journals: [sessionAt("2026-09-01T10:00:00Z", "0.1.0")] });

    const result = await useCase.execute(runOptions());

    expect(result.setup.versions.plugin).toEqual({ kind: "recorded", version: "0.1.0" });
  });

  it("reports the newest, so an upgrade mid-period is not hidden by the sessions before it", async () => {
    const { useCase } = buildUseCase({
      journals: [
        sessionAt("2026-09-01T10:00:00Z", "0.1.0"),
        sessionAt("2026-09-02T10:00:00Z", "0.2.0"),
      ],
    });

    const result = await useCase.execute(runOptions());

    expect(result.setup.versions.plugin).toEqual({ kind: "recorded", version: "0.2.0" });
  });

  it("skips a session carrying no version rather than letting it hide a later one that does", async () => {
    // A line written before the field existed must not read as "this install is damaged".
    const { useCase } = buildUseCase({
      journals: [sessionAt("2026-09-03T10:00:00Z"), sessionAt("2026-09-01T10:00:00Z", "0.1.0")],
    });

    const result = await useCase.execute(runOptions());

    expect(result.setup.versions.plugin).toEqual({ kind: "recorded", version: "0.1.0" });
  });

  it("tells a project that measured nothing yet apart from one whose hook could not name itself", async () => {
    // The two silences differ: nothing journalled says nothing about the plugin, while a
    // journalled session carrying no version is a plugin that arrived by neither install route.
    const nothing = await buildUseCase({}).useCase.execute(runOptions());
    const journalledWithout = await buildUseCase({
      journals: [sessionAt("2026-09-01T10:00:00Z")],
    }).useCase.execute(runOptions());

    expect(nothing.setup.versions.plugin).toEqual({ kind: "nothing-journalled" });
    expect(journalledWithout.setup.versions.plugin).toEqual({ kind: "unrecorded" });
  });
});

/** A hand-edited `.aidd/manifest.json` makes `load` throw: `Manifest`'s parser maps over fields
 * it does not guard. A real implementation of the port rather than a cast, so it cannot drift. */
class ThrowingManifestRepository implements ManifestRepository {
  readonly path = "/test-project/.aidd/manifest.json";
  constructor(private readonly failure: Error) {}
  async load(): Promise<Manifest | null> {
    throw this.failure;
  }
  async save(): Promise<void> {}
  async delete(): Promise<void> {}
}

function manifestWithClaudePlugin(marketplace?: string): InMemoryManifestRepository {
  const manifest = Manifest.create();
  manifest.addTool("claude", "test", []);
  manifest.addPlugin(
    "claude",
    InstalledPlugin.fromMetadata(
      "aidd-telemetry",
      "1.0.0",
      { kind: "github", repo: "ai-driven-dev/framework" },
      true,
      "project",
      marketplace
    )
  );
  return new InMemoryManifestRepository(manifest);
}

function registryCarrying(
  refs: readonly string[]
): ReadonlyMap<AiToolId, HostPluginRegistryReader> {
  const reader: HostPluginRegistryReader = {
    read: async () => ({
      location: REGISTRY,
      refs: new Map(refs.map((ref) => [ref, { enabled: true }])),
    }),
  };
  return new Map<AiToolId, HostPluginRegistryReader>([["claude", reader]]);
}

const REGISTRY = "/home/dev/.claude/plugins/installed_plugins.json";
const REF = "aidd-telemetry@aidd-framework";

describe("DiagnoseTelemetryUseCase — what the host will actually load", () => {
  it("says a plugin the host's registry carries is registered", async () => {
    const { useCase } = buildUseCase({
      manifestRepo: manifestWithClaudePlugin("aidd-framework"),
      hostRegistries: registryCarrying([REF]),
    });

    const result = await useCase.execute(runOptions());

    expect(result.setup.hostRegistration.entries[0]?.answer).toBe("registered");
  });

  it("says a plugin the registry lacks is not registered, and names the file", async () => {
    const { useCase } = buildUseCase({
      manifestRepo: manifestWithClaudePlugin("aidd-framework"),
      hostRegistries: registryCarrying([]),
    });

    const entry = (await useCase.execute(runOptions())).setup.hostRegistration.entries[0];

    expect(entry?.answer).toBe("not-registered");
    expect(entry?.detail).toContain(REGISTRY);
  });

  it("cannot ask any registry about a plugin recorded without a marketplace", async () => {
    const { useCase } = buildUseCase({
      manifestRepo: manifestWithClaudePlugin(undefined),
      hostRegistries: registryCarrying([REF]),
    });

    expect((await useCase.execute(runOptions())).setup.hostRegistration.entries[0]?.answer).toBe(
      "unanswerable"
    );
  });

  it("survives a manifest it cannot parse, and says so instead of dying", async () => {
    const { useCase } = buildUseCase({
      manifestRepo: new ThrowingManifestRepository(
        new TypeError("Cannot read properties of undefined (reading 'map')")
      ),
    });

    const registration = (await useCase.execute(runOptions())).setup.hostRegistration;

    expect(registration.manifestUnreadable).toContain("map");
    expect(registration.entries).toEqual([]);
  });
});

class RecordingSessionCostReader implements SessionCostReader {
  readonly asked: string[] = [];

  constructor(private readonly result: LocalCostReadResult) {}

  async read(sessionId: string): Promise<LocalCostReadResult> {
    this.asked.push(sessionId);
    return this.result;
  }
}

function journalOf(session: RunJournal["session"], lines: Partial<RunJournal> = {}): RunJournal {
  return { boundaries: [], filesWritten: [], taskDeclarations: [], session, ...lines };
}

function claimsOf(result: Awaited<ReturnType<DiagnoseTelemetryUseCase["execute"]>>) {
  if (result.gate !== undefined) throw new Error("expected the run to pass the gate");
  return result;
}

function useCaseOverIdentity(store: InMemoryPersonIdentityStore): DiagnoseTelemetryUseCase {
  return new DiagnoseTelemetryUseCase(
    new StubEvidenceReader(),
    versionControl(true),
    new InMemoryRunJournalReader(),
    new Map(),
    new StubHookTrustReader(),
    store,
    new InMemoryTelemetrySink(),
    new FakeCurrentVersion("9.9.9-check"),
    installedPluginsFromManifest(new InMemoryManifestRepository(Manifest.create())),
    new Map()
  );
}

describe("DiagnoseTelemetryUseCase — the setup it prints", () => {
  it("names the sink's own root as where records land", async () => {
    const { useCase } = buildUseCase({});

    const result = await useCase.execute(runOptions());

    expect(result.setup.recordsLocation).toStrictEqual({ path: "/fake/telemetry" });
  });

  it("reports nobody chose an identity as unattached and readable, at the store's own path", async () => {
    const { useCase } = buildUseCase({});

    const result = await useCase.execute(runOptions());

    expect(result.setup.identity).toStrictEqual({
      attached: false,
      path: "/fake/home/.config/aidd/identity.json",
      readable: true,
    });
  });

  it("reports a chosen identity as attached", async () => {
    const useCase = useCaseOverIdentity(
      new InMemoryPersonIdentityStore({ personId: "person-1", origin: "minted", alsoMe: [] })
    );

    const result = await useCase.execute(runOptions());

    expect(result.setup.identity).toStrictEqual({
      attached: true,
      path: "/fake/home/.config/aidd/identity.json",
      readable: true,
    });
  });

  it("reports a damaged identity file as unreadable and unattached, never crashing", async () => {
    const store = new InMemoryPersonIdentityStore(null);
    store.throwOnRead = new Error("identity.json is a directory");

    const result = await useCaseOverIdentity(store).execute(runOptions());

    expect(result.setup.identity).toStrictEqual({
      attached: false,
      path: "/fake/home/.config/aidd/identity.json",
      readable: false,
    });
  });

  it("says exactly why a non-repository is gated, blaming no hook", async () => {
    const { useCase } = buildUseCase({ isRepository: false });

    const result = await useCase.execute(runOptions());

    expect(result.gate).toBe(
      "not a git repository — the hook has nowhere to write here, not a hook that failed to fire"
    );
  });

  it("names the uncovered tools exactly, each with its declaration's own reason", async () => {
    const { useCase } = buildUseCase({});

    const result = claimsOf(await useCase.execute(runOptions()));

    expect(result.uncovered).toStrictEqual([
      { tool: "cursor", reason: "It writes no token count in any file it produces." },
      { tool: "kilo", reason: "Kilo telemetry has not been measured." },
    ]);
  });
});

describe("DiagnoseTelemetryUseCase — reading the host registries", () => {
  it("asks no registry for a tool the manifest records no plugin for", async () => {
    let codexReads = 0;
    const codexRegistry: HostPluginRegistryReader = {
      read: async () => {
        codexReads += 1;
        return { location: "/home/dev/.codex/config.toml", refs: new Map() };
      },
    };
    const registries = new Map<AiToolId, HostPluginRegistryReader>(registryCarrying([REF]));
    registries.set("codex", codexRegistry);
    const { useCase } = buildUseCase({
      manifestRepo: manifestWithClaudePlugin("aidd-framework"),
      hostRegistries: registries,
    });

    const result = await useCase.execute(runOptions());

    expect(result.setup.hostRegistration.entries.map((entry) => entry.tool)).toStrictEqual([
      "claude",
    ]);
    expect(codexReads).toBe(0);
  });

  it("answers unanswerable for a host that keeps a registry nothing here reads", async () => {
    const { useCase } = buildUseCase({
      manifestRepo: manifestWithClaudePlugin("aidd-framework"),
      hostRegistries: new Map(),
    });

    const result = await useCase.execute(runOptions());

    expect(result.setup.hostRegistration).toStrictEqual({
      entries: [
        {
          tool: "claude",
          plugin: "aidd-telemetry",
          ref: REF,
          answer: "unanswerable",
          detail: "claude keeps a plugin registry, and nothing here has established its shape",
        },
      ],
    });
  });

  it("answers unanswerable for a tool that declares no native activation at all", async () => {
    const manifest = Manifest.create();
    manifest.addTool("cursor", "test", []);
    manifest.addPlugin(
      "cursor",
      InstalledPlugin.fromMetadata(
        "aidd-telemetry",
        "1.0.0",
        { kind: "github", repo: "ai-driven-dev/framework" },
        true,
        "project",
        "aidd-framework"
      )
    );
    const { useCase } = buildUseCase({
      manifestRepo: new InMemoryManifestRepository(manifest),
      hostRegistries: new Map(),
    });

    const result = await useCase.execute(runOptions());

    expect(result.setup.hostRegistration).toStrictEqual({
      entries: [
        {
          tool: "cursor",
          plugin: "aidd-telemetry",
          ref: REF,
          answer: "unanswerable",
          detail: "cursor declares no plugin registry to read",
        },
      ],
    });
  });
});

describe("DiagnoseTelemetryUseCase — what each journal contributes to the claims", () => {
  it("survives a journal whose session_start line is torn away, still naming the version another stamped", async () => {
    const { useCase } = buildUseCase({
      journals: [
        journalOf(undefined),
        journalOf({
          type: "session_start",
          at: "2026-08-20T09:00:00Z",
          run_id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          tool: "claude-code",
          vendor_id: "s-1",
          plugin_version: "0.3.0",
        }),
      ],
    });

    const result = claimsOf(await useCase.execute(runOptions()));

    expect(result.setup.versions.plugin).toStrictEqual({ kind: "recorded", version: "0.3.0" });
  });

  it("asks each covered tool about the sessions the journal names, and about no other", async () => {
    const claudeReader = new RecordingSessionCostReader({ records: [], sessionFound: true });
    const { useCase } = buildUseCase({
      journals: [journalOf(undefined), journalOf(sessionStart("s-1"))],
      readers: new Map([["claude", claudeReader]]),
    });

    await useCase.execute(runOptions());

    expect(claudeReader.asked).toStrictEqual(["s-1"]);
  });

  it("summarises the read per covered tool, in the order the tools are declared", async () => {
    const claudeReader = new StubSessionCostReader({ records: [], sessionFound: true });
    const { useCase } = buildUseCase({
      journals: [journalOf(sessionStart("s-1"))],
      readers: new Map([["claude", claudeReader]]),
    });

    const result = claimsOf(await useCase.execute(runOptions()));

    expect(result.claims[2]).toStrictEqual({
      claim: "tool-files-readable",
      verdict: "ok",
      reason: "session-found",
      detail:
        "claude: 1 of 1 session(s) read; copilot: 0 of 1 session(s) read; " +
        "opencode: 0 of 1 session(s) read; codex: 0 of 1 session(s) read",
    });
  });

  it("says a journal carrying only session_start closed no turn", async () => {
    const { useCase } = buildUseCase({ journals: [journalOf(sessionStart("s-1"))] });

    const result = claimsOf(await useCase.execute(runOptions()));

    expect(result.claims[1]).toStrictEqual({
      claim: "session-journalled",
      verdict: "fail",
      reason: "only-session-start",
      detail: "1 run file(s), all carrying only session_start — nothing closed the turn",
    });
  });

  it("says a journal carrying any boundary closed its turn", async () => {
    const { useCase } = buildUseCase({
      journals: [
        journalOf(sessionStart("s-1"), {
          boundaries: [{ type: "turn_end", at: "2026-08-20T09:30:00Z" }],
        }),
      ],
    });

    const result = claimsOf(await useCase.execute(runOptions()));

    expect(result.claims[1]).toStrictEqual({
      claim: "session-journalled",
      verdict: "ok",
      reason: "turn-closed",
      detail: "1 of 1 run file(s) carry more than session_start",
    });
  });

  it("names the runs directory in the claim that found no run file", async () => {
    const { useCase } = buildUseCase({});

    const result = claimsOf(await useCase.execute(runOptions()));

    expect(result.claims[0]).toStrictEqual({
      claim: "hook-fired",
      verdict: "fail",
      reason: "recorder-declared-nowhere",
      detail:
        "no run file in aidd_docs/runs — the hook has never been observed firing, and the " +
        "recorder is declared nowhere this build checks",
    });
  });

  it("never asks Codex's hook trust for a session another tool anchors", async () => {
    const hookTrustReader = new StubHookTrustReader();
    const { useCase } = buildUseCase({ hookTrustReader });

    await useCase.execute(runOptions({ CLAUDE_CODE_SESSION_ID: "s-1" }));

    expect(hookTrustReader.reads).toBe(0);
  });

  it("asks Codex's hook trust once for a Codex-anchored session", async () => {
    const hookTrustReader = new StubHookTrustReader();
    const { useCase } = buildUseCase({ hookTrustReader });

    await useCase.execute(runOptions({ CODEX_THREAD_ID: "codex-1" }));

    expect(hookTrustReader.reads).toBe(1);
  });

  it("has no join material when no interval opened and no record states a step", async () => {
    const claudeReader = new StubSessionCostReader({ records: [candidate()], sessionFound: true });
    const { useCase } = buildUseCase({
      journals: [journalOf(sessionStart("s-1"))],
      readers: new Map([["claude", claudeReader]]),
    });

    const result = claimsOf(await useCase.execute(runOptions()));

    expect(result.claims[3]).toStrictEqual({
      claim: "records-join",
      verdict: "unknown",
      reason: "no-join-material",
      detail: "no step interval and no tool-stated step — see session journalled",
    });
  });

  it("joins a record whose tool stated its step, with no interval to judge it against", async () => {
    const claudeReader = new StubSessionCostReader({
      records: [candidate({ step: "aidd-dev:01-plan" })],
      sessionFound: true,
    });
    const { useCase } = buildUseCase({
      journals: [journalOf(sessionStart("s-1"))],
      readers: new Map([["claude", claudeReader]]),
    });

    const result = claimsOf(await useCase.execute(runOptions()));

    expect(result.claims[3]).toStrictEqual({
      claim: "records-join",
      verdict: "ok",
      reason: "records-joined",
      detail: "1 of 1 record(s) joined a step, 0 unattributed",
    });
  });

  it("reads no record at all from a reader that threw", async () => {
    const brokenReader = new StubSessionCostReader(undefined, "ENOENT: no such file");
    const { useCase } = buildUseCase({
      journals: [journalOf(sessionStart("s-1"))],
      readers: new Map([["claude", brokenReader]]),
    });

    const result = claimsOf(await useCase.execute(runOptions()));

    expect(result.claims[3]).toStrictEqual({
      claim: "records-join",
      verdict: "unknown",
      reason: "no-record-to-join",
      detail: "no record read to join",
    });
  });
});
