import { homedir } from "node:os";
import { BuildMenu } from "../orchestration/menu/build-menu.use-case.js";
import { MenuLoop } from "../orchestration/menu/menu-loop.use-case.js";
import type { CommandRunner, Pause } from "../orchestration/menu/menu-ports.js";
import { projectSetupOf, wireInstallation } from "./installation.js";
import { wireClean } from "./orchestration/clean.js";
import { wireDoctor } from "./orchestration/doctor.js";
import { wireGlobal } from "./orchestration/global.js";
import { wireMarketplace } from "./orchestration/marketplace.js";
import { wirePlugin } from "./orchestration/plugin.js";
import { wireAgentModels, wireSetup } from "./orchestration/setup.js";
import { wireRecipes } from "./recipes.js";
import { type BaseOptions, currentVersion, wireBase } from "./shared.js";
import { wireTelemetry } from "./telemetry.js";
import { wireUpdate } from "./update.js";

/** Each context's wiring is built the first time it is read, then handed back unchanged. */
function memoized<T extends object>(build: () => T): () => T {
  let built: T | undefined;
  return () => (built ??= build());
}

/** The wirings the others build on: the shared adapters, installation, and the marketplace and
 * plugin areas. */
function foundationOf({ projectRoot, verbose, token, output, tools }: BaseOptions) {
  const shared = memoized(() => ({
    ...wireBase({ projectRoot, verbose, token, output, tools }),
    version: currentVersion(),
  }));
  const installation = memoized(() => wireInstallation(shared()));
  const update = memoized(() => {
    const { logger, http, fs, environment, tokenProvider, currentVersionProvider } = shared();
    return wireUpdate({
      logger,
      http,
      fs,
      environment,
      tokenProvider,
      version: currentVersionProvider,
    });
  });
  const marketplace = memoized(() => wireMarketplace(shared(), installation()));
  const plugin = memoized(() => wirePlugin(shared(), installation()));
  return { shared, installation, update, marketplace, plugin };
}

type Foundation = ReturnType<typeof foundationOf>;

/** The wirings of the scenarios a command runs, built over the foundation. */
function scenariosOf({ shared, installation, marketplace, plugin }: Foundation) {
  const global = memoized(() =>
    wireGlobal({
      base: shared(),
      installation: installation(),
      marketplace: marketplace(),
      plugin: plugin(),
    })
  );
  const setup = memoized(() =>
    wireSetup({
      base: shared(),
      installation: installation(),
      plugin: plugin(),
      marketplace: marketplace(),
      global: global(),
    })
  );
  const agentModels = memoized(() => ({
    setAgentModels: wireAgentModels({
      base: shared(),
      installation: installation(),
      plugin: plugin(),
      marketplace: marketplace(),
    }),
  }));
  const doctor = memoized(() => wireDoctor(shared(), installation()));
  const clean = memoized(() => wireClean(shared(), installation()));
  const recipes = memoized(() => wireRecipes());
  const telemetry = memoized(() => wireTelemetry(homedir, shared().prompter));
  return { global, setup, agentModels, doctor, clean, recipes, telemetry };
}

/** The wiring of one project root and token. Every context is a getter that builds it on first
 * read, so a command pays only for the contexts it reads and two containers share nothing. */
export class Container {
  private readonly foundation: Foundation;
  private readonly scenarios: ReturnType<typeof scenariosOf>;

  constructor(private readonly options: BaseOptions) {
    this.foundation = foundationOf(options);
    this.scenarios = scenariosOf(this.foundation);
  }

  get shared() {
    return this.foundation.shared();
  }
  get installation() {
    return this.foundation.installation();
  }
  get update() {
    return this.foundation.update();
  }
  get marketplace() {
    return this.foundation.marketplace();
  }
  get plugin() {
    return this.foundation.plugin();
  }
  get global() {
    return this.scenarios.global();
  }
  get setup() {
    return this.scenarios.setup();
  }
  get agentModels() {
    return this.scenarios.agentModels();
  }
  get doctor() {
    return this.scenarios.doctor();
  }
  get clean() {
    return this.scenarios.clean();
  }
  get telemetry() {
    return this.scenarios.telemetry();
  }
  get recipes() {
    return this.scenarios.recipes();
  }

  /** The menu loop of this project, given the terminal the loop runs commands on. */
  menu(terminal: { runner: CommandRunner; pause: Pause }): MenuLoop {
    const { prompter, manifestRepo } = this.shared;
    const menu = new BuildMenu(projectSetupOf(manifestRepo), prompter, this.options.tools);
    return new MenuLoop(menu, terminal.runner, terminal.pause);
  }
}

export function createContainer(options: BaseOptions): Container {
  return new Container(options);
}
