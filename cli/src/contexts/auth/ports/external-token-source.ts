/** Where a token comes from when the credential names a provider instead of carrying one. */
export interface ExternalTokenSource {
  read(): string | null;
}
