(() => {
  const iconMap = new Map([
    ["Kamper", "👕"],
    ["Seier / U / Tap", "📊"],
    ["Mål", "⚽"],
    ["Målforskjell", "➕"],
    ["Målscorere", "⚽"],
    ["Kort", "🟨"],
    ["Kamptype", "🏆"],
    ["Spilletid", "⏱️"]
  ]);

  function decorate() {
    document.querySelectorAll(".summary-card span").forEach(label => {
      if (label.dataset.iconized === "true") return;
      const text = label.textContent.trim();
      const icon = iconMap.get(text);
      if (!icon) return;
      label.textContent = `${icon} ${text}`;
      label.dataset.iconized = "true";
    });

    document.querySelectorAll(".detail-hint").forEach(hint => {
      hint.textContent = "Velg en enkeltkamp i feltet over for å se statistikken fra den kampen.";
    });
  }

  const observer = new MutationObserver(decorate);
  observer.observe(document.body, { childList: true, subtree: true });
  decorate();
})();
