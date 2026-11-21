/** A catalogue error carries a stable kebab-case `code`, the key a presentation table maps to words. */
export abstract class AiddError extends Error {
  abstract readonly code: string;
}
