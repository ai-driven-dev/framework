import { CATALOG } from "./catalog-error-messages.presenter.js";
import { CORE } from "./core-error-messages.presenter.js";
import type {
  CatalogOwners,
  InstallationOwners,
  MessagesOf,
  PresentationOwners,
  SharedOwners,
  Words,
} from "./error-messages.types.js";
import { INSTALLATION } from "./installation-error-messages.presenter.js";
import { PRESENTATION } from "./presentation-error-messages.presenter.js";

/** What each catalogued error says, by its code: a code a table lacks is a type error here. */
export const MESSAGES: Readonly<Record<string, Words["say"]>> = {
  ...CORE,
  ...INSTALLATION,
  ...CATALOG,
  ...PRESENTATION,
} satisfies MessagesOf<SharedOwners | InstallationOwners | CatalogOwners | PresentationOwners>;
