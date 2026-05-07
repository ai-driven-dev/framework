export const DEFAULT_FRAMEWORK_REPO = "ai-driven-dev/aidd-framework";

export type MarketplaceSourceModeValue =
  | { kind: "remote"; repo: string }
  | { kind: "local"; path: string };

export class MarketplaceSourceMode {
  private constructor(private readonly value: MarketplaceSourceModeValue) {}

  get kind(): MarketplaceSourceModeValue["kind"] {
    return this.value.kind;
  }

  get repo(): string {
    if (this.value.kind !== "remote") throw new Error("Not a remote source");
    return this.value.repo;
  }

  get path(): string {
    if (this.value.kind !== "local") throw new Error("Not a local source");
    return this.value.path;
  }

  static remote(repo?: string): MarketplaceSourceMode {
    return new MarketplaceSourceMode({ kind: "remote", repo: repo ?? DEFAULT_FRAMEWORK_REPO });
  }

  static local(path: string): MarketplaceSourceMode {
    if (!path) throw new Error("Local source path must not be empty.");
    if (!path.startsWith("/")) throw new Error(`Local source path must be absolute: "${path}"`);
    return new MarketplaceSourceMode({ kind: "local", path });
  }

  equals(other: MarketplaceSourceMode): boolean {
    if (this.value.kind !== other.value.kind) return false;
    if (this.value.kind === "remote" && other.value.kind === "remote") {
      return this.value.repo === other.value.repo;
    }
    if (this.value.kind === "local" && other.value.kind === "local") {
      return this.value.path === other.value.path;
    }
    return false;
  }
}
