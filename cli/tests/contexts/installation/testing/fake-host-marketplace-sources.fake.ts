import type { FakeHostActions } from "../../../shared/testing/fake-host-actions.fake.js";

/** The source a host selects for a native marketplace, as far as a registration reads it. */
export type FakeNativeSource =
  | { readonly kind: "registry"; readonly source: string }
  | {
      readonly kind: "effective-list";
      readonly root: string;
      readonly sourceType: string;
      readonly source: string;
    };

type FakeSourceReading =
  | { readonly location: string; readonly entries: ReadonlyMap<string, FakeNativeSource | null> }
  | { readonly location: string; readonly unreadable: string };

/** A fake host listing, not an ownership oracle: initial host state and add-result names are explicit. */
export class FakeHostMarketplaceSources {
  private readonly entries: Map<string, FakeNativeSource | null>;
  private seenAdds = 0;

  constructor(
    private readonly activator: FakeHostActions,
    private readonly kind: "registry" | "effective-list",
    private readonly nameForAddedPath: (path: string) => string | undefined,
    initial: ReadonlyMap<string, FakeNativeSource | null>
  ) {
    this.entries = new Map(initial);
  }

  async read(projectRoot: string): Promise<FakeSourceReading> {
    while (this.seenAdds < this.activator.addedMarketplaces.length) {
      const path = this.activator.addedMarketplaces[this.seenAdds++];
      const name = this.nameForAddedPath(path);
      if (name === undefined)
        return {
          location: `fake native host (cwd ${projectRoot})`,
          unreadable: `no catalogue identity for added path ${path}`,
        };
      this.entries.set(
        name,
        this.kind === "registry"
          ? { kind: "registry", source: path }
          : { kind: "effective-list", root: path, sourceType: "local", source: path }
      );
    }
    return { location: `fake native host (cwd ${projectRoot})`, entries: new Map(this.entries) };
  }
}
