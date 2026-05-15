import type { Command } from "commander";
import type { AuthCredential, AuthLevel } from "../../domain/models/auth.js";
import { AIDD_DIR } from "../../domain/models/paths.js";
import { AuthProviderAdapter } from "../../infrastructure/adapters/auth-provider-adapter.js";
import { AuthStorage } from "../../infrastructure/adapters/auth-storage.js";
import { GhCliAdapter } from "../../infrastructure/adapters/gh-cli-adapter.js";
import { GhTokenAdapter } from "../../infrastructure/adapters/gh-token-adapter.js";
import { HttpClient } from "../../infrastructure/adapters/http-client.js";
import { InquirerPrompterAdapter } from "../../infrastructure/adapters/prompter-adapter.js";
import { ErrorHandler } from "../error-handler.js";
import { InputRequiredError } from "../errors.js";
import { AuthLoginUseCase } from "../use-cases/auth/auth-login-use-case.js";
import { AuthLogoutUseCase } from "../use-cases/auth/auth-logout-use-case.js";
import { AuthStatusUseCase } from "../use-cases/auth/auth-status-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

function buildAuthProvider(projectRoot: string): AuthProviderAdapter {
  const storage = new AuthStorage();
  const http = new HttpClient();
  const externalProviders = new Map([["gh", new GhCliAdapter()]]);
  return new AuthProviderAdapter(storage, externalProviders, new GhTokenAdapter(http), projectRoot);
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

      if (cmdOptions.gh && cmdOptions.token) {
        output.error("--gh and --token are mutually exclusive.");
        process.exit(1);
      }
      if (!cmdOptions.gh && !cmdOptions.token && !process.stdout.isTTY) {
        output.error("Use --gh or --token <value> in non-interactive mode.");
        process.exit(1);
      }
      if (!cmdOptions.level && !process.stdout.isTTY) {
        output.error("Use --level <user|project> in non-interactive mode.");
        process.exit(1);
      }
      const rawLevel = cmdOptions.level;
      if (rawLevel !== undefined && rawLevel !== "user" && rawLevel !== "project") {
        output.error("--level must be 'user' or 'project'.");
        process.exit(1);
      }

      try {
        const prompter = new InquirerPrompterAdapter();
        const level: AuthLevel =
          (rawLevel as AuthLevel) ??
          (await prompter.select<AuthLevel>("Storage level:", [
            { name: "User (~/.config/aidd/auth.json)", value: "user" },
            { name: `Project (${AIDD_DIR}/auth.json)`, value: "project" },
          ]));

        let credential: AuthCredential;
        if (cmdOptions.gh) {
          credential = { method: "external", provider: "gh" };
        } else if (cmdOptions.token) {
          credential = { method: "stored", token: cmdOptions.token };
        } else {
          const wantsPat = await prompter.confirm("Do you have a Personal Access Token?");
          if (!wantsPat) {
            credential = { method: "external", provider: "gh" };
          } else {
            const token = await prompter.input("Paste your GitHub Personal Access Token:");
            if (!token) throw new InputRequiredError("Token cannot be empty.");
            credential = { method: "stored", token };
          }
        }

        const result = await new AuthLoginUseCase(buildAuthProvider(projectRoot)).execute({
          credential,
          level,
        });
        output.success(`Authenticated as ${result.login} (${result.level})`);
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
        const result = await new AuthLogoutUseCase(buildAuthProvider(projectRoot)).execute();

        if (!result.found) {
          output.info("Not authenticated.");
          return;
        }

        if (result.hint === "external-provider-cleanup") {
          output.info(
            "To fully logout, run the external provider's logout command (e.g. gh auth logout)."
          );
        }

        output.success(`Logged out (${result.level})`);
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
        const result = await new AuthStatusUseCase(buildAuthProvider(projectRoot)).execute();
        if (!result.authenticated) {
          output.info("Not authenticated.");
          return;
        }
        output.success(`Authenticated as ${result.login} (${result.level})`);
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
