import type { MarketplaceScope } from "../../../../src/shared/domain/scope.js";

interface FixedRegistryEntry {
  readonly enabled: boolean;
  readonly scope?: MarketplaceScope;
}

/** What a host's own plugin registry answers: the refs it carries, or why it carries none. */
export interface FixedRegistryReading {
  readonly location: string;
  readonly refs?: ReadonlyMap<string, FixedRegistryEntry>;
  readonly absent?: true;
  readonly unreadable?: string;
}

/** What a host's registry is asked for: its refs, for the project asked about. */
export interface FixedHostRegistry {
  read(projectRoot: string): Promise<FixedRegistryReading>;
}

/** A registry double whose answer is fixed at construction, never a real file, never a real
 * binary. Stands in for whichever host a removal or an update test needs to ask. */
export class FakeHostPluginRegistry {
  constructor(private readonly reading: FixedRegistryReading) {}

  async read(): Promise<FixedRegistryReading> {
    return this.reading;
  }
}
