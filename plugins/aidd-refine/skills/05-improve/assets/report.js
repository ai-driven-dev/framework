(() => {
  const promptMarker = "---";

  function formatCount(count, one, other) {
    const template = count === 1 ? one : other;
    return template ? template.replace("{count}", String(count)) : String(count);
  }

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
    const markerIndex = lines.findIndex((line) => line.trim() === promptMarker);
    lines.splice(markerIndex >= 0 ? markerIndex : lines.length, 0, ...generated);
    return lines.join("\n");
  }

  if (typeof module !== "undefined") module.exports = { composePrompt, formatCount };
  if (typeof document === "undefined") return;

  const state = { signal: "all", target: "all" };
  const report = document.querySelector("#report");
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
    count.textContent = formatCount(visible, report.dataset.labelResultOne, report.dataset.labelResultOther);
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
        button.textContent = button.dataset.labelSuccess || original;
      } catch {
        button.textContent = button.dataset.labelError || original;
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
    acceptedCount.textContent = formatCount(total, report.dataset.labelAcceptedOne, report.dataset.labelAcceptedOther);
  }

  document.querySelectorAll(".accept-input").forEach((input) => {
    input.addEventListener("change", () => {
      const finding = input.closest(".finding");
      finding.classList.toggle("is-accepted", input.checked);
      const label = finding.querySelector(".accept-toggle span");
      label.textContent = input.checked ? input.dataset.labelOn : input.dataset.labelOff;
      updatePrompt();
    });
  });

  document.querySelector("#copy-prompt").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(prompt.value);
      button.textContent = button.dataset.labelSuccess || original;
    } catch {
      prompt.focus();
      prompt.select();
      button.textContent = button.dataset.labelError || original;
    }
    window.setTimeout(() => { button.textContent = original; }, 1600);
  });

  document.querySelector("#print-report").addEventListener("click", () => window.print());
})();
