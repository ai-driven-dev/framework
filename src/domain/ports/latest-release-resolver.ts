export interface LatestReleaseResolver {
  resolveLatest(repo: string): Promise<string | null>;
}
