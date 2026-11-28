/** What a host's `plugin list --json` says is installed, read one way for every script that asks. */

function json(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const array = (value) => (Array.isArray(value) ? value : []);

/** Each host's own shape, as captured, turned into `{ name, marketplace, enabled, version }`. */
const LISTS = {
  claude: (data) =>
    array(data).map(({ id, scope, enabled, version }) => {
      const [name, marketplace] = String(id).split("@");
      return { name, marketplace, scope, enabled, version };
    }),
  codex: (data) =>
    array(data?.installed).map(({ name, marketplaceName, installed, enabled, version }) => ({
      name,
      marketplace: marketplaceName,
      enabled: installed === true && enabled === true,
      version,
    })),
  copilot: (data) =>
    array(data).map(({ name, marketplace, enabled, version }) => ({ name, marketplace, enabled, version })),
};

function installedPlugins(host, text) {
  return LISTS[host](json(text));
}

module.exports = { installedPlugins, json };
