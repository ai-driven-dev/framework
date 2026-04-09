import type { Command } from "commander";
import { AuthenticationError } from "../../domain/errors.js";
import { GhCliAdapter } from "../../infrastructure/adapters/gh-cli-adapter.js";
import { AuthReader } from "../../infrastructure/auth/auth-reader.js";
import { AuthStorage } from "../../infrastructure/auth/auth-storage.js";
import { HttpClient } from "../../infrastructure/http/http-client.js";
import { ErrorHandler } from "../error-handler.js";
import { AuthLoginUseCase } from "../use-cases/auth-login-use-case.js";
import { AuthLogoutUseCase } from "../use-cases/auth-logout-use-case.js";
import { AuthStatusUseCase } from "../use-cases/auth-status-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

function makeHttpGet(http: HttpClient) {
  return async (url: string, token: string): Promise<{ login: string }> => {
    const response = await http.get(url, { token });
    const body = response.body as Record<string, unknown>;
    if (typeof body.login !== "string") {
      throw new AuthenticationError("GitHub API");
    }
    return { login: body.login };
  };
}

export function registerAuthCommand(program: Command): void {
  const authCmd = program.command("auth").description("Manage authentication");
  authCmd.action(() => authCmd.help());

  authCmd
    .command("login")
    .description("Authenticate with GitHub")
    .option("--gh", "Use GitHub CLI token", false)
    .option("--token <value>", "Personal access token")
    .option("--level <user|project>", "Storage level (user or project)")
    .action(async (cmdOptions: { gh: boolean; token?: string; level?: string }) => {
      const { output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      try {
        const storage = new AuthStorage();
        const http = new HttpClient();
        const useCase = new AuthLoginUseCase(storage, makeHttpGet(http), new GhCliAdapter());

        const method: "gh" | "token" | undefined = cmdOptions.gh
          ? "gh"
          : cmdOptions.token
            ? "token"
            : undefined;

        const level = cmdOptions.level as "user" | "project" | undefined;

        if (!method && !process.stdout.isTTY) {
          output.error("Use --gh or --token <value> in non-interactive mode.");
          process.exit(1);
        }

        if (!level && !process.stdout.isTTY) {
          output.error("Use --level <user|project> in non-interactive mode.");
          process.exit(1);
        }

        const { InquirerPrompterAdapter, SilentPrompterAdapter } = await import(
          "../../infrastructure/adapters/prompter-adapter.js"
        );
        const prompter = process.stdout.isTTY
          ? new InquirerPrompterAdapter()
          : new SilentPrompterAdapter();

        const result = await useCase.execute({
          method,
          token: cmdOptions.token,
          level,
          projectRoot,
          interactive: process.stdout.isTTY,
          prompter,
        });

        output.success(`Authenticated as ${result.login} (${result.method}, ${result.level})`);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  authCmd
    .command("logout")
    .description("Remove stored authentication")
    .action(async () => {
      const { output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      try {
        const storage = new AuthStorage();
        const useCase = new AuthLogoutUseCase(storage);
        const result = await useCase.execute({ projectRoot });

        if (!result.found) {
          output.info("Not authenticated.");
          return;
        }

        if (result.ghHint) {
          output.info(result.ghHint);
        }

        output.success(`Logged out (${result.method}, ${result.level})`);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  authCmd
    .command("status")
    .description("Show authentication status")
    .action(async () => {
      const { output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      try {
        const storage = new AuthStorage();
        const authReader = new AuthReader(storage, projectRoot, undefined, new GhCliAdapter());
        const http = new HttpClient();
        const useCase = new AuthStatusUseCase(authReader, storage);

        const result = await useCase.execute({
          projectRoot,
          httpGet: makeHttpGet(http),
        });

        if (!result.authenticated) {
          output.info("Not authenticated. Run aidd auth login");
          process.exit(1);
        }

        if (!result.valid) {
          output.error(`Token is invalid or expired: ${result.reason}`);
          process.exit(1);
        }

        output.success(`Authenticated as ${result.login} (${result.method}, ${result.level})`);
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
