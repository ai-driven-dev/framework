(() => {
  const state = { signal: "all", target: "all" };
  const findings = [...document.querySelectorAll(".finding")];
  const count = document.querySelector("#result-count");
  const empty = document.querySelector("#empty-state");
  const prompt = document.querySelector("#execution-prompt");
  const acceptedCount = document.querySelector("#accepted-count");
  const promptAnchor = "Changements acceptés :";
  const closingPrompt = "Une fois le travail validé";

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

  function updatePrompt(changedFinding) {
    const accepted = findings.filter((finding) => finding.querySelector(".accept-input").checked);
    const changedInput = changedFinding.querySelector(".accept-input");
    const id = changedFinding.querySelector(".finding-id").textContent.trim();
    const prefix = `- [${id}] `;
    const generatedLine = `${prefix}${changedInput.dataset.prompt}`;
    const lines = prompt.value.split("\n").filter((line) => !line.startsWith(prefix));
    const anchorIndex = lines.findIndex((line) => line.trim() === promptAnchor);

    if (changedInput.checked) {
      const closingIndex = lines.findIndex((line) => line.startsWith(closingPrompt));
      let insertAt = closingIndex >= 0 ? closingIndex : anchorIndex + 1;
      if (lines[insertAt - 1] === "") insertAt -= 1;
      lines.splice(Math.max(insertAt, 0), 0, generatedLine);
    }
    prompt.value = lines.join("\n");

    const total = accepted.length;
    acceptedCount.textContent = `${total} recommandation${total === 1 ? "" : "s"} acceptée${total === 1 ? "" : "s"}`;
  }

  document.querySelectorAll(".accept-input").forEach((input) => {
    input.addEventListener("change", () => {
      const finding = input.closest(".finding");
      finding.classList.toggle("is-accepted", input.checked);
      finding.querySelector(".accept-toggle span").textContent = input.checked ? "Accepté" : "Accepter";
      updatePrompt(finding);
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
