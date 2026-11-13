import { describe, expect, it } from "vitest";
import {
  CANONICAL_HOOK_EVENTS,
  declareHooks,
  type HookEventRoute,
  type HooksDeclaration,
} from "../../../../../src/contexts/tools/domain/formats/hooks-descriptor.js";
import { PLUGIN_ROOT_TOKEN } from "../../../../../src/contexts/tools/domain/formats/plugin-root-token.js";
import type { HooksInvariant } from "../../../../../src/kernel/errors.js";
import type { AiToolId } from "../../../../../src/kernel/tool.js";

const UNSTAMPED = 'const HOST = "unstamped";';
const OWNER = ["claude", ".claude/", UNSTAMPED] as const;
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
  broken: () => HooksDeclaration;
}[] = [
  {
    invariant: "unknown-event",
    case: "an event no plugin may name",
    broken: () => declaration({ events: { Bogus: ROUTE } }),
  },
  {
    invariant: "empty-native-list",
    case: "an event fired on no native event",
    broken: () => declaration({ events: { SessionStart: { native: [], relay: "native" } } }),
  },
  {
    invariant: "duplicate-native-event",
    case: "an event fired twice on the same native event",
    broken: () =>
      declaration({ events: { SessionStart: { native: ["start", "start"], relay: "native" } } }),
  },
  {
    invariant: "project-without-file",
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
    case: "a scripts folder outside the tool's directory",
    broken: () => declaration({ flat: { scriptsDir: "elsewhere/hooks/" } }),
  },
  {
    invariant: "root-token-without-file",
    case: "a root token with no hooks file to hold it",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a host expands
    broken: () => declaration({ rootToken: "${X}" }),
  },
  {
    invariant: "adapter-not-stamped",
    case: "an adapter naming another tool as its host",
    owner: ["codex", ".codex/", 'const HOST = "claude";'],
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

    it("holds the generic plugin-root variable for a hooks file's commands", () => {
      expect(declareHooks(...OWNER, { file: FILE }).rootToken).toBe(PLUGIN_ROOT_TOKEN);
      expect(declareHooks(...OWNER, {}).rootToken).toBeUndefined();
    });
  });
});
