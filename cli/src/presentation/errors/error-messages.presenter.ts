import type * as auth from "../../contexts/auth/domain/auth.error.js";
import type { AiddError } from "../../shared/domain/shared.error.js";

type Classes<Module> = Module[keyof Module];
/** Every error class of the owners already moved here. */
type Catalogued = InstanceType<Classes<typeof auth>>;
type ByCode = { [Error in Catalogued as Error["code"]]: Error };

/** One entry says what its own error class carries; a method signature lets the table widen to any code. */
interface Words {
  say(error: AiddError): string;
}

const entries: { [Code in keyof ByCode]: (error: ByCode[Code]) => string } = {
  "auth-storage": (error) => error.detail,
  "gh-cli": (error) => error.detail,
};

/** What each catalogued error says, by its code. */
export const MESSAGES: Readonly<Record<string, Words["say"] | undefined>> = entries;
