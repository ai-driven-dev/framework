export interface LoginVerifier {
  getLogin(token: string): Promise<string>;
}
