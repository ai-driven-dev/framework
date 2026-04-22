export interface LoginVerifier {
  verify(token: string): Promise<string>;
}
