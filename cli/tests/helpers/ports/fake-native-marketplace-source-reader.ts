import type {
  NativeMarketplaceSource,
  NativeMarketplaceSourceReader,
  NativeMarketplaceSourceReading,
} from "../../../src/contexts/tools/domain/ports/native-marketplace-source-reader.js";
import type { FakeNativePluginActivator } from "./fake-native-plugin-activator.js";

/** A fake host listing, not an ownership oracle: initial host state and add-result names are explicit. */
export class FakeNativeMarketplaceSourceReader implements NativeMarketplaceSourceReader {
  private readonly entries: Map<string, NativeMarketplaceSource | null>;
  private seenAdds = 0;

  constructor(
    private readonly activator: FakeNativePluginActivator,
    private readonly kind: "registry" | "effective-list",
    private readonly nameForAddedPath: (path: string) => string | undefined,
    initial: ReadonlyMap<string, NativeMarketplaceSource | null>
  ) {
    this.entries = new Map(initial);
  }

  async read(projectRoot: string): Promise<NativeMarketplaceSourceReading> {
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
