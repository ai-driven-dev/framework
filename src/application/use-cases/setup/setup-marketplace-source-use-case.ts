import { MarketplaceSourceMode } from "../../../domain/models/marketplace-source-mode.js";
import type { Prompter } from "../../../domain/ports/prompter.js";
import { InputRequiredError } from "../../errors.js";

export interface SetupMarketplaceSourceOptions {
  projectRoot: string;
  sourceFromCli?: MarketplaceSourceMode;
  interactive: boolean;
}

export class SetupMarketplaceSourceUseCase {
  constructor(private readonly prompter: Prompter) {}

  async execute(options: SetupMarketplaceSourceOptions): Promise<MarketplaceSourceMode> {
    if (options.sourceFromCli !== undefined) return options.sourceFromCli;
    if (options.interactive) return this.promptSource();
    throw new InputRequiredError(
      "--source remote|local is required in non-interactive mode. Use --source remote or --source local --path /abs/path."
    );
  }

  private async promptSource(): Promise<MarketplaceSourceMode> {
    const kind = await this.prompter.select<"remote" | "local">("Select framework source:", [
      { name: "remote (fetch from GitHub marketplace — recommended)", value: "remote" },
      { name: "local (copy from local framework directory)", value: "local" },
    ]);
    if (kind === "remote") return MarketplaceSourceMode.remote();
    const path = await this.prompter.input("Absolute path to local framework directory:", "");
    return MarketplaceSourceMode.local(path);
  }
}
