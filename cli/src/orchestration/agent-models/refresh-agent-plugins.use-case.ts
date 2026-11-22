import type {
  AgentPluginHosts,
  AgentPluginPlacement,
} from "../../contexts/installation/application/agents/agent-plugin-hosts.js";
import type { UpdatePlugin } from "../../contexts/installation/application/plugin/update-plugin.use-case.js";
import type { Scope } from "../../shared/domain/scope.js";
import type { AiToolId } from "../../shared/domain/tool.js";
import { AgentPluginActivationError } from "../orchestration.error.js";
import type { UpdateUserPlugin } from "../plugin/update-user-plugin.use-case.js";
import type { SyncSettings } from "../sync/settings/sync-settings.use-case.js";

export interface RefreshAgentPluginsRequest {
  readonly projectRoot: string;
  readonly hosts: readonly AiToolId[];
  /** `"user"` also re-activates what `setup --global` installed. */
  readonly scope: Scope;
}

export interface RefreshAgentPluginsDeps {
  readonly pluginHosts: Pick<AgentPluginHosts, "locate">;
  readonly updatePlugin: Pick<UpdatePlugin, "execute">;
  readonly updateUserPlugin: Pick<UpdateUserPlugin, "execute">;
  readonly syncSettings: Pick<SyncSettings, "execute">;
}

/**
 * Rewrites the files a plugin wrote from the rebuilt tree, and drives again a host that installs
 * plugins itself, which hands it that tree. The provider is machine-wide, so this project is
 * always refreshed, and a plugin installed in the user's home, as Cursor's always is, too;
 * `--global` adds the machine-scope registrations.
 */
export class RefreshAgentPlugins {
  constructor(private readonly deps: RefreshAgentPluginsDeps) {}

  /** The plugins re-installed with the new models. */
  async execute(options: RefreshAgentPluginsRequest): Promise<readonly string[]> {
    const placed = await this.deps.pluginHosts.locate(options.hosts);
    const rewritten = await this.rewrite(placed, options.projectRoot);
    if (placed.installed.length > 0) await this.activate(options, placed.installed);
    if (options.scope === "user" && placed.machine.length > 0) {
      await this.activate(options, placed.machine, "user");
    }
    return rewritten;
  }

  private async rewrite(
    placed: AgentPluginPlacement<AiToolId>,
    projectRoot: string
  ): Promise<readonly string[]> {
    const rewritten = new Set<string>();
    if (placed.userPlugins.length > 0) {
      const names = await this.deps.updateUserPlugin.execute({
        toolIds: [...placed.userPlugins],
        projectRoot,
        scope: "user",
        rebuild: true,
      });
      for (const name of names) rewritten.add(name);
    }
    if (placed.projectPlugins.length > 0) {
      const names = await this.deps.updatePlugin.execute({
        toolIds: [...placed.projectPlugins],
        projectRoot,
        rebuild: true,
      });
      for (const name of names) rewritten.add(name);
    }
    return [...rewritten];
  }

  private async activate(
    { projectRoot }: RefreshAgentPluginsRequest,
    toolIds: readonly AiToolId[],
    scope?: Scope
  ): Promise<void> {
    const { errors } = await this.deps.syncSettings.execute({
      projectRoot,
      toolIds,
      ...(scope === undefined ? {} : { scope }),
    });
    if (errors.length > 0) throw new AgentPluginActivationError(errors);
  }
}
