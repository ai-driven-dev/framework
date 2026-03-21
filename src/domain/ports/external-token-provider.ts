export interface ExternalTokenProvider {
  resolve(): string | null;
}
