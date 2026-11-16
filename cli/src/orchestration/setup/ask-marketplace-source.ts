import type { ChooseMarketplaceSource } from "../../contexts/distribution/application/choose-marketplace-source.js";
import type { FrameworkSource } from "../../contexts/distribution/contract/framework-source.js";
import { InputRequiredError } from "../../shared/domain/errors.js";
import type { Prompter } from "../../shared/ports/prompter.js";

/** Sentinel select value for "install from main branch tip": maps to no ref. */
const HEAD_CHOICE = "__HEAD__";

export interface AskMarketplaceSourceOptions {
  projectRoot: string;
  sourceFromCli?: FrameworkSource;
  interactive: boolean;
}

/** Which framework source a setup registers: the one the command line names, completed by a
 * question when someone can answer it. */
export class AskMarketplaceSource {
  constructor(
    private readonly prompter: Prompter,
    private readonly choose: ChooseMarketplaceSource
  ) {}

  async execute(options: AskMarketplaceSourceOptions): Promise<FrameworkSource> {
    const given = options.sourceFromCli;
    if (given !== undefined) {
      if (options.interactive && given.kind === "github" && given.ref === undefined) {
        return this.askVersion(given.repo);
      }
      return this.choose.pinNewest(given);
    }
    if (options.interactive) return this.askSource();
    throw new InputRequiredError(
      "--source remote|local is required in non-interactive mode. Use --source remote or --source local --path /abs/path."
    );
  }

  private async askSource(): Promise<FrameworkSource> {
    const kind = await this.prompter.select<"remote" | "local">("Select framework source:", [
      { name: "remote (fetch from GitHub marketplace — recommended)", value: "remote" },
      { name: "local (copy from local framework directory)", value: "local" },
    ]);
    if (kind === "remote") return this.askVersion(this.choose.remote().repo);
    const path = await this.prompter.input("Path to local framework directory:", "");
    return this.choose.local(path);
  }

  private async askVersion(repo: string): Promise<FrameworkSource> {
    const releases = await this.choose.releases(repo);
    const choices = [
      ...releases.map((tag, i) => ({
        name: i === 0 ? `${tag} (latest)` : tag,
        value: tag,
      })),
      { name: "HEAD (main branch tip — unreleased)", value: HEAD_CHOICE },
    ];
    const picked = await this.prompter.select<string>(
      "Select framework release to install:",
      choices
    );
    return this.choose.remote(repo, picked === HEAD_CHOICE ? undefined : picked);
  }
}
