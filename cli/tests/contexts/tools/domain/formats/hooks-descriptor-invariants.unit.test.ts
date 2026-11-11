import { describe, expect, it } from "vitest";
import {
  declareHooks,
  type HookEventRoute,
  type HooksDeclaration,
} from "../../../../../src/contexts/tools/domain/formats/hooks-descriptor.js";
import type { HooksInvariant } from "../../../../../src/kernel/errors.js";

const OWNER = { toolId: "claude", directory: ".claude/" } as const;
const ROUTE: HookEventRoute = { native: ["SessionStart"], relay: "native" };
const FILE = { wrapper: {}, entries: { shape: "matchers", itemsKept: "all" } } as const;

type Declaration = HooksDeclaration & { readonly runtime: { readonly adapter: string } };

function declaration(overrides: Partial<Declaration> = {}): Declaration {
  return {
    undeclaredEvents: "relayed",
    events: { SessionStart: ROUTE },
    runtime: { adapter: 'const HOST = "unstamped";' },
    ...overrides,
  };
}

const BROKEN: readonly {
  invariant: HooksInvariant;
  case: string;
  owner?: typeof OWNER | { toolId: "codex"; directory: string };
  broken: () => Declaration;
}[] = [
  {
    invariant: "unknown-event",
    case: "an event no plugin may name",
    broken: () => declaration({ events: { Bogus: ROUTE } }),
  },
  {
    invariant: "unknown-event",
    case: "an event fired on no native event",
    broken: () => declaration({ events: { SessionStart: { native: [], relay: "native" } } }),
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
    owner: { toolId: "codex", directory: ".codex/" },
    broken: () => declaration({ runtime: { adapter: 'const HOST = "claude";' } }),
  },
];

describe("declaring a tool's hooks", () => {
  it("accepts a declaration that breaks no invariant", () => {
    expect(declareHooks(OWNER, declaration()).runtime.adapter).toContain('const HOST = "claude";');
  });

  it.each(BROKEN)("refuses $case", ({ invariant, owner = OWNER, broken }) => {
    expect(() => declareHooks(owner, broken())).toThrow(expect.objectContaining({ invariant }));
  });
});
