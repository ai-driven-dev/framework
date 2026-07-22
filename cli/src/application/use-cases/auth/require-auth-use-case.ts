import type { TokenProvider } from "../../../domain/ports/token-provider.js";
import { NotAuthenticatedError } from "../../errors.js";

export class RequireAuthUseCase {
  constructor(private readonly authReader: TokenProvider) {}

  async execute(): Promise<void> {
    if ((await this.authReader.resolve()) === null) {
      throw new NotAuthenticatedError();
    }
  }
}
