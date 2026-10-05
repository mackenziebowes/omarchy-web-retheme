const $ = (id) => document.getElementById(id);
const DEFAULTS = { enabled: true, mode: "full", disabledHosts: [], theme: null, hostError: null };

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = "";
  try { host = new URL(tab.url).hostname; } catch {}
  const s = { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) };

  const c = s.theme?.colors;
  if (c) {
    document.documentElement.style.setProperty("--bg", c.background);
    document.documentElement.style.setProperty("--fg", c.foreground);
    document.documentElement.style.setProperty("--alt", c.lighter_background || c.background);
    document.documentElement.style.setProperty("--accent", c.accent);
    $("name").textContent = s.theme.name || "Omarchy theme";
    for (const k of ["red", "orange", "yellow", "green", "cyan", "blue", "magenta", "accent"]) {
      const i = document.createElement("i");
      i.style.background = c[k] || "transparent";
      $("sw").append(i);
    }
  }
  $("err").textContent = s.hostError ? `Host: ${s.hostError}. Run install.sh?` : "";
  $("enabled").checked = s.enabled;
  $("mode").value = s.mode;
  $("host").textContent = host || "(n/a)";
  $("skip").checked = s.disabledHosts.includes(host);
  $("skip").disabled = !host;

  // Firefox MV3 makes host permissions opt-in; without them nothing is injected.
  const origins = { origins: ["<all_urls>"] };
  if (!(await chrome.permissions.contains(origins))) {
    $("grant").hidden = false;
    $("grant").onclick = async () => {
      if (await chrome.permissions.request(origins)) window.close();
    };
  }

  $("enabled").onchange = (e) => chrome.storage.local.set({ enabled: e.target.checked });
  $("mode").onchange = (e) => chrome.storage.local.set({ mode: e.target.value });
  $("skip").onchange = async (e) => {
    const { disabledHosts = [] } = await chrome.storage.local.get("disabledHosts");
    const next = new Set(disabledHosts);
    e.target.checked ? next.add(host) : next.delete(host);
    chrome.storage.local.set({ disabledHosts: [...next] });
  };
})();
