import type {
  RefreshMarketplace,
  RefreshMarketplaceRequest,
} from "../../contexts/distribution/application/refresh-marketplace.use-case.js";

export interface RefreshEntryResult {
  name: string;
  status: "ok" | "failed";
  error?: unknown;
}

export interface RefreshMarketplacesResult {
  results: readonly RefreshEntryResult[];
  failedCount: number;
}

/** Refreshing every registered marketplace, or the one named. */
export class RefreshMarketplaces {
  constructor(private readonly refresh: Pick<RefreshMarketplace, "targets" | "execute">) {}

  async execute(options: RefreshMarketplaceRequest): Promise<RefreshMarketplacesResult> {
    const results: RefreshEntryResult[] = [];
    for (const m of await this.refresh.targets(options)) {
      results.push(await this.refreshOne(options.projectRoot, m));
    }
    const failedCount = results.filter((r) => r.status === "failed").length;
    return { results, failedCount };
  }

  // @policy report-and-continue: a single failed marketplace must not abort the batch refresh;
  // each failure is reported through the result, never thrown.
  private async refreshOne(
    projectRoot: string,
    m: Parameters<RefreshMarketplace["execute"]>[1]
  ): Promise<RefreshEntryResult> {
    try {
      await this.refresh.execute(projectRoot, m);
      return { name: m.name, status: "ok" };
    } catch (err) {
      return { name: m.name, status: "failed", error: err };
    }
  }
}
