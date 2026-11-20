import { describe, expect, it } from "vitest";
import type { MainSessionLocation } from "../../../../../src/contexts/installation/application/agents/main-session-locator.js";
import { MainSessionModels } from "../../../../../src/contexts/installation/application/agents/main-session-models.js";
import type {
  AgentModelStore,
  MainModels,
} from "../../../../../src/contexts/installation/ports/agent-model-store.js";
import type {
  MainModelRecord,
  MainSessionSettings,
} from "../../../../../src/contexts/installation/ports/main-session-settings.js";
import type { AgentModelAnswers } from "../../../../../src/contexts/tools/contract/tool-profile.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";

const A = "/home/me/a.json";
const B = "/home/me/b.json";
const SCHEMA = "https://example.test/schema.json";

function record(path: string, tag = "r"): MainModelRecord {
  return { path, written: { model: tag }, previous: { model: null }, created: false };
}

function models(schema?: string): AgentModelAnswers {
  return {
    providers: () => [],
    supportedProvider: (provider) => provider,
    mainModel: () => ({ model: "x" }),
    roleModels: () => [],
    mainSettings: () => ({ file: "settings.json", ...(schema === undefined ? {} : { schema }) }),
    mainSettingsValues: (provider) => ({ model: `${provider}-model` }),
  };
}

interface Case {
  files?: Record<string, string>;
  stored?: Record<string, MainModelRecord>;
  located?: Record<string, MainSessionLocation>;
  /** What planInstall answers, or throws when it is an Error. */
  install?: { content: string; record: MainModelRecord } | Error;
  /** What planRemoval answers, or throws when it is an Error. */
  removal?: string | null | Error;
}

interface PlannedInstall {
  path: string;
  current: string | null;
  values: unknown;
  previous: MainModelRecord | undefined;
  schema: string | undefined;
}

interface PlannedRemoval {
  current: string | null;
  recorded: MainModelRecord;
}

/** The in-memory files, noting each write and delete in the order they happen. */
class RecordingFiles extends InMemoryFileAdapter {
  constructor(private readonly events: string[]) {
    super();
  }

  readonly checked: string[] = [];

  override async fileExists(path: string): Promise<boolean> {
    this.checked.push(path);
    return super.fileExists(path);
  }

  override async writeFile(path: string, content: string): Promise<void> {
    this.events.push(`write ${path}`);
    return super.writeFile(path, content);
  }

  override async deleteFile(path: string): Promise<void> {
    this.events.push(`delete ${path}`);
    return super.deleteFile(path);
  }
}

