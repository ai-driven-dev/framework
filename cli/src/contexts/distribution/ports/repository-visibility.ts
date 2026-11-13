export interface RepositoryVisibility {
  /** A private or missing repository answers 404 unauthenticated; any other failure
   * (network, rate-limit) resolves true, so a public user is never wrongly gated. */
  isRepoPublic(repo: string): Promise<boolean>;
}
