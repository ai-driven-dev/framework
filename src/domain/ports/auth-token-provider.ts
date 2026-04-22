export interface AuthTokenProvider {
  resolve(): Promise<string | null>;
}
