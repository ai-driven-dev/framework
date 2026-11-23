import type { Lock } from "../../../shared/ports/lock.js";
import type { RunSettingsSync } from "./run-settings-sync.use-case.js";
import type { SyncSettingsRequest, SyncSettingsResult } from "./sync-settings.js";

/** Brings a project's (or the machine's) tool settings and native registrations in line with its
 * manifest. A project-scope run holds the machine manifest's lock; a user-scope one already works
 * on that manifest, and no lock is held when no machine manifest is kept. */
export class SyncSettings {
  constructor(
    private readonly run: Pick<RunSettingsSync, "execute">,
    private readonly machineManifest: Lock | undefined
  ) {}

  execute(options: SyncSettingsRequest): Promise<SyncSettingsResult> {
    const work = () => this.run.execute(options);
    if ((options.scope ?? "project") === "project" && this.machineManifest !== undefined) {
      return this.machineManifest.withExclusiveAccess(work);
    }
    return work();
  }
}
