import { PluginsCapability } from "../../../../src/contexts/tools/domain/capabilities/plugins-capability.js";
import type { HookEventRoute } from "../../../../src/contexts/tools/domain/formats/hooks-descriptor.js";
import type { FileConformanceSubject } from "./profile-file-conformance.js";
import { aProfile, flatPlugins } from "./profiles.js";

const SESSION_START = { native: ["SessionStart"], relay: "native" } satisfies HookEventRoute;

const ADAPTER = 'const EVENTS = new Map([\n  ["SessionStart", "SessionStart"],\n]);';

function descriptor(
  route: HookEventRoute = SESSION_START,
  adapter = ADAPTER
): Record<string, unknown> {
  return { events: new Map([["SessionStart", route]]), runtime: { adapter } };
}

function subject(overrides: Partial<FileConformanceSubject> = {}): FileConformanceSubject {
  const profile = aProfile().withPlugins(flatPlugins("accepts")).build();
  return {
    profile,
    registration: [profile],
    profileFolders: ["claude"],
    hooksModule: { CLAUDE_HOOKS: descriptor() },
    payloadFixtures: ["claude-SessionStart.json"],
    ...overrides,
  };
}

/** A profile that runs hooks, with its descriptor, an adapter that relays what it declares and a payload. */
export function aValidFileSubject(): FileConformanceSubject {
  return subject();
}

function withBridge(generate: () => string | null): FileConformanceSubject {
  const profile = aProfile()
    .withPlugins(
      new PluginsCapability({
        mode: "flat",
        flatNamespacePrefix: "fake-",
        acceptsHooks: true,
        flatHooksDir: ".fake/hooks/",
        flatHooksBridge: { generate, path: () => "", skipIfSourceHas: "" },
      })
    )
    .build();
  return subject({
    profile,
    registration: [profile],
    hooksModule: { CLAUDE_HOOKS: descriptor({ native: ["SessionStart"], relay: "bridge" }) },
  });
}

/** One subject per file check, in the checks' order, each spoiling exactly the check it is titled for. */
export const BROKEN_FILE_SUBJECTS: readonly {
  title: string;
  subject: () => FileConformanceSubject;
}[] = [
  {
    title: "sits in a profile folder the registration lists, and every folder is registered",
    subject: () => subject({ profileFolders: ["claude", "ghost"] }),
  },
  {
    title: "has a hooks descriptor exactly when it runs hooks",
    subject: () => subject({ hooksModule: null, payloadFixtures: [] }),
  },
  {
    title: "exports its descriptor under the tool's name",
    subject: () => subject({ hooksModule: { OTHER_HOOKS: descriptor() } }),
  },
  {
    title: "relays only events its descriptor declares",
    subject: () =>
      subject({
        hooksModule: {
          CLAUDE_HOOKS: descriptor(
            SESSION_START,
            `${ADAPTER.slice(0, -3)}  ["Stop", "Stop"],\n]);`
          ),
        },
      }),
  },
  {
    title: "generates a bridge for exactly the events it relays through one",
    subject: () => withBridge(() => null),
  },
  {
    title: "comes with one captured payload per event it relays",
    subject: () => subject({ payloadFixtures: [] }),
  },
];
