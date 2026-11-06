/** Remove URL userinfo before using a URL in a Git remote, cache key or diagnostic. */
export function withoutCredentials(url: string): string {
  if (!/^https?:\/\//i.test(url)) return url;
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return url.replace(/^(https?:\/\/)[^/]*@/i, "$1");
  }
}

export function gitHttpAuthentication(
  url: string,
  token: string | undefined
): { url: string; authorization?: string } {
  if (!/^https?:\/\//i.test(url)) return { url };
  const parsed = new URL(url);
  let credentials: string | undefined;
  if (parsed.username || parsed.password) {
    credentials = `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`;
  } else if (
    token &&
    parsed.protocol === "https:" &&
    parsed.hostname.toLowerCase() === "github.com"
  ) {
    credentials = `x-access-token:${token}`;
  }
  return {
    url: withoutCredentials(url),
    ...(credentials === undefined
      ? {}
      : { authorization: `Authorization: Basic ${Buffer.from(credentials).toString("base64")}` }),
  };
}
