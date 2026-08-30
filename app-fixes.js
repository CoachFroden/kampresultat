// Small safety fixes that can be loaded before app.js without changing the match engine.
(() => {
  let startLocked = false;
  let unlockTimer = null;

  function setStartButtonState(button, locked) {
    if (!button) return;
    button.disabled = locked;
    if (locked) {
      button.dataset.originalText = button.textContent || "Start";
      button.textContent = "Starter…";
      button.setAttribute("aria-busy", "true");
    } else {
      button.textContent = button.dataset.originalText || "Start";
      button.removeAttribute("aria-busy");
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("#startBtn");
    if (!button) return;

    if (startLocked) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    // Do not lock on an invalid pre-match form; app.js will show its normal alert.
    const opponent = document.getElementById("awayTeam")?.value?.trim();
    const date = document.getElementById("matchDate")?.value;
    const time = document.getElementById("matchTime")?.value;
    if (!opponent || !date || !time) return;

    startLocked = true;
    setStartButtonState(button, true);

    // If the first Firestore write fails, make the button usable again.
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => {
      const stillVisible = getComputedStyle(button).display !== "none";
      if (stillVisible) {
        startLocked = false;
        setStartButtonState(button, false);
      }
    }, 12000);
  }, true);
})();
