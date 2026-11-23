import type { Command } from "commander";
import type { CheckStatus } from "../../contexts/auth/application/check-status.use-case.js";
import type { LogIn } from "../../contexts/auth/application/log-in.use-case.js";
import type { LogOut } from "../../contexts/auth/application/log-out.use-case.js";
import type { AuthLevel, Credential } from "../../contexts/auth/contract/credential.js";
import { AIDD_DIR } from "../../shared/domain/layout/aidd-layout.js";
import {
  printAuthenticated,
  printAuthStatus,
  printLogoutResult,
} from "../presenters/auth.presenter.js";
import type { Output } from "../terminal/output.model.js";
import { type ContainerFactory, parseGlobalOptions } from "./menu/global-options.controller.js";

/** What the login questions read of the prompter. */
interface Prompting {
  select<T>(message: string, choices: { name: string; value: T }[]): Promise<T>;
  confirm(message: string, defaultValue?: boolean): Promise<boolean>;
  input(message: string, defaultValue?: string): Promise<string>;
}

/** What this command reads of the container. */
export interface AuthContainer {
  shared: {
    prompter: Prompting;
    logIn: Pick<LogIn, "execute">;
    logOut: Pick<LogOut, "execute">;
    checkStatus: Pick<CheckStatus, "execute">;
  };
}

type Factory = ContainerFactory<AuthContainer>;

interface LoginOptions {
  gh: boolean;
  token?: string;
  level?: string;
}

function refuse(output: Output, message: string): void {
  output.error(message);
  output.exit(1);
}

function refuseInvalidOptions(options: LoginOptions, output: Output): void {
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

async function askLevel(prompter: Prompting, rawLevel: string | undefined): Promise<AuthLevel> {
  if (rawLevel === "user" || rawLevel === "project") return rawLevel;
  return prompter.select<AuthLevel>("Storage level:", [
    { name: "User (~/.config/aidd/auth.json)", value: "user" },
    { name: `Project (${AIDD_DIR}/auth.json)`, value: "project" },
  ]);
}

async function askCredential(prompter: Prompting, options: LoginOptions): Promise<Credential> {
  if (options.gh) return { method: "external", provider: "gh" };
  if (options.token) return { method: "stored", token: options.token };
  const wantsPat = await prompter.confirm("Do you have a Personal Access Token?");
  if (!wantsPat) return { method: "external", provider: "gh" };
  const token = await prompter.input("Paste your GitHub Personal Access Token:");
  return { method: "stored", token };
}

/** An action that builds the dependencies, runs, and hands any failure to the error handler. */
function reportingErrors(
  program: Command,
  containerOf: Factory,
  run: (container: AuthContainer, output: Output) => Promise<void>
): () => Promise<void> {
  return async () => {
    const { verbose, output, projectRoot } = parseGlobalOptions(program);
    await run(await containerOf(projectRoot, { verbose }, output), output);
  };
}

function registerLogin(program: Command, authCmd: Command, containerOf: Factory): void {
  authCmd
    .command("login")
    .description("Authenticate with GitHub")
    .option("--gh", "Use GitHub CLI token", false)
    .option("--token <value>", "Personal access token")
    .option("--level <user|project>", "Storage level (user or project)")
    .action(async (cmdOptions: LoginOptions) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);

      refuseInvalidOptions(cmdOptions, output);

      const container = await containerOf(projectRoot, { verbose }, output);
      const { prompter, logIn } = container.shared;
      const level = await askLevel(prompter, cmdOptions.level);
      const credential = await askCredential(prompter, cmdOptions);
      const result = await logIn.execute({ credential, level });
      printAuthenticated(output, result.login, result.level);
    });
}

export function registerAuthCommand(program: Command, containerOf: Factory): void {
  const authCmd = program.command("auth").description("Manage authentication");
  authCmd.action(() => authCmd.help());

  registerLogin(program, authCmd, containerOf);

  authCmd
    .command("logout")
    .description("Remove stored authentication")
    .action(
      reportingErrors(program, containerOf, async (container, output) => {
        printLogoutResult(output, await container.shared.logOut.execute());
      })
    );

  authCmd
    .command("status")
    .description("Show authentication status")
    .action(
      reportingErrors(program, containerOf, async (container, output) => {
        printAuthStatus(output, await container.shared.checkStatus.execute());
      })
    );
}
