import type { Command } from "commander";
import type { AuthLevel, Credential } from "../../contexts/auth/contract/credential.js";
import { InputRequiredError } from "../../kernel/errors.js";
import { AIDD_DIR } from "../../kernel/paths.js";
import type { Prompter } from "../../kernel/ports/prompter.js";
import type { Deps, DepsFactory } from "../deps.js";
import { printAuthenticated, printAuthStatus, printLogoutResult } from "../display/auth-display.js";
import { ErrorHandler } from "../error-handler.js";
import type { CLIOutput } from "../output.js";
import { parseGlobalOptions } from "./global-options.js";

interface LoginOptions {
  gh: boolean;
  token?: string;
  level?: string;
}

function refuse(output: CLIOutput, message: string): void {
  output.error(message);
  process.exit(1);
}

function refuseInvalidOptions(options: LoginOptions, output: CLIOutput): void {
  if (options.gh && options.token) refuse(output, "--gh and --token are mutually exclusive.");
  if (!options.gh && !options.token && !process.stdout.isTTY) {
    refuse(output, "Use --gh or --token <value> in non-interactive mode.");
  }
  if (!options.level && !process.stdout.isTTY) {
    refuse(output, "Use --level <user|project> in non-interactive mode.");
  }
  if (options.level !== undefined && options.level !== "user" && options.level !== "project") {
    refuse(output, "--level must be 'user' or 'project'.");
  }
}

async function askLevel(prompter: Prompter, rawLevel: string | undefined): Promise<AuthLevel> {
  if (rawLevel !== undefined) return rawLevel as AuthLevel;
  return prompter.select<AuthLevel>("Storage level:", [
    { name: "User (~/.config/aidd/auth.json)", value: "user" },
    { name: `Project (${AIDD_DIR}/auth.json)`, value: "project" },
  ]);
}

async function askCredential(prompter: Prompter, options: LoginOptions): Promise<Credential> {
  if (options.gh) return { method: "external", provider: "gh" };
  if (options.token) return { method: "stored", token: options.token };
  const wantsPat = await prompter.confirm("Do you have a Personal Access Token?");
  if (!wantsPat) return { method: "external", provider: "gh" };
  const token = await prompter.input("Paste your GitHub Personal Access Token:");
  if (!token) throw new InputRequiredError("Token cannot be empty.");
  return { method: "stored", token };
}

/** An action that builds the dependencies, runs, and hands any failure to the error handler. */
function reportingErrors(
  program: Command,
  createDeps: DepsFactory,
  run: (deps: Deps, output: CLIOutput) => Promise<void>
): () => Promise<void> {
  return async () => {
    const { verbose, output, projectRoot } = parseGlobalOptions(program);
    const errorHandler = new ErrorHandler(output);
    try {
      await run(await createDeps(projectRoot, { verbose }, output), output);
    } catch (error) {
      errorHandler.handle(error);
    }
  };
}

export function registerAuthCommand(program: Command, createDeps: DepsFactory): void {
  const authCmd = program.command("auth").description("Manage authentication");
  authCmd.action(() => authCmd.help());

  authCmd
    .command("login")
    .description("Authenticate with GitHub")
    .option("--gh", "Use GitHub CLI token", false)
    .option("--token <value>", "Personal access token")
    .option("--level <user|project>", "Storage level (user or project)")
    .action(async (cmdOptions: LoginOptions) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      refuseInvalidOptions(cmdOptions, output);

      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const level = await askLevel(deps.prompter, cmdOptions.level);
        const credential = await askCredential(deps.prompter, cmdOptions);
        const result = await deps.logIn.execute({ credential, level });
        printAuthenticated(output, result.login, result.level);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  authCmd
    .command("logout")
    .description("Remove stored authentication")
    .action(
      reportingErrors(program, createDeps, async (deps, output) => {
        printLogoutResult(output, await deps.logOut.execute());
      })
    );

  authCmd
    .command("status")
    .description("Show authentication status")
    .action(
      reportingErrors(program, createDeps, async (deps, output) => {
        printAuthStatus(output, await deps.checkStatus.execute());
      })
    );
}
