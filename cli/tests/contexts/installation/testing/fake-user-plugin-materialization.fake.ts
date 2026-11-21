import { InstalledPlugin } from "../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import type {
  PlannedUserPluginFileUpdate,
  UserPluginMaterialization,
  UserPluginUpdateRequest,
} from "../../../../src/contexts/installation/ports/plugin/user-plugin-materialization.js";

/** A materialization that plans as told, then applies the next version it planned. It records each
 * plan asked and each plan applied. */
export class FakeUserPluginMaterialization implements UserPluginMaterialization {
  readonly planned: (UserPluginUpdateRequest & { readonly rebuild: boolean })[] = [];
  readonly applied: PlannedUserPluginFileUpdate[] = [];

  constructor(
    private readonly options: {
      readonly upToDate?: readonly string[];
      readonly applyFails?: Error;
    } = {}
  ) {}

  async update(): Promise<InstalledPlugin | null> {
    throw new Error("a machine-scope update plans, then applies");
  }

  async planUpdate(
    request: UserPluginUpdateRequest & { readonly rebuild: boolean }
  ): Promise<PlannedUserPluginFileUpdate | null> {
    this.planned.push(request);
    if (this.options.upToDate?.includes(request.plugin.name)) return null;
    return {
      plugin: request.plugin,
      tool: request.tool,
      home: "/fake-home",
      baseDir: "/fake-home/base",
      files: [],
      oldSafe: new Map(),
      next: nextVersionOf(request.plugin),
    };
  }

  async applyUpdate(plan: PlannedUserPluginFileUpdate): Promise<InstalledPlugin> {
    if (this.options.applyFails !== undefined) throw this.options.applyFails;
    this.applied.push(plan);
    return plan.next;
  }
}

export const NEXT_VERSION = "2.0.0";

function nextVersionOf(plugin: InstalledPlugin): InstalledPlugin {
  return InstalledPlugin.fromJSON({ ...plugin.toJSON(), version: NEXT_VERSION });
}
