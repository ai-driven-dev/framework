export const CATALOGUE_SEPARATOR = "@";

/** Whether a ref sits on the host name. */
export const isRefOnHost = (ref: string, hostName: string): boolean =>
  ref.endsWith(`${CATALOGUE_SEPARATOR}${hostName}`);

/** Whether a ref sits on one of the host names. */
export function refOnAnyHost(ref: string, hostNames: Iterable<string>): boolean {
  return [...hostNames].some((hostName) => isRefOnHost(ref, hostName));
}

/** The ref a plugin has on a host catalogue, which the host knows by its own name. */
export const refOnHostName = (plugin: string, hostName: string): string =>
  `${plugin}${CATALOGUE_SEPARATOR}${hostName}`;
