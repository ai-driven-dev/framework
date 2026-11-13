import { describe, expect, it } from "vitest";
import { PluginsCapability } from "../../../../src/contexts/tools/domain/capabilities/plugins-capability.js";
import {
  CANONICAL_HOOK_EVENTS,
  type HookEventRoute,
} from "../../../../src/contexts/tools/domain/formats/hooks-descriptor.js";
import { isAiTool } from "../../../../src/contexts/tools/domain/registry.js";
import {
  type ConformanceCheck,
  type ConformanceSubject,
  capability,
} from "./profile-conformance.js";

/** What a conformance check is told of the files a profile ships beside its code. */
export interface FileConformanceSubject extends ConformanceSubject {
  /** The directory names under `profiles/`. */
  readonly profileFolders: readonly string[];
  /** The exports of `profiles/<id>/hooks.ts`, or `null` when the file does not exist. */
  readonly hooksModule: Readonly<Record<string, unknown>> | null;
  /** The file names under the repository's hook-payload fixtures. */
  readonly payloadFixtures: readonly string[];
}

interface DeclaredHooks {
  readonly events: ReadonlyMap<string, HookEventRoute>;
  readonly adapter: string | undefined;
}

const ADAPTER_TABLE = /new Map\(\[([\s\S]*?)\]\)/u;
const ADAPTER_PAIR = /\["([^"]+)",\s*"([^"]+)"\]/gu;

function isRecord(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function routeOf(value: unknown): HookEventRoute | undefined {
  if (!isRecord(value)) return undefined;
  const native: unknown = Reflect.get(value, "native");
  const relay: unknown = Reflect.get(value, "relay");
  if (!Array.isArray(native) || (relay !== "native" && relay !== "bridge")) return undefined;
  return { native: native.filter((name) => typeof name === "string"), relay };
}

function declaredHooks(subject: FileConformanceSubject): DeclaredHooks | undefined {
  const name = `${subject.profile.toolId.toUpperCase()}_HOOKS`;
  const descriptor: unknown = subject.hooksModule === null ? undefined : subject.hooksModule[name];
  if (!isRecord(descriptor)) return undefined;
  const events = new Map<string, HookEventRoute>();
  const declared: unknown = Reflect.get(descriptor, "events");
  if (declared instanceof Map) {
    for (const [event, route] of declared) {
      const parsed = routeOf(route);
      if (typeof event === "string" && parsed !== undefined) events.set(event, parsed);
    }
  }
  const runtime: unknown = Reflect.get(descriptor, "runtime");
  const adapter: unknown = isRecord(runtime) ? Reflect.get(runtime, "adapter") : undefined;
  return { events, adapter: typeof adapter === "string" ? adapter : undefined };
}

/** The adapter's table as [native, canonical] pairs, or `null` when it keeps no table. */
function adapterPairs(adapter: string): [string, string][] | null {
  const table = ADAPTER_TABLE.exec(adapter);
  if (table === null) return null;
  return [...table[1].matchAll(ADAPTER_PAIR)].map(([, native, canonical]) => [native, canonical]);
}

/** The canonical events the adapter reads, whether it keeps a table or names them inline. */
function relayedEvents(declared: DeclaredHooks): string[] {
  const { adapter, events } = declared;
  if (adapter === undefined) return [];
  const pairs = adapterPairs(adapter);
  const named =
    pairs === null
      ? [...events.keys()].filter((event) => adapter.includes(`"${event}"`))
      : pairs.map(([, canonical]) => canonical);
  return named.filter((event) => events.has(event));
}

function hooksJsonOf(event: string): string {
  return JSON.stringify({
    hooks: {
      [event]: [
        {
          hooks: [
            {
              type: "command",
              // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a plugin ships
              command: "node ${CLAUDE_PLUGIN_ROOT}/hooks/x.cjs",
            },
          ],
        },
      ],
    },
  });
}

function aiFileCheck(
  title: string,
  holds: (subject: FileConformanceSubject) => void
): ConformanceCheck<FileConformanceSubject> {
  return {
    title,
    holds: (subject) => {
      if (isAiTool(subject.profile)) holds(subject);
    },
  };
}

function acceptsHooks(subject: FileConformanceSubject): boolean {
  if (!isAiTool(subject.profile)) return false;
  return capability(subject.profile, "plugins", PluginsCapability)?.acceptsHooks === true;
}

export const PROFILE_FILE_CHECKS: readonly ConformanceCheck<FileConformanceSubject>[] = [
  {
    title: "sits in a profile folder the registration lists, and every folder is registered",
    holds: ({ profile, profileFolders, registration }) => {
      expect(profileFolders).toContain(profile.toolId);
      const registered = registration.map((other) => other.toolId);
      for (const folder of profileFolders) expect(registered).toContain(folder);
    },
  },
  {
    title: "has a hooks descriptor exactly when it runs hooks",
    holds: (subject) => expect(subject.hooksModule !== null).toBe(acceptsHooks(subject)),
  },
  aiFileCheck("exports its descriptor under the tool's name", (subject) => {
    if (subject.hooksModule === null) return;
    const name = `${subject.profile.toolId.toUpperCase()}_HOOKS`;
    expect(subject.hooksModule[name], name).toBeDefined();
  }),
  aiFileCheck("relays only events its descriptor declares", (subject) => {
    const declared = declaredHooks(subject);
    if (declared?.adapter === undefined) return;
    const pairs = adapterPairs(declared.adapter);
    for (const [native, canonical] of pairs ?? []) {
      const route = declared.events.get(canonical);
      expect(route, `${canonical} relayed, never declared`).toBeDefined();
      if (route?.relay === "native") expect(route.native).toContain(native);
    }
    if (pairs === null) {
      const literals = [...declared.events.keys()].filter((event) =>
        declared.adapter?.includes(`"${event}"`)
      );
      expect(literals.length, "adapter names no declared event").toBeGreaterThan(0);
    }
  }),
  aiFileCheck("generates a bridge for exactly the events it relays through one", (subject) => {
    if (!isAiTool(subject.profile)) return;
    const bridge = capability(subject.profile, "plugins", PluginsCapability)?.flatHooksBridge;
    const declared = declaredHooks(subject);
    if (bridge == null || declared === undefined) return;
    const generated = CANONICAL_HOOK_EVENTS.filter(
      (event) => bridge.generate(hooksJsonOf(event), "p") !== null
    );
    const relayed = CANONICAL_HOOK_EVENTS.filter(
      (event) => declared.events.get(event)?.relay === "bridge"
    );
    expect(generated).toEqual(relayed);
  }),
  aiFileCheck("comes with one captured payload per event it relays", (subject) => {
    const declared = declaredHooks(subject);
    if (declared === undefined) return;
    for (const event of relayedEvents(declared)) {
      const natives = declared.events.get(event)?.native ?? [];
      const captured = natives.some((native) =>
        subject.payloadFixtures.includes(`${subject.profile.toolId}-${native}.json`)
      );
      expect(captured, `${subject.profile.toolId}: no payload for ${event}`).toBe(true);
    }
  }),
];

/** The subject is loaded inside each case: reading a profile's files is not collection work. */
export function describeProfileFileConformance(
  toolId: string,
  load: () => Promise<FileConformanceSubject>
): void {
  describe(toolId, () => {
    for (const check of PROFILE_FILE_CHECKS) {
      it(check.title, async () => check.holds(await load()));
    }
  });
}
