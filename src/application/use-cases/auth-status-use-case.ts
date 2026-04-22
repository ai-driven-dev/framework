import type { LoginVerifier } from "../../domain/ports/login-verifier.js";

interface AuthStatusOptions {
  token: string;
  method: "gh" | "token";
  level: "user" | "project";
  verifier: LoginVerifier;
}

type AuthStatusResult =
  | { valid: false; reason: string }
  | { valid: true; method: "gh" | "token"; level: "user" | "project"; login: string };

export class AuthStatusUseCase {
  async execute(options: AuthStatusOptions): Promise<AuthStatusResult> {
    try {
      const login = await options.verifier.getLogin(options.token);
      return { valid: true, method: options.method, level: options.level, login };
    } catch (err) {
      return {
        valid: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
