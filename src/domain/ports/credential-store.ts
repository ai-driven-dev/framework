import type { AuthCredential, AuthLevel } from "../models/auth.js";

export type AuthLogoutHint = "external-provider-cleanup";

export interface AuthLoginResult {
  login: string;
  level: AuthLevel;
}

export interface AuthStatus {
  login: string;
  level: AuthLevel;
}

export type AuthLogoutResult =
  | { found: false }
  | { found: true; level: AuthLevel; hint?: AuthLogoutHint };

export interface CredentialStore {
  login(credential: AuthCredential, level: AuthLevel): Promise<AuthLoginResult>;
  status(): Promise<AuthStatus>;
  logout(): Promise<AuthLogoutResult>;
}
