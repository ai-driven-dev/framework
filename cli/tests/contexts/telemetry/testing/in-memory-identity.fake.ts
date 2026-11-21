import type { PersonIdentityStore } from "../../../../src/contexts/telemetry/ports/identity/person-identity-store.js";

export class InMemoryIdentity implements PersonIdentityStore {
  personId: string | null = null;
  writes = 0;

  async read(): Promise<string | null> {
    return this.personId;
  }

  async write(personId: string): Promise<void> {
    this.writes += 1;
    this.personId = personId;
  }

  async remove(): Promise<boolean> {
    const held = this.personId !== null;
    this.personId = null;
    return held;
  }
}
