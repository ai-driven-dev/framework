import type { Command } from "commander";
import { GhCliAdapter } from "../../infrastructure/adapters/gh-cli-adapter.js";
import { GhTokenAdapter } from "../../infrastructure/adapters/gh-token-adapter.js";
import { AuthReader } from "../../infrastructure/auth/auth-reader.js";
import { AuthStorage } from "../../infrastructure/auth/auth-storage.js";
import { HttpClient } from "../../infrastructure/http/http-client.js";
import { ErrorHandler } from "../error-handler.js";
import { AuthLoginUseCase } from "../use-cases/auth-login-use-case.js";
import { AuthLogoutUseCase } from "../use-cases/auth-logout-use-case.js";
import { AuthStatusUseCase } from "../use-cases/auth-status-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

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
        const ghAdapter = new GhCliAdapter();
        const http = new HttpClient();
        const tokenVerifier = new GhTokenAdapter(http);

        let method: "gh" | "token" | undefined = cmdOptions.gh
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

        if (!method && process.stdout.isTTY) {
          const { InquirerPrompterAdapter } = await import(
            "../../infrastructure/adapters/prompter-adapter.js"
          );
          const prompter = new InquirerPrompterAdapter();
          method = await prompter.select<"gh" | "token">("Authentication method:", [
            { name: "GitHub CLI (gh auth token)", value: "gh" },
            { name: "Personal Access Token", value: "token" },
          ]);
        }

        const loginVerifier = method === "gh" ? ghAdapter : tokenVerifier;
        const useCase = new AuthLoginUseCase(storage, loginVerifier, ghAdapter);

        const { InquirerPrompterAdapter, SilentPrompterAdapter } = await import(
          "../../infrastructure/adapters/prompter-adapter.js"
        );
        const prompter = process.stdout.isTTY
          ? new InquirerPrompterAdapter()
          : new SilentPrompterAdapter();

        const result = await useCase.execute({
          method: method as "gh" | "token",
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
        const ghAdapter = new GhCliAdapter();
        const http = new HttpClient();
        const tokenVerifier = new GhTokenAdapter(http);
        const authReader = new AuthReader(storage, projectRoot, undefined, ghAdapter);

        const context = await authReader.resolveContext(projectRoot);
        if (!context) {
          output.info("Not authenticated. Run aidd auth login");
          process.exit(1);
          return;
        }

        const verifier = context.method === "gh" ? ghAdapter : tokenVerifier;
        const useCase = new AuthStatusUseCase();
        const result = await useCase.execute({ ...context, verifier });

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
