/** Where a host's plugin server listens and the token that opens it. */
export interface ServerEndpoint {
  readonly baseUrl: string;
  readonly token: string;
}

/** The endpoint a host printed on starting, read by the pattern its declaration gives: the address
 * is its first group and the token its second. `undefined` until the whole banner is there, so a
 * caller reading a stream asks again as it grows. */
export function serverEndpointIn(output: string, pattern: string): ServerEndpoint | undefined {
  const [, baseUrl, token] = new RegExp(pattern).exec(output) ?? [];
  return baseUrl === undefined || token === undefined ? undefined : { baseUrl, token };
}
