import type { ManifestRepository } from "../../ports/manifest-repository.js";

/** Where each host's plugins are installed, which says what a provider change rebuilds. */
export interface AgentPluginPlacement<Host extends string> {
  /** Hosts with a plugin installed in the user's home. */
  readonly userPlugins: readonly Host[];
  /** Hosts this project installs plugins for. */
  readonly projectPlugins: readonly Host[];
  /** Hosts this project installed. */
  readonly installed: readonly Host[];
  /** Hosts `setup --global` installed. */
  readonly machine: readonly Host[];
}

/** Reads this project's manifest and the machine's for where each host's plugins live. */
export class LocateAgentPlugins {
  constructor(
    private readonly manifestRepo: Pick<ManifestRepository, "load">,
    private readonly userManifestRepo: Pick<ManifestRepository, "load">
  ) {}

  async execute<Host extends string>(hosts: readonly Host[]): Promise<AgentPluginPlacement<Host>> {
    const userManifest = await this.userManifestRepo.load();
    const manifest = await this.manifestRepo.load();
    const installed = hosts.filter((host) => manifest?.hasTool(host) === true);
    return {
      userPlugins: hosts.filter((host) =>
        userManifest?.getPlugins(host).some((plugin) => plugin.scope === "user")
      ),
      projectPlugins: installed.filter((host) =>
        manifest?.getPlugins(host).some((plugin) => plugin.scope !== "user")
      ),
      installed,
      machine: hosts.filter((host) => userManifest?.hasTool(host) === true),
    };
  }
}
