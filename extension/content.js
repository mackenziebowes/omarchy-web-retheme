// Injects the generated stylesheet at document_start and keeps it in sync with storage.
(() => {
  const ID = "omarchy-web-retheme";
  const DEFAULTS = { enabled: true, mode: "full", disabledHosts: [], theme: null };
  let state = { ...DEFAULTS };
  let painter = null;
  let painterKey = null;

  function syncPainter(on) {
    // Rebuild only when something that affects painting changes.
    const key = on ? `${state.theme.colors.mode}` : null;
    if (key === painterKey) return;
    painter?.stop();
    painter = null;
    painterKey = key;
    if (!on) return;
    painter = owrCreatePainter({
      dark: state.theme.colors.mode !== "light",
      skip: owrSite(location.hostname)?.skip,
    });
    painter.start();
  }

  function apply() {
    const off =
      !state.enabled ||
      !state.theme ||
      state.disabledHosts.includes(location.hostname);
    let el = document.getElementById(ID);
    if (off) {
      el?.remove();
      return syncPainter(false);
    }
    if (!el) {
      el = document.createElement("style");
      el.id = ID;
      (document.head || document.documentElement).appendChild(el);
    }
    const css = owrBuildCss(state.theme.colors, state.mode, location.hostname);
    if (el.textContent !== css) el.textContent = css;
    syncPainter(state.mode === "full");
  }

  // Sites that rebuild <head> can drop our style tag; put it back.
  new MutationObserver(() => {
    if (!document.getElementById(ID)) apply();
  }).observe(document, { childList: true, subtree: true });

  chrome.storage.local.get(DEFAULTS, (s) => {
    state = { ...DEFAULTS, ...s };
    apply();
  });

  chrome.storage.onChanged.addListener((changes) => {
    for (const [k, { newValue }] of Object.entries(changes)) state[k] = newValue ?? DEFAULTS[k];
    apply();
  });
})();
