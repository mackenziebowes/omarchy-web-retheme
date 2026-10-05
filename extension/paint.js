// Full-mode painter. Tags elements whose computed background is actually opaque, so css.js can
// recolor them from the palette. Transparent elements (link overlays, hover bubbles) are never
// touched, which is what keeps avatars and video visible.
//
//   data-owr-bg="0|1|2"  opaque background -> page / surface / border-ish palette color
//   data-owr-grad        light-on-dark (or dark-on-light) gradient scrim -> background-image:none

function owrCreatePainter({ dark, skip }) {
  const BG = "data-owr-bg";
  const GRAD = "data-owr-grad";
  const SKIP_TAGS = new Set([
    "HTML", "BODY", "HEAD", "SCRIPT", "STYLE", "LINK", "META", "TITLE", "NOSCRIPT", "BR",
    "IMG", "VIDEO", "CANVAS", "PICTURE", "SOURCE", "IFRAME", "EMBED", "OBJECT",
  ]);
  const skipSel = skip?.length ? skip.join(",") : null;
  const SLICE_MS = 6;

  const queue = new Set();
  let scheduled = false;
  let observer = null;

  function parse(str) {
    let m = str.match(/^rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    m = str.match(/^color\(srgb ([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[\s/]+/).filter(Boolean).map(parseFloat);
      return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 };
    }
    return null; // lab/oklch etc.: leave alone
  }

  const lightness = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  const saturation = (c) => {
    const mx = Math.max(c.r, c.g, c.b);
    return mx ? (mx - Math.min(c.r, c.g, c.b)) / mx : 0;
  };

  // Brand/accent colors (saturated) keep their color. Neutrals are ranked by how far they sit
  // from the page extreme (white or black): page-like -> 0, card-like -> 1, mid gray -> 2.
  function rank(c) {
    if (saturation(c) > 0.35 && Math.max(c.r, c.g, c.b) > 51) return -1;
    const L = lightness(c);
    const e = Math.min(L, 1 - L);
    return e < 0.025 ? 0 : e < 0.2 ? 1 : 2;
  }

  // A gradient is a scrim to drop when all its visible stops are the opposite polarity of the
  // theme: near-white fades on a dark theme, near-black on a light one.
  function isScrim(image) {
    const stops = (image.match(/rgba?\([^)]*\)/g) || []).map(parse).filter((c) => c && c.a > 0);
    if (!stops.length) return false;
    return stops.every((c) => {
      if (saturation(c) > 0.2) return false;
      const L = lightness(c);
      return dark ? L > 0.85 : L < 0.15;
    });
  }

  function paint(el) {
    if (!el.isConnected || el.nodeType !== 1 || el instanceof SVGElement || SKIP_TAGS.has(el.tagName)) return;
    // Remove our tags first so we read the site's own colors, not our override.
    el.removeAttribute(BG);
    el.removeAttribute(GRAD);
    if (skipSel && el.closest(skipSel)) return;
    const cs = getComputedStyle(el);
    const c = parse(cs.backgroundColor);
    if (c && c.a >= 0.5) {
      const r = rank(c);
      if (r >= 0) el.setAttribute(BG, r);
    }
    const image = cs.backgroundImage;
    if (image.includes("gradient(") && !image.includes("url(") && isScrim(image)) el.setAttribute(GRAD, "");
  }

  function run() {
    scheduled = false;
    const t0 = performance.now();
    for (const el of queue) {
      queue.delete(el);
      paint(el);
      if (performance.now() - t0 > SLICE_MS) break;
    }
    if (queue.size) schedule();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  }

  function enqueueTree(root) {
    if (root.nodeType !== 1) return;
    queue.add(root);
    root.querySelectorAll("*").forEach((el) => queue.add(el));
    schedule();
  }

  // Hover/focus states change backgrounds of the pointed element and its ancestors.
  function onPointer(e) {
    let el = e.target;
    for (let i = 0; el && el.nodeType === 1 && i < 8; i++, el = el.parentElement) queue.add(el);
    schedule();
  }

  const EVENTS = ["mouseover", "mouseout", "focusin", "focusout"];

  return {
    start() {
      if (observer) return;
      observer = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === "childList") {
            m.addedNodes.forEach(enqueueTree);
          } else if (m.target === document.documentElement || m.target === document.body) {
            enqueueTree(document.documentElement); // site-level theme toggle: repaint everything
          } else {
            queue.add(m.target);
            schedule();
          }
        }
      });
      observer.observe(document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style"],
      });
      EVENTS.forEach((ev) => document.addEventListener(ev, onPointer, true));
      enqueueTree(document.documentElement);
      document.addEventListener("DOMContentLoaded", () => enqueueTree(document.documentElement), { once: true });
    },
    stop() {
      observer?.disconnect();
      observer = null;
      queue.clear();
      EVENTS.forEach((ev) => document.removeEventListener(ev, onPointer, true));
      document.querySelectorAll(`[${BG}],[${GRAD}]`).forEach((el) => {
        el.removeAttribute(BG);
        el.removeAttribute(GRAD);
      });
    },
  };
}
