import { rm } from "node:fs/promises";
import { join } from "node:path";
import { readTextIfPresent } from "../../../../kernel/reading/text-file.js";
import {
  parsePersonIdentity,
  renderPersonIdentity,
} from "../../domain/identity/person-identity.js";
import type { PersonIdentityStore } from "../../domain/ports/identity/person-identity-store.js";
import type { PrivateStorage } from "../../domain/ports/private-storage.js";

/** `identity.json` in the telemetry directory, owner-only. It is looked for nowhere else:
 * the previous version kept its own beside the user configuration and none of it is read. */
export class PersonIdentityAdapter implements PersonIdentityStore {
  private readonly path: string;

  constructor(
    private readonly dir: string,
    private readonly storage: PrivateStorage
  ) {
    this.path = join(dir, "identity.json");
  }

  async read(): Promise<string | null> {
    return parsePersonIdentity(await readTextIfPresent(this.path));
  }

  async write(personId: string): Promise<void> {
    await this.storage.ensureDirectory(this.dir);
    await this.storage.replace(this.path, renderPersonIdentity(personId));
  }

  async remove(): Promise<boolean> {
    const held = (await readTextIfPresent(this.path)) !== null;
    await rm(this.path, { force: true });
    return held;
  }
}
