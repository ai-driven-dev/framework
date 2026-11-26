export interface IdentityVerifier {
  verifyToken(token: string): Promise<string>;
}
