import type { HostRefusal } from "../../../src/contexts/host-registration/domain/native-refusal.js";
import type { HostActions } from "../../../src/contexts/host-registration/ports/host-actions.js";
import type { Scope } from "../../../src/shared/domain/scope.js";

/** Records native plugin CLI calls instead of shelling out. Two measured shapes: a real
 * `claude` refuses a mismatched-scope uninstall, and a plain `Error` no adapter produces. */
export class FakeHostActions implements HostActions {
  available: boolean;
  readonly addedMarketplaces: string[] = [];
  readonly removedMarketplaces: string[] = [];
  /** The scope each marketplace removal actually carried, in call order. */
  readonly removedMarketplaceScopes: Array<Scope | undefined> = [];
  readonly forcedRemovals: boolean[] = [];
  readonly enabledPlugins: string[] = [];
  readonly uninstalledPlugins: string[] = [];
  readonly updatedPlugins: string[] = [];
  /** The scope each call actually carried, in call order, never guessed from the ref. */
  readonly enabledPluginScopes: Scope[] = [];
  readonly uninstalledPluginScopes: Scope[] = [];
  upgradeCount = 0;
  private readonly failOnPlugins: ReadonlySet<string>;
  private readonly conflictOnAdd: boolean;
  private readonly throwOnRemove: boolean;
  private readonly state: "live" | "dead" | "unknown";
  private readonly failOnUninstall: ReadonlySet<string>;
  private readonly failOnUpdate: ReadonlySet<string>;
  private readonly crashOnAddMarketplace: boolean;
  private readonly crashOnUninstall: boolean;
  private readonly installedAtScope: ReadonlyMap<string, Scope>;

  constructor(
    options: {
      available?: boolean;
      failOnPlugins?: readonly string[];
      conflictOnAdd?: boolean;
      throwOnRemove?: boolean;
      /** What the tool answers about a name already registered. */
      registrationState?: "live" | "dead" | "unknown";
      failOnUninstall?: readonly string[];
      failOnUpdate?: readonly string[];
      crashOnAddMarketplace?: boolean;
      crashOnUninstall?: boolean;
      installedAtScope?: ReadonlyMap<string, Scope>;
    } = {}
  ) {
    const {
      available = false,
      failOnPlugins = [],
      conflictOnAdd = false,
      throwOnRemove = false,
      registrationState = "unknown",
      failOnUninstall = [],
      failOnUpdate = [],
      crashOnAddMarketplace = false,
      crashOnUninstall = false,
      installedAtScope = new Map(),
    } = options;
    this.available = available;
    this.failOnPlugins = new Set(failOnPlugins);
    this.conflictOnAdd = conflictOnAdd;
    this.throwOnRemove = throwOnRemove;
    this.state = registrationState;
    this.failOnUninstall = new Set(failOnUninstall);
    this.failOnUpdate = new Set(failOnUpdate);
    this.crashOnAddMarketplace = crashOnAddMarketplace;
    this.crashOnUninstall = crashOnUninstall;
    this.installedAtScope = installedAtScope;
  }

  registrationState(): "live" | "dead" | "unknown" {
    return this.state;
  }

  isAvailable(): boolean {
    return this.available;
  }

  addMarketplace(source: string, _scope?: unknown): HostRefusal {
    if (this.crashOnAddMarketplace) {
      throw new Error("activator crashed adding a marketplace");
    }
    if (this.conflictOnAdd && this.removedMarketplaces.length === 0) {
      return {
        detail:
          "marketplace is already added from a different source; remove it before adding this source",
      };
    }
    this.addedMarketplaces.push(source);
    return undefined;
  }

  removeMarketplace(name: string, scope?: Scope, options?: { force?: boolean }): HostRefusal {
    this.forcedRemovals.push(options?.force === true);
    this.removedMarketplaceScopes.push(scope);
    if (this.throwOnRemove) {
      return {
        detail: `marketplace remove ${name} failed: '${name}' is not configured or installed`,
      };
    }
    this.removedMarketplaces.push(name);
    return undefined;
  }

  upgradeMarketplaces(): HostRefusal {
    this.upgradeCount += 1;
    return undefined;
  }

  enablePlugin(pluginRef: string, scope: Scope = "project"): HostRefusal {
    this.enabledPluginScopes.push(scope);
    if (this.failOnPlugins.has(pluginRef)) {
      return { detail: `plugin \`${pluginRef}\` was not found in marketplace` };
    }
    this.enabledPlugins.push(pluginRef);
    return undefined;
  }

  uninstallPlugin(pluginRef: string, scope: Scope = "project"): HostRefusal {
    if (this.crashOnUninstall) {
      throw new Error("activator crashed uninstalling a plugin");
    }
    this.uninstalledPluginScopes.push(scope);
    if (this.failOnUninstall.has(pluginRef)) {
      return { detail: `plugin \`${pluginRef}\` is not installed` };
    }
    const installedScope = this.installedAtScope.get(pluginRef);
    if (installedScope !== undefined && installedScope !== scope) {
      return { detail: `plugin \`${pluginRef}\` is not installed at scope '${scope}'` };
    }
    this.uninstalledPlugins.push(pluginRef);
    return undefined;
  }

  updatePlugin(pluginRef: string): HostRefusal {
    if (this.failOnUpdate.has(pluginRef)) return { detail: `plugin update '${pluginRef}' failed` };
    this.updatedPlugins.push(pluginRef);
    return undefined;
  }
}
