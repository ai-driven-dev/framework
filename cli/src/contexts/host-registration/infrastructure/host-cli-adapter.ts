import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import type { Scope } from "../../../shared/domain/scope.js";
import { isRefOnHost } from "../domain/record/host-ref.js";
import type { HostActions, HostRefusal } from "../ports/host-actions.js";
import type { HostCliShape } from "../ports/host-cli-shape.js";
import {
  hostExecutableLookup,
  resolveExecutableOnPath,
  runsThroughShell,
  windowsCommandLine,
} from "./executable-on-path.js";

// `plugin add/install` may fetch and cache a marketplace snapshot from a git remote.
const COMMAND_TIMEOUT_MS = 120000;

/** Whether a plugin list names a plugin of the marketplace installed beyond the user's scope. A
 * list that does not parse counts as yes, like one that could not be read. */
function listsOtherScopeUse(stdout: string, name: string): boolean {
  try {
    const plugins = JSON.parse(stdout) as { id?: string; scope?: string }[];
    return plugins.some(
      (plugin) => plugin.id !== undefined && isRefOnHost(plugin.id, name) && plugin.scope !== "user"
    );
  } catch {
    return true;
  }
}

/**
 * Drives a host's own plugin CLI. Everything that differs between hosts comes from the shape its
 * declaration gives, so supporting one more is a declaration and no other subclass, and no host
 * name is written here. A host that enables plugins through a file this CLI writes declares no
 * verbs; it still registers its marketplaces here, because that it does better.
 */
export class HostCliAdapter implements HostActions {
  constructor(
    private readonly binary: string,
    private readonly shape: HostCliShape
  ) {}

  /** Resolves the binary on PATH by filesystem check, with no process spawn: a `--version`
   * probe just to test presence is flake-prone under load. */
  isAvailable(): boolean {
    return resolveExecutableOnPath(this.binary, hostExecutableLookup()) !== undefined;
  }

  /** The binary as the OS will run it. A `.cmd`/`.bat` shim: what npm installs on Windows -
   * cannot be spawned directly, so it goes through the command interpreter with its arguments
   * quoted; anything else is spawned by its bare name. */
  private spawn(
    args: readonly string[],
    stdio: ["ignore", "ignore" | "pipe", "ignore" | "pipe"],
    cwd?: string
  ): SpawnSyncReturns<string> {
    const options = {
      timeout: COMMAND_TIMEOUT_MS,
      stdio,
      encoding: "utf-8" as const,
      ...(cwd === undefined ? {} : { cwd }),
    };
    const executable = resolveExecutableOnPath(this.binary, hostExecutableLookup());
    if (executable !== undefined && runsThroughShell(executable)) {
      return spawnSync(windowsCommandLine(executable, args), { ...options, shell: true });
    }
    return spawnSync(this.binary, [...args], options);
  }

  addMarketplace(source: string, scope: Scope): HostRefusal {
    return this.run(
      ["plugin", "marketplace", "add", source, ...this.scopeArgsFor(scope)],
      `marketplace add ${source}`
    );
  }

  removeMarketplace(name: string, scope: Scope, options?: { force?: boolean }): HostRefusal {
    const force = options?.force === true ? this.forceRemoveArgs() : [];
    const userArgs = scope === "user" ? this.userRemoveArgs() : undefined;
    // Removing from every scope also uninstalls what a project installed from this marketplace,
    // with its saved options: only a marketplace no project uses goes that far.
    const everywhere = userArgs !== undefined && !this.usedAtAnotherScope(name);
    return this.run(
      [
        "plugin",
        "marketplace",
        "remove",
        name,
        ...(everywhere ? userArgs : this.scopeArgsFor(scope)),
        ...force,
      ],
      `marketplace remove ${name}`,
      everywhere ? homedir() : undefined
    );
  }

  /** Whether a plugin of this marketplace is installed at a scope other than the user's, in any
   * project. A list it cannot read counts as yes, since that keeps the narrower removal. */
  private usedAtAnotherScope(name: string): boolean {
    const result = this.spawn(
      ["plugin", "list", "--json"],
      ["ignore", "pipe", "ignore"],
      homedir()
    );
    if (result.error !== undefined || result.status !== 0) return true;
    return listsOtherScopeUse(result.stdout, name);
  }

  /** A tool that cannot tell a dead registration from a live one answers `"unknown"`, which
   * keeps callers from taking over a name that may belong to a live project. */
  registrationState(name: string): "live" | "dead" | "unknown" {
    const verb = this.shape.sourceCheckVerb;
    if (verb === undefined) return "unknown";
    return this.succeeds(["plugin", "marketplace", verb, name]) ? "live" : "dead";
  }

  upgradeMarketplaces(name: string): HostRefusal {
    const verb = this.shape.upgradeVerb;
    if (verb === undefined) return undefined;
    if (name.length === 0) throw new Error("A named marketplace is required for native refresh.");
    return this.run(["plugin", "marketplace", verb, name], `marketplace ${verb} ${name}`);
  }

  enablePlugin(pluginRef: string, scope: Scope = "project"): HostRefusal {
    const verb = this.shape.enableVerb;
    if (verb === undefined) return undefined;
    return this.run(
      ["plugin", verb, pluginRef, ...(this.shape.pluginArgs ?? []), ...this.scopeArgsFor(scope)],
      `plugin ${verb} ${pluginRef}`
    );
  }

  updatePlugin(pluginRef: string): HostRefusal {
    const verb = this.shape.updateVerb;
    if (verb === undefined)
      throw new Error(`${this.binary} does not support targeted native plugin update.`);
    return this.run(["plugin", verb, pluginRef], `plugin ${verb} ${pluginRef}`);
  }

  /** Undoes what `enablePlugin` did. `scope` must match what `enablePlugin` was called with: a
   * tool that installed at one scope and uninstalls at its default would silently miss the
   * entry it wrote. */
  uninstallPlugin(pluginRef: string, scope: Scope = "project"): HostRefusal {
    const verb = this.shape.disableVerb;
    if (verb === undefined) return undefined;
    return this.run(
      ["plugin", verb, pluginRef, ...(this.shape.pluginArgs ?? []), ...this.scopeArgsFor(scope)],
      `plugin ${verb} ${pluginRef}`
    );
  }

  private scopeArgsFor(scope: Scope): readonly string[] {
    return this.shape.scopeArgs?.[scope] ?? [];
  }

  private forceRemoveArgs(): readonly string[] {
    return this.shape.forceRemoveArgs ?? [];
  }

  private userRemoveArgs(): readonly string[] | undefined {
    return this.shape.userRemoveArgs;
  }

  /** Runs a command purely for its exit code; never throws. */
  private succeeds(args: readonly string[]): boolean {
    const result = this.spawn(args, ["ignore", "ignore", "ignore"]);
    return result.error === undefined && result.status === 0;
  }

  private run(args: readonly string[], label: string, cwd?: string): HostRefusal {
    const result = this.spawn(args, ["ignore", "pipe", "pipe"], cwd);
    if (result.error) {
      return { detail: `${this.binary} ${label} failed: ${result.error.message}` };
    }
    if (result.status !== 0) {
      const detail = result.stderr?.trim() ?? "";
      return {
        detail: `${this.binary} ${label} failed: ${detail || `exited with code ${result.status ?? "unknown"}`}`,
      };
    }
    return undefined;
  }
}
