(() => {
  const promptAnchor = "Changements acceptés :";

  function composePrompt(value, accepted, savedLines = new Map(), knownIds = new Set(accepted.map(({ id }) => id))) {
    const generatedPattern = /^- \[([^\]]+)\] /;
    const original = value.split("\n");

    for (const line of original) {
      const match = line.match(generatedPattern);
      if (match && knownIds.has(match[1])) savedLines.set(match[1], line);
    }

    const lines = original.filter((line) => {
      const match = line.match(generatedPattern);
      return !match || !knownIds.has(match[1]);
    });
    const generated = accepted.map(({ id, prompt }) => savedLines.get(id) || `- [${id}] ${prompt}`);
    const anchorIndex = lines.findIndex((line) => line.trim() === promptAnchor);
    lines.splice(anchorIndex >= 0 ? anchorIndex + 1 : lines.length, 0, ...generated);
    return lines.join("\n");
  }

  if (typeof module !== "undefined") module.exports = { composePrompt };
  if (typeof document === "undefined") return;

  const state = { signal: "all", target: "all" };
  const findings = [...document.querySelectorAll(".finding")];
  const count = document.querySelector("#result-count");
  const empty = document.querySelector("#empty-state");
  const prompt = document.querySelector("#execution-prompt");
  const acceptedCount = document.querySelector("#accepted-count");
  const savedPromptLines = new Map();
  const findingIds = new Set(findings.map((finding) => finding.querySelector(".finding-id").textContent.trim()));

  function render() {
    let visible = 0;
    for (const finding of findings) {
      const matchesSignal = state.signal === "all" || finding.dataset.signal === state.signal;
      const matchesTarget = state.target === "all" || finding.dataset.target === state.target;
      finding.hidden = !(matchesSignal && matchesTarget);
      if (!finding.hidden) visible += 1;
    }
    count.textContent = `${visible} recommandation${visible === 1 ? "" : "s"}`;
    empty.hidden = visible !== 0;
  }

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.filter;
      state[kind] = button.dataset.value;
      document.querySelectorAll(`[data-filter="${kind}"]`).forEach((candidate) => {
        candidate.setAttribute("aria-pressed", String(candidate === button));
      });
      render();
    });
  });

  document.querySelectorAll(".copy-path").forEach((button) => {
    button.addEventListener("click", async () => {
      const original = button.textContent;
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = "Copié";
      } catch {
        button.textContent = "Copie indisponible";
      }
      window.setTimeout(() => { button.textContent = original; }, 1400);
    });
  });

  function updatePrompt() {
    const accepted = findings.filter((finding) => finding.querySelector(".accept-input").checked);
    const entries = accepted.map((finding) => ({
      id: finding.querySelector(".finding-id").textContent.trim(),
      prompt: finding.querySelector(".accept-input").dataset.prompt,
    }));
    prompt.value = composePrompt(prompt.value, entries, savedPromptLines, findingIds);

    const total = accepted.length;
    acceptedCount.textContent = `${total} recommandation${total === 1 ? "" : "s"} acceptée${total === 1 ? "" : "s"}`;
  }

  document.querySelectorAll(".accept-input").forEach((input) => {
    input.addEventListener("change", () => {
      const finding = input.closest(".finding");
      finding.classList.toggle("is-accepted", input.checked);
      finding.querySelector(".accept-toggle span").textContent = input.checked ? "Accepté" : "Accepter";
      updatePrompt();
    });
  });

  document.querySelector("#copy-prompt").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(prompt.value);
      button.textContent = "Prompt copié";
    } catch {
      prompt.focus();
      prompt.select();
      button.textContent = "Texte sélectionné";
    }
    window.setTimeout(() => { button.textContent = original; }, 1600);
  });

  document.querySelector("#print-report").addEventListener("click", () => window.print());
})();
