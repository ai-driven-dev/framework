import type { AuthTokenProvider } from "../../domain/ports/auth-token-provider.js";
import { NotAuthenticatedError } from "../errors.js";

export class RequireAuthUseCase {
  constructor(private readonly authReader: AuthTokenProvider) {}

  async execute(): Promise<void> {
    if ((await this.authReader.resolve()) === null) {
      throw new NotAuthenticatedError();
    }
  }
}
