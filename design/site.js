/* Fluister · marketing site — minimal vanilla JS
   Only does:
   1. animated waveform on the recording pills
   2. cycling profile demo (auto + click)
   3. theme toggle (light/dark) with localStorage persistence
*/

(function () {
  // — 1. Waveforms ────────────────────────────────────────────
  // Find every .wave element, fill it with N <i> bars (data-bars attr,
  // default 12), then animate heights at ~18fps. One shared rAF for all.
  const waves = [];
  document.querySelectorAll(".wave").forEach((el) => {
    const bars = parseInt(el.getAttribute("data-bars") || "12", 10);
    el.innerHTML = "";
    const items = [];
    for (let i = 0; i < bars; i++) {
      const i_ = document.createElement("i");
      el.appendChild(i_);
      items.push(i_);
    }
    waves.push({ el, items, phase: Math.random() * Math.PI * 2 });
  });

  let last = 0;
  function tick(t) {
    if (t - last > 55) {
      last = t;
      const max = 14;
      for (const w of waves) {
        for (let i = 0; i < w.items.length; i++) {
          const v = 0.18 + Math.abs(Math.sin((t / 280) + i * 0.7 + w.phase)) * 0.7
                  + (Math.random() - 0.5) * 0.25;
          const h = Math.max(2, Math.round(Math.max(0.08, Math.min(1, v)) * max));
          w.items[i].style.height = h + "px";
        }
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // — 2. Pill timer (single pill in hero) ─────────────────────
  const timerEl = document.querySelector(".pill .timer");
  if (timerEl) {
    const start = performance.now();
    setInterval(() => {
      const t = (performance.now() - start) / 1000;
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      timerEl.textContent = m + ":" + s.toString().padStart(2, "0");
    }, 250);
  }

  // — 3. Profiles before/after cycler ─────────────────────────
  const profileTabs = document.querySelectorAll(".profile-tab");
  const profilePanels = document.querySelectorAll("[data-profile-panel]");
  let activeProfile = "email";
  let cycleId = null;

  function selectProfile(id, manual) {
    activeProfile = id;
    profileTabs.forEach((t) => {
      t.setAttribute("aria-selected", t.dataset.profile === id ? "true" : "false");
    });
    profilePanels.forEach((p) => {
      p.hidden = p.dataset.profilePanel !== id;
    });
    if (manual) {
      // user took control — stop the auto-cycle
      if (cycleId) clearInterval(cycleId);
      cycleId = null;
    }
  }

  profileTabs.forEach((t) => {
    t.addEventListener("click", () => selectProfile(t.dataset.profile, true));
  });

  // start auto-cycle
  if (profileTabs.length) {
    const order = Array.from(profileTabs).map((t) => t.dataset.profile);
    let i = 0;
    cycleId = setInterval(() => {
      i = (i + 1) % order.length;
      selectProfile(order[i], false);
    }, 5500);
  }

  // — 4. Theme toggle ─────────────────────────────────────────
  const root = document.documentElement;
  const stored = localStorage.getItem("fluister-theme");
  if (stored === "light" || stored === "dark") root.dataset.theme = stored;

  const themeBtn = document.querySelector(".theme-toggle");
  function syncThemeIcon() {
    if (!themeBtn) return;
    const dark = root.dataset.theme === "dark"
      || (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    themeBtn.textContent = dark ? "☼" : "☾";
    themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }
  syncThemeIcon();
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const dark = root.dataset.theme === "dark"
        || (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
      const next = dark ? "light" : "dark";
      root.dataset.theme = next;
      localStorage.setItem("fluister-theme", next);
      syncThemeIcon();
    });
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", syncThemeIcon);
})();
