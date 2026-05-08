import { MarketplaceSourceMode } from "../../../domain/models/marketplace-source-mode.js";
import type { LatestReleaseResolver } from "../../../domain/ports/latest-release-resolver.js";
import type { Prompter } from "../../../domain/ports/prompter.js";
import { InputRequiredError } from "../../errors.js";

export interface SetupMarketplaceSourceOptions {
  projectRoot: string;
  sourceFromCli?: MarketplaceSourceMode;
  interactive: boolean;
}

export class SetupMarketplaceSourceUseCase {
  constructor(
    private readonly prompter: Prompter,
    private readonly releaseResolver: LatestReleaseResolver
  ) {}

  async execute(options: SetupMarketplaceSourceOptions): Promise<MarketplaceSourceMode> {
    if (options.sourceFromCli !== undefined) {
      return this.resolveRef(options.sourceFromCli, options.interactive);
    }
    if (options.interactive) return this.promptSource();
    throw new InputRequiredError(
      "--source remote|local is required in non-interactive mode. Use --source remote or --source local --path /abs/path."
    );
  }

  private async resolveRef(
    source: MarketplaceSourceMode,
    interactive: boolean
  ): Promise<MarketplaceSourceMode> {
    if (source.kind !== "remote") return source;
    if (source.ref !== undefined) return source;
    const defaultRef = await this.releaseResolver.resolveLatest(source.repo);
    if (interactive) return this.promptVersion(source.repo, defaultRef);
    return MarketplaceSourceMode.remote(source.repo, defaultRef ?? undefined);
  }

  private async promptSource(): Promise<MarketplaceSourceMode> {
    const kind = await this.prompter.select<"remote" | "local">("Select framework source:", [
      { name: "remote (fetch from GitHub marketplace — recommended)", value: "remote" },
      { name: "local (copy from local framework directory)", value: "local" },
    ]);
    if (kind === "remote") return this.promptRemoteSource();
    const path = await this.prompter.input("Absolute path to local framework directory:", "");
    return MarketplaceSourceMode.local(path);
  }

  private async promptRemoteSource(): Promise<MarketplaceSourceMode> {
    const defaultRef = await this.releaseResolver.resolveLatest(
      MarketplaceSourceMode.remote().repo
    );
    return this.promptVersion(MarketplaceSourceMode.remote().repo, defaultRef);
  }

  private async promptVersion(
    repo: string,
    defaultRef: string | null
  ): Promise<MarketplaceSourceMode> {
    const defaultLabel = defaultRef ?? "HEAD";
    const input = await this.prompter.input(
      `Marketplace version (default: ${defaultLabel}):`,
      defaultLabel
    );
    const ref = input.trim() === "" ? (defaultRef ?? undefined) : input.trim();
    return MarketplaceSourceMode.remote(repo, ref);
  }
}