function harness(given: Case = {}) {
  const events: string[] = [];
  const files = new RecordingFiles(events);
  for (const [path, content] of Object.entries(given.files ?? { [A]: "present" })) {
    files.setFile(path, content);
  }
  const installs: PlannedInstall[] = [];
  const removals: PlannedRemoval[] = [];
  let saved: MainModels | undefined;
  const store: AgentModelStore = {
    loadProviders: async () => ({}),
    saveProviders: async () => undefined,
    loadMainModels: async () => structuredClone(given.stored ?? {}),
    saveMainModels: async (value) => {
      events.push("save");
      saved = value;
    },
  };
  const settings: MainSessionSettings = {
    planInstall: (path, current, values, previous, schema) => {
      installs.push({ path, current, values, previous, schema });
      const answer = given.install ?? { content: "installed", record: record(A, "new") };
      if (answer instanceof Error) throw answer;
      return answer;
    },
    planRemoval: (current, recorded) => {
      removals.push({ current, recorded });
      const answer = given.removal === undefined ? "restored" : given.removal;
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
  const locator = {
    locate: async (host: string): Promise<MainSessionLocation> =>
      given.located?.[host] ?? { models: models(SCHEMA), path: A },
  };
  const subject = new MainSessionModels(files, store, settings, locator);
  return {
    subject,
    events,
    installs,
    removals,
    saved: () => saved,
    checked: files.checked,
    file: (path: string) => files.getFile(path),
    has: (path: string) => files.has(path),
  };
}

describe("MainSessionModels", () => {
  describe("setting a main session", () => {
    it("plans the install from the file the host reads, the provider's values and the schema, then writes and records it", async () => {
      const h = harness({ files: { [A]: "current" } });

      const outcome = await h.subject.apply(["h"], new Map([["h", "p"]]));

      expect(h.installs).toStrictEqual([
        {
          path: A,
          current: "current",
          values: { model: "p-model" },
          previous: undefined,
          schema: SCHEMA,
        },
      ]);
      expect(h.file(A)).toBe("installed");
      expect(h.saved()).toStrictEqual({ h: record(A, "new") });
      expect(outcome).toStrictEqual({ changed: [{ host: "h", path: A }], skipped: [] });
    });

    it("plans from no content when the settings file does not exist yet", async () => {
      const h = harness({ files: {} });

      await h.subject.apply(["h"], new Map([["h", "p"]]));

      expect(h.installs[0]?.current).toBeNull();
    });

    it("hands the record it kept to the plan, so a value the person changed stays theirs", async () => {
      const kept = record(A, "kept");
      const h = harness({ stored: { h: kept } });

      await h.subject.apply(["h"], new Map([["h", "p"]]));

      expect(h.installs[0]?.previous).toStrictEqual(kept);
      expect(h.removals).toStrictEqual([]);
    });

    it("leaves a host alone whose main session aidd does not point (no settings file)", async () => {
      const h = harness({ located: { h: { models: models(), path: undefined } } });

      const outcome = await h.subject.apply(["h"], new Map([["h", "p"]]));

      expect(h.checked).toStrictEqual([]);
      expect(outcome).toStrictEqual({ changed: [], skipped: [] });
    });

    it("leaves a host alone that answers no models", async () => {
      const h = harness({ located: { h: { models: null, path: A } } });

      const outcome = await h.subject.apply(["h"], new Map([["h", "p"]]));

      expect(h.checked).toStrictEqual([]);
      expect(outcome).toStrictEqual({ changed: [], skipped: [] });
    });

    it("goes on with the other hosts after one whose file cannot be planned, naming that file and reason", async () => {
      const h = harness({
        located: { one: { models: models(), path: A }, two: { models: models(), path: B } },
        files: { [A]: "one-file", [B]: "two-file" },
        install: new Error("no JSON object"),
      });

      const outcome = await h.subject.apply(
        ["one", "two"],
        new Map([
          ["one", "p"],
          ["two", "p"],
        ])
      );

      expect(outcome.skipped).toStrictEqual([
        { host: "one", path: A, reason: "no JSON object" },
        { host: "two", path: B, reason: "no JSON object" },
      ]);
      expect(outcome.changed).toStrictEqual([]);
      expect(h.events).toStrictEqual(["save"]);
    });
  });

  describe("unsetting a main session", () => {
    it("restores the file even when the host no longer answers a settings path", async () => {
      const h = harness({
        stored: { h: record(A) },
        files: { [A]: "mine" },
        located: { h: { models: null, path: undefined } },
      });

      const outcome = await h.subject.apply(["h"], new Map());

      expect(outcome.changed).toStrictEqual([{ host: "h", path: A }]);
    });

    it("deletes a file aidd created and nothing else holds", async () => {
      const h = harness({ stored: { h: record(A) }, files: { [A]: "x" }, removal: null });

      const outcome = await h.subject.apply(["h"], new Map());

      expect(h.events).toContain(`delete ${A}`);
      expect(h.has(A)).toBe(false);
      expect(outcome.changed).toStrictEqual([{ host: "h", path: A }]);
    });

    it("reports no change when the restore leaves the file as it is, and still forgets the record", async () => {
      const h = harness({ stored: { h: record(A) }, files: { [A]: "same" }, removal: "same" });

      const outcome = await h.subject.apply(["h"], new Map());

      expect(outcome.changed).toStrictEqual([]);
      expect(h.events).not.toContain(`write ${A}`);
      expect(h.saved()).toStrictEqual({});
    });

    it("plans a removal from no content when the recorded file is gone", async () => {
      const h = harness({ stored: { h: record(A) }, files: {}, removal: null });

      await h.subject.apply(["h"], new Map());

      expect(h.removals[0]?.current).toBeNull();
    });

    it("skips a recorded file it cannot restore, naming it, and keeps the record", async () => {
      const kept = record(B);
      const h = harness({ stored: { h: kept }, files: { [B]: "x" }, removal: new Error("bad") });

      const outcome = await h.subject.apply(["h"], new Map());

      expect(outcome.skipped).toStrictEqual([{ host: "h", path: B, reason: "bad" }]);
      expect(h.saved()).toStrictEqual({ h: kept });
    });
  });

  describe("a host that now reads another file", () => {
    it("restores the file it wrote, then sets the new one, and records the new file", async () => {
      const old = record(B);
      const h = harness({
        stored: { h: old },
        files: { [A]: "new-file", [B]: "old-file" },
        removal: "old-restored",
      });

      const outcome = await h.subject.apply(["h"], new Map([["h", "p"]]));

      expect(h.removals).toStrictEqual([{ current: "old-file", recorded: old }]);
      expect(h.installs[0]?.current).toBe("new-file");
      expect(h.file(B)).toBe("old-restored");
      expect(h.file(A)).toBe("installed");
      expect(h.installs[0]?.previous).toBeUndefined();
      expect(h.saved()).toStrictEqual({ h: record(A, "new") });
      expect(outcome.changed).toStrictEqual([
        { host: "h", path: B },
        { host: "h", path: A },
      ]);
    });

    it("names the new file when its plan fails after the old one was restored", async () => {
      const h = harness({
        stored: { h: record(B) },
        files: { [A]: "new-file", [B]: "old-file" },
        install: new Error("bad"),
      });

      const outcome = await h.subject.apply(["h"], new Map([["h", "p"]]));

      expect(outcome.skipped).toStrictEqual([{ host: "h", path: A, reason: "bad" }]);
      expect(outcome.changed).toStrictEqual([{ host: "h", path: B }]);
      expect(h.saved()).toStrictEqual({});
    });

    it("leaves the new file alone when the old one cannot be restored", async () => {
      const h = harness({
        stored: { h: record(B) },
        files: { [A]: "new-file", [B]: "old-file" },
        removal: new Error("bad"),
      });

      const outcome = await h.subject.apply(["h"], new Map([["h", "p"]]));

      expect(outcome.changed).toStrictEqual([]);
      expect(h.installs).toStrictEqual([]);
    });
  });

  describe("the run as a whole", () => {
    it("saves the record before it touches any settings file", async () => {
      const h = harness();

      await h.subject.apply(["h"], new Map([["h", "p"]]));

      expect(h.events).toStrictEqual(["save", `write ${A}`]);
    });

    it("says what it would change and changes nothing on a dry run", async () => {
      const h = harness({
        stored: { h: record(B) },
        files: { [A]: "new-file", [B]: "old-file" },
      });

      const outcome = await h.subject.apply(["h"], new Map([["h", "p"]]), true);

      expect(outcome.changed).toStrictEqual([
        { host: "h", path: B },
        { host: "h", path: A },
      ]);
      expect(h.events).toStrictEqual([]);
    });

    it("restores every recorded host on restoreAll", async () => {
      const h = harness({
        stored: { one: record(A), two: record(B) },
        files: { [A]: "one-file", [B]: "two-file" },
        located: { one: { models: models(), path: A }, two: { models: models(), path: B } },
      });

      const outcome = await h.subject.restoreAll(false);

      expect(outcome.changed).toStrictEqual([
        { host: "one", path: A },
        { host: "two", path: B },
      ]);
      expect(h.saved()).toStrictEqual({});
    });

    it("forwards a dry run through restoreAll", async () => {
      const h = harness({ stored: { h: record(A) } });

      await h.subject.restoreAll(true);

      expect(h.events).toStrictEqual([]);
    });
  });
});
