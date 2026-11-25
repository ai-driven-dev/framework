// The five steps of the method and the categories of the elements, decided from the records alone:
// which step holds a record, which category an element shows under, and what of a record still
// awaits review. Pure: the showcase draws from these, nothing here reads a file.
const { fm, stateVerdict, reviewStatesOf } = require("./model.cjs");

// Display order: what a journey strings together comes last.
const STEPS = ["identity", "foundations", "components", "screens", "journeys"];
const CATEGORIES = ["input", "action", "display", "navigation", "group", "asset"];
const FALLBACK_STEP = "identity";
const FALLBACK_CATEGORY = "group";

const STEP_OF_KIND = { journey: "journeys", brand: "identity", system: "foundations", atom: "components", molecule: "components", organism: "components", asset: "components", wireframe: "screens", screen: "screens" };

const ROLES = {
  input: ["textbox", "searchbox", "search", "combobox", "listbox", "option", "radiogroup", "radio", "checkbox", "switch", "slider", "spinbutton"],
  action: ["button", "link", "menuitem"],
  display: ["status", "alert", "img", "figure", "list", "listitem", "table", "grid", "row", "cell", "progressbar", "meter", "tooltip", "note", "heading", "article", "feed", "log", "timer"],
  navigation: ["navigation", "tablist", "tab", "menu", "menubar", "tree", "treegrid", "toolbar", "banner", "contentinfo"],
};

/** The step that holds a record, by its kind. */
const stepOf = (record) => STEP_OF_KIND[fm(record).kind] ?? FALLBACK_STEP;

/** The category an element shows under: an asset by its kind, any other by its ARIA role, `group` for a role no table names or none. */
function categoryOf(record) {
  if (fm(record).kind === "asset") return "asset";
  const role = String(fm(record).role ?? "").trim().toLowerCase();
  return Object.keys(ROLES).find((category) => ROLES[category].includes(role)) ?? FALLBACK_CATEGORY;
}

/** The step a set of variants belongs to: that of its first variant's first file path, `identity` when it has none. */
function setStepOf(set) {
  const first = set.variants?.[0]?.files?.[0]?.path ?? "";
  if (/^(wireframes|screens)\//.test(first)) return "screens";
  if (first.startsWith("components/")) return "components";
  if (first === "system.md" || first.startsWith("tokens.")) return "foundations";
  return FALLBACK_STEP;
}

/** The states of a record with no ok or revise at its current version, in the record's order. The status is not read. */
const awaitingOf = (rows, record) => reviewStatesOf(record).filter((state) => {
  const now = stateVerdict(rows, record, state);
  return !now || (now.Verdict !== "ok" && now.Verdict !== "revise");
});

module.exports = { STEPS, CATEGORIES, stepOf, categoryOf, setStepOf, awaitingOf };
