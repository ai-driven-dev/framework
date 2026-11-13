import { describe, expect, it } from "vitest";
import { PLUGIN_ROOT_TOKEN } from "../../../../../src/contexts/tools/contract/plugin-root-token.js";
import {
  CANONICAL_HOOK_EVENTS,
  declareHooks,
  type HookEventRoute,
  type HooksDeclaration,
} from "../../../../../src/contexts/tools/domain/formats/hooks-descriptor.js";
import type { HooksInvariant } from "../../../../../src/shared/domain/errors.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import { TOOL } from "../../testing/catalog-of.js";

const UNSTAMPED = 'const HOST = "unstamped";';
const OWNER = [TOOL.claude, ".claude/", UNSTAMPED] as const;
const ROUTE: HookEventRoute = { native: ["SessionStart"], relay: "native" };
const FILE = { wrapper: {}, entries: { shape: "matchers", itemsKept: "all" } } as const;

function declaration(overrides: Partial<HooksDeclaration> = {}): HooksDeclaration {
  return {
    undeclaredEvents: "relayed",
    events: { SessionStart: ROUTE },
    ...overrides,
  };
}

const BROKEN: readonly {
  invariant: HooksInvariant;
  case: string;
  owner?: readonly [AiToolId, string, string];
  detail: string;
  broken: () => HooksDeclaration;
}[] = [
  {
    invariant: "unknown-event",
    detail: "Bogus is not a canonical event",
    case: "an event no plugin may name",
    broken: () => declaration({ events: { Bogus: ROUTE } }),
  },
  {
    invariant: "empty-native-list",
    detail: "SessionStart is fired on no native event",
    case: "an event fired on no native event",
    broken: () => declaration({ events: { SessionStart: { native: [], relay: "native" } } }),
  },
  {
    invariant: "duplicate-native-event",
    detail: "SessionStart names a native event twice",
    case: "an event fired twice on the same native event",
    broken: () =>
      declaration({ events: { SessionStart: { native: ["start", "start"], relay: "native" } } }),
  },
  {
    invariant: "project-without-file",
    detail: "a project route merges through the hooks file's format",
    case: "a project route without a hooks file format",
    broken: () =>
      declaration({
        project: {
          pluginFile: "hooks/hooks.json",
          sharedFile: ".claude/hooks.json",
          scriptsDir: ".claude/hooks/",
        },
      }),
  },
  {
    invariant: "loader-with-file",
    detail: "a loader imports a bridge instead of reading a hooks file",
    case: "a loader beside a hooks file format",
    broken: () =>
      declaration({
        file: FILE,
        flat: {
          scriptsDir: ".claude/hooks/",
          loaderEntry: { dir: ".claude/plugins/", baseName: "x" },
        },
      }),
  },
  {
    invariant: "path-outside-directory",
    detail: "elsewhere/hooks/ is not under .claude/",
    case: "a scripts folder outside the tool's directory",
    broken: () => declaration({ flat: { scriptsDir: "elsewhere/hooks/" } }),
  },
  {
    invariant: "root-token-without-file",
    detail: "the root token names what a hooks file's commands hold",
    case: "a root token with no hooks file to hold it",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a host expands
    broken: () => declaration({ rootToken: "${X}" }),
  },
  {
    invariant: "file-without-root-token",
    detail: "a hooks file's commands name the plugin root by a variable",
    case: "a hooks file whose commands name no plugin-root variable",
    broken: () => declaration({ file: FILE }),
  },
  {
    invariant: "adapter-not-stamped",
    detail: "the adapter does not name codex as its host",
    case: "an adapter naming another tool as its host",
    owner: [TOOL.codex, ".codex/", 'const HOST = "claude";'],
    broken: () => declaration(),
  },
];

describe("declaring a tool's hooks", () => {
  it("accepts a declaration that breaks no invariant", () => {
    expect(declareHooks(...OWNER, declaration()).runtime.adapter).toContain(
      'const HOST = "claude";'
    );
  });

  it.each(BROKEN)("refuses $case", ({ invariant, owner = OWNER, broken }) => {
    expect(() => declareHooks(...owner, broken())).toThrow(expect.objectContaining({ invariant }));
  });

  it.each(BROKEN)("says what $case broke", ({ invariant, owner = OWNER, broken, detail }) => {
    expect(() => declareHooks(...owner, broken())).toThrow(
      `The hooks descriptor of '${owner[0]}' breaks '${invariant}': ${detail}`
    );
  });

  describe("what a declaration leaves out", () => {
    it("fires every canonical event under its own name, and relays the rest", () => {
      const declared = declareHooks(...OWNER, {});
      expect([...declared.events.keys()]).toEqual([...CANONICAL_HOOK_EVENTS]);
      expect(declared.eventMap.Stop).toEqual(["Stop"]);
      expect(declared.undeclaredEvents).toBe("relayed");
    });

    it("reads a name or a list of names as native events of the hooks file", () => {
      const declared = declareHooks(...OWNER, {
        events: { SessionStart: "begin", Stop: ["a", "b"] },
      });
      expect(declared.events.get("SessionStart")).toEqual({ native: ["begin"], relay: "native" });
      expect(declared.events.get("Stop")).toEqual({ native: ["a", "b"], relay: "native" });
    });

    it("holds the plugin-root variable a hooks file states, and none without a file", () => {
      expect(declareHooks(...OWNER, { file: FILE, rootToken: PLUGIN_ROOT_TOKEN }).rootToken).toBe(
        PLUGIN_ROOT_TOKEN
      );
      expect(declareHooks(...OWNER, {}).rootToken).toBeUndefined();
    });
  });
});
