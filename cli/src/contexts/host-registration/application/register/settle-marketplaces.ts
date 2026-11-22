import type { BuiltCatalogs } from "../../contract/built-catalogs.js";
import type { ClaimsView } from "../../contract/claims-view.js";
import { judgeRegistration } from "../../domain/policy/registration-policy.js";
import { recordedMarketplaces } from "../../domain/record/registration-record.js";
import { registerMarketplace, registrationOf } from "./marketplace/register-marketplace.js";
import { nativeCatalogProof } from "./native-catalog-proof.js";
import type { RegisteredMarketplace } from "./registration-outcome.js";
import type { RegistrationRun, RegistrationSubject } from "./registration-run.js";

/** Every marketplace a run knows, how each is built, and what this project recorded earlier. */
export interface SettleRequest<M extends RegistrationSubject> {
  readonly marketplaces: readonly M[];
  readonly claims: ClaimsView;
  readonly build: BuiltCatalogs<M>;
}

export interface SettledMarketplaces {
  readonly marketplaces: readonly RegisteredMarketplace[];
  readonly preservedMarketplaces: readonly RegisteredMarketplace[];
  readonly catalogClaims: readonly RegisteredMarketplace[];
  readonly addedHostNames: ReadonlySet<string>;
  /** A marketplace whose build failed was warned about and left unregistered this run. */
  readonly buildFailed: boolean;
}

interface Settling {
  readonly marketplaces: RegisteredMarketplace[];
  readonly preservedMarketplaces: RegisteredMarketplace[];
  readonly catalogClaims: RegisteredMarketplace[];
  readonly addedHostNames: Set<string>;
  buildFailed: boolean;
}

interface Scene<M extends RegistrationSubject> {
  readonly build: BuiltCatalogs<M>;
  readonly recorded: readonly RegisteredMarketplace[] | undefined;
  readonly settling: Settling;
}

// Every known marketplace, never only the ones a plugin points at: declaring a marketplace
// and installing a plugin from it are two acts. Measured against the real `claude` binary -
// a project with two registered marketplaces and no plugin was told about neither.
export async function settleMarketplaces<M extends RegistrationSubject>(
  run: RegistrationRun,
  request: SettleRequest<M>
): Promise<SettledMarketplaces> {
  const settling: Settling = {
    marketplaces: [],
    preservedMarketplaces: [],
    catalogClaims: [],
    addedHostNames: new Set(),
    buildFailed: false,
  };
  const scene = {
    build: request.build,
    recorded: recordedMarketplaces(request.claims.recorded),
    settling,
  };
  for (const marketplace of request.marketplaces) await settleOne(run, marketplace, scene);
  return settling;
}

async function settleOne<M extends RegistrationSubject>(
  run: RegistrationRun,
  marketplace: M,
  scene: Scene<M>
): Promise<void> {
  const { settling } = scene;
  const builtDir = await scene.build(marketplace);
  if (builtDir === null) settling.buildFailed = true;
  else {
    const claim = await registerMarketplace(run, {
      marketplace,
      builtDir,
      catalogClaims: settling.catalogClaims,
    });
    if (claim !== undefined)
      return keepClaim(settling, registrationOf(marketplace.name, claim), claim);
  }
  await keepEarlier(run, marketplace.name, scene);
}

function keepClaim(
  settling: Settling,
  entry: RegisteredMarketplace,
  claim: { readonly hostName: string; readonly addedThisRun?: true }
): void {
  settling.marketplaces.push(entry);
  settling.catalogClaims.push(entry);
  if (claim.addedThisRun === true) settling.addedHostNames.add(claim.hostName);
}

/** A marketplace this run did not register keeps what the project recorded for it, unless the
 * host's proof now refuses it. */
async function keepEarlier<M extends RegistrationSubject>(
  run: RegistrationRun,
  alias: string,
  scene: Scene<M>
): Promise<void> {
  const earlier = scene.recorded?.find((m) => m.alias === alias);
  if (earlier === undefined) return;
  const proof = await nativeCatalogProof(run, earlier.hostName);
  const proceeds = judgeRegistration({ intent: "register", ...proof }).outcome === "proceed";
  const { marketplaces, preservedMarketplaces } = scene.settling;
  (proceeds ? marketplaces : preservedMarketplaces).push(earlier);
}
