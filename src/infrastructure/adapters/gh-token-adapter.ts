import { AuthenticationError } from "../../domain/errors.js";
import type { LoginVerifier } from "../../domain/ports/login-verifier.js";
import type { HttpClient } from "../http/http-client.js";

export class GhTokenAdapter implements LoginVerifier {
  constructor(private readonly http: HttpClient) {}

  async getLogin(token: string): Promise<string> {
    const response = await this.http.get("https://api.github.com/user", { token });
    const body = response.body as Record<string, unknown>;
    if (typeof body.login !== "string") throw new AuthenticationError("GitHub API");
    return body.login;
  }
}
