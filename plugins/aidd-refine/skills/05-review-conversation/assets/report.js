(() => {
  const promptMarker = "---";

  function formatCount(count, one, other) {
    const template = count === 1 ? one : other;
    return template ? template.replace("{count}", String(count)) : String(count);
  }

  function needsDiffDialog(lineCount) {
    return lineCount > 5;
  }

  function elapsedSeconds(start, end) {
    const seconds = (Date.parse(end) - Date.parse(start)) / 1000;
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : NaN;
  }

  function formatDuration(seconds, locale = "en", unavailable = "Unavailable") {
    if (!Number.isFinite(seconds) || seconds < 0) return unavailable;
    const rounded = Math.round(seconds * 1000) / 1000;
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const remaining = rounded % 60;
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
    const parts = [];
    if (hours) parts.push(`${number.format(hours)} h`);
    if (minutes) parts.push(`${number.format(minutes)} min`);
    if (remaining || !parts.length) parts.push(`${number.format(remaining)} s`);
    return parts.join(" ");
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

  if (typeof module !== "undefined") module.exports = { composePrompt, formatCount, elapsedSeconds, formatDuration, needsDiffDialog };
  if (typeof document === "undefined") return;

  const report = document.querySelector("#report");
  const findings = [...document.querySelectorAll(".finding")];
  const prompt = document.querySelector("#execution-prompt");
  const acceptedCount = document.querySelector("#accepted-count");
  const savedPromptLines = new Map();
  const findingIds = new Set(findings.map((finding) => finding.dataset.id));

  document.querySelectorAll(".duration").forEach((node) => {
    const boundary = node.closest("[data-start]");
    const raw = node.dataset.seconds;
    const seconds = raw === undefined
      ? elapsedSeconds(boundary?.dataset.start, boundary?.dataset.end)
      : raw.trim() ? Number(raw) : NaN;
    const known = Number.isFinite(seconds) && seconds >= 0;
    const label = formatDuration(seconds, document.documentElement?.lang || "en", report.dataset.labelDurationUnavailable || "Unavailable");
    node.textContent = `${known ? node.dataset.prefix || "" : ""}${label}`;
    node.classList.toggle("is-slow", known && seconds > 60);
  });

  document.querySelectorAll(".git-diff").forEach((diff) => {
    const lines = [...diff.querySelectorAll(".diff-line")];
    if (!needsDiffDialog(lines.length)) return;

    const dialog = document.createElement("dialog");
    dialog.className = "diff-dialog";
    const title = document.createElement("h3");
    title.textContent = report.dataset.diffTitle || "Full changes";
    dialog.setAttribute("aria-label", title.textContent);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "diff-close";
    close.textContent = report.dataset.diffClose || "Close";
    close.addEventListener("click", () => dialog.close());
    const columns = document.createElement("div");
    columns.className = "dialog-columns";
    for (const [kind, label] of [["diff-del", report.dataset.diffRemoved || "Removed"], ["diff-add", report.dataset.diffAdded || "Added"]]) {
      const section = document.createElement("section");
      const heading = document.createElement("h4");
      heading.textContent = label;
      const content = document.createElement("pre");
      content.className = "dialog-code";
      const code = document.createElement("code");
      lines.filter((line) => line.classList.contains(kind)).forEach((line) => {
        const copy = line.cloneNode(true);
        copy.hidden = false;
        code.appendChild(copy);
      });
      content.appendChild(code);
      section.append(heading, content);
      columns.appendChild(section);
    }
    dialog.append(title, close, columns);
    const open = document.createElement("button");
    open.type = "button";
    open.className = "diff-open";
    open.textContent = report.dataset.diffOpen || "View all changes";
    open.addEventListener("click", () => dialog.showModal());
    lines.slice(5).forEach((line) => { line.hidden = true; });
    diff.insertAdjacentElement("afterend", open);
    open.insertAdjacentElement("afterend", dialog);
  });

  function updatePrompt() {
    const accepted = findings.filter((finding) => finding.querySelector(".accept-input").checked);
    const entries = accepted.map((finding) => ({
      id: finding.dataset.id,
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
})();
