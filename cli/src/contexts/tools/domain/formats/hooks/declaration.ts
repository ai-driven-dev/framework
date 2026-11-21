import { isAbsolute } from "node:path";
import {
  type HooksInvariant,
  InvalidHooksDescriptorError,
} from "../../../../../shared/domain/errors/invalid-hooks-descriptor-error.js";
import {
  CANONICAL_HOOK_EVENTS,
  type CanonicalHookEvent,
  type HookEventRoute,
  type HooksBrand,
  type HooksDescriptor,
  type HooksRuntime,
} from "./descriptor.js";

/** An event as its tool declares it: the native event it fires on, or several, through the
 * tool's hooks file; or the whole route. */
export type HookEventDeclaration = string | readonly string[] | HookEventRoute;

/** A descriptor as its tool writes it. What it leaves out is what most tools share: every
 * canonical event fired under its own name, and an event it never names still reaching the hook.
 * A tool with a hooks file states the plugin-root variable its commands hold. */
export interface HooksDeclaration
  extends Omit<
    HooksDescriptor,
    "events" | "eventMap" | "runtime" | "undeclaredEvents" | "rootToken"
  > {
  readonly events?: Readonly<Record<string, HookEventDeclaration>>;
  readonly undeclaredEvents?: HooksDescriptor["undeclaredEvents"];
  readonly rootToken?: string;
}

type Refuse = (invariant: HooksInvariant, detail: string) => never;

function routeOf(declared: HookEventDeclaration): HookEventRoute {
  if (typeof declared === "string") return { native: [declared], relay: "native" };
  return "native" in declared ? declared : { native: declared, relay: "native" };
}

function canonicalEvents(
  declared: Readonly<Record<string, HookEventDeclaration>>,
  refuse: Refuse
): ReadonlyMap<CanonicalHookEvent, HookEventRoute> {
  const events = new Map<CanonicalHookEvent, HookEventRoute>();
  for (const [name, declaredRoute] of Object.entries(declared)) {
    const route = routeOf(declaredRoute);
    const event = CANONICAL_HOOK_EVENTS.find((canonical) => canonical === name);
    if (event === undefined) return refuse("unknown-event", `${name} is not a canonical event`);
    if (route.native.length === 0) {
      return refuse("empty-native-list", `${name} is fired on no native event`);
    }
    if (new Set(route.native).size !== route.native.length) {
      return refuse("duplicate-native-event", `${name} names a native event twice`);
    }
    events.set(event, route);
  }
  return events;
}

function ownPaths(declaration: HooksDeclaration): readonly string[] {
  const { flat, project, bridgeRuntime, config } = declaration;
  return [
    flat?.scriptsDir,
    flat?.sharedFile,
    flat?.loaderEntry?.dir,
    project?.sharedFile,
    project?.scriptsDir,
    bridgeRuntime?.path,
    config?.outputPath,
  ].filter((path): path is string => path !== undefined);
}

function stamped(toolId: string, adapter: string, refuse: Refuse): HooksRuntime {
  const stamp = `const HOST = "${toolId}";`;
  const stampedAdapter = adapter.replace('const HOST = "unstamped";', stamp);
  return stampedAdapter.includes(stamp)
    ? { adapter: stampedAdapter }
    : refuse("adapter-not-stamped", `the adapter does not name ${toolId} as its host`);
}

type DeclaredHooks<D extends HooksDeclaration> = Omit<
  D,
  "events" | "undeclaredEvents" | "rootToken"
> & {
  readonly events: ReadonlyMap<CanonicalHookEvent, HookEventRoute>;
  readonly eventMap: Readonly<Record<string, readonly string[]>>;
  readonly undeclaredEvents: HooksDescriptor["undeclaredEvents"];
  readonly rootToken: string | undefined;
  readonly runtime: HooksRuntime;
} & HooksBrand;

/** The tool declaring its hooks: its id, the directory every own path sits under, and the
 * adapter source stamped with the id. */
export interface HooksOwner {
  readonly toolId: string;
  readonly directory: string;
  readonly adapter: string;
}

/** The one door to a descriptor: refuses what no tool could run, and derives what the readers
 * of a descriptor need from the events it declares. */
export function declareHooks<const D extends HooksDeclaration>(
  { toolId, directory, adapter }: HooksOwner,
  declaration: D
): DeclaredHooks<D> {
  const refuse: Refuse = (invariant, detail) => {
    throw new InvalidHooksDescriptorError(toolId, invariant, detail);
  };
  const {
    events: declared = ownNameEvents(),
    undeclaredEvents = "relayed",
    rootToken,
    ...rest
  } = declaration;
  const events = canonicalEvents(declared, refuse);
  if (declaration.project !== undefined && declaration.file === undefined) {
    refuse("project-without-file", "a project route merges through the hooks file's format");
  }
  if (declaration.flat?.loaderEntry !== undefined && declaration.file !== undefined) {
    refuse("loader-with-file", "a loader imports a bridge instead of reading a hooks file");
  }
  if (rootToken === undefined && declaration.file !== undefined) {
    refuse("file-without-root-token", "a hooks file's commands name the plugin root by a variable");
  }
  if (rootToken !== undefined && declaration.file === undefined) {
    refuse("root-token-without-file", "the root token names what a hooks file's commands hold");
  }
  for (const path of ownPaths(declaration)) {
    if (isAbsolute(path) || path.split("/").includes("..") || !path.startsWith(directory)) {
      refuse("path-outside-directory", `${path} is not under ${directory}`);
    }
  }
  const declared_ = {
    ...rest,
    runtime: stamped(toolId, adapter, refuse),
    events,
    undeclaredEvents,
    eventMap: Object.fromEntries([...events].map(([event, route]) => [event, route.native])),
    rootToken,
  };
  return declared_ as typeof declared_ & HooksBrand;
}

/** The events a tool fires under their own names through its hooks file: every canonical event,
 * less those it never fires. */
export function ownNameEvents(
  without: { readonly except?: readonly CanonicalHookEvent[] } = {}
): Record<string, HookEventRoute> {
  const names = CANONICAL_HOOK_EVENTS.filter((name) => !without.except?.includes(name));
  return Object.fromEntries(names.map((name) => [name, { native: [name], relay: "native" }]));
}
