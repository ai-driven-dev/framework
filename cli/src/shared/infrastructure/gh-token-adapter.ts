import { AuthenticationError } from "../../kernel/errors.js";
import type { HttpGet } from "../ports/http-get.js";

export class GhTokenAdapter {
  constructor(private readonly http: HttpGet) {}

  async verifyToken(token: string): Promise<string> {
    const response = await this.http.get("https://api.github.com/user", { token }).catch(() => {
      // HTTP errors may carry request credentials; expose only the authentication failure.
      throw new AuthenticationError("GitHub API");
    });
    const body = response.body;
    if (
      response.statusCode < 200 ||
      response.statusCode >= 300 ||
      typeof body !== "object" ||
      body === null ||
      !("login" in body) ||
      typeof body.login !== "string" ||
      body.login.trim().length === 0
    ) {
      throw new AuthenticationError("GitHub API");
    }
    return body.login;
  }
}
