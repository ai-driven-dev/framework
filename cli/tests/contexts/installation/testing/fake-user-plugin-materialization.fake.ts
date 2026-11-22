import { RecordedPlugin } from "../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
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

  async update(): Promise<RecordedPlugin | null> {
    throw new Error("a machine-scope update plans, then applies");
  }

  async planUpdate(
    request: UserPluginUpdateRequest & { readonly rebuild: boolean }
  ): Promise<PlannedUserPluginFileUpdate | null> {
    this.planned.push(request);
    if (this.options.upToDate?.includes(request.plugin.plugin.name)) return null;
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

  async applyUpdate(plan: PlannedUserPluginFileUpdate): Promise<RecordedPlugin> {
    if (this.options.applyFails !== undefined) throw this.options.applyFails;
    this.applied.push(plan);
    return plan.next;
  }
}

export const NEXT_VERSION = "2.0.0";

function nextVersionOf(plugin: RecordedPlugin): RecordedPlugin {
  return RecordedPlugin.fromJSON({ ...plugin.toJSON(), version: NEXT_VERSION });
}
