import {
  type CloneIdentity,
  cloneKey,
} from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import type {
  CloneConsentReading,
  ConsentReading,
} from "../../../../src/contexts/telemetry/domain/telemetry-consent.js";
import type { ConsentSource } from "../../../../src/contexts/telemetry/ports/consent-source.js";

export class FakeConsents implements ConsentSource {
  /** The value of `aidd.telemetry` by root; a root with none has it unset. */
  readonly values = new Map<string, string>();
  /** Roots whose git config cannot be read. */
  readonly unreadable = new Set<string>();
  readonly reads: string[] = [];
  /** The value of `aidd.telemetry` by clone (`cloneKey`); a clone not listed has nothing at its
   * path, one mapped to `null` has the key unset. */
  readonly clones = new Map<string, string | null>();
  /** Clones with another directory at their path now, by `cloneKey`. */
  readonly replacedClones = new Set<string>();
  readonly cloneReads: string[] = [];
  /** Clones whose git config cannot be read, by `cloneKey`. */
  readonly unreadableClones = new Set<string>();

  /** Says what `clone` holds now. */
  cloneSays(clone: CloneIdentity, value: string | null): void {
    this.clones.set(cloneKey(clone), value);
  }

  async readClone(clone: CloneIdentity): Promise<CloneConsentReading> {
    this.cloneReads.push(clone.path);
    const key = cloneKey(clone);
    if (this.unreadableClones.has(key)) return { kind: "unreadable" };
    if (this.replacedClones.has(key)) return { kind: "replaced" };
    const value = this.clones.get(key);
    return value === undefined ? { kind: "absent" } : { kind: "value", value };
  }

  async read(root: string): Promise<ConsentReading> {
    this.reads.push(root);
    if (this.unreadable.has(root)) return { kind: "unreadable" };
    return { kind: "value", value: this.values.get(root) ?? null };
  }
}
