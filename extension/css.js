// Builds the retheme stylesheet from an Omarchy colors.toml palette.
// Loaded as a content script before content.js, so it exposes a global.

function owrBuildCss(colors, mode, host) {
  const c = colors || {};
  const bg = c.background || "#1e1e2e";
  const tokens = {
    bg,
    "bg-alt": c.lighter_background || bg,
    "bg-deep": c.dark_background || bg,
    fg: c.foreground || "#cdd6f4",
    "fg-dim": c.light_foreground || c.foreground || "#bac2de",
    muted: c.dark_foreground || c.muted || "#6c7086",
    border: c.selection || c.muted || "#45475a",
    accent: c.accent || c.blue || "#89b4fa",
    visited: c.magenta || c.accent || "#f5c2e7",
    red: c.red || "#f38ba8",
    green: c.green || "#a6e3a1",
    yellow: c.yellow || "#f9e2af",
    blue: c.blue || "#89b4fa",
  };

  // Every raw palette key is also exposed, so user CSS can use --omarchy-bright-red etc.
  const vars = [];
  for (const [k, v] of Object.entries(c)) {
    if (typeof v === "string") vars.push(`--omarchy-${k.replace(/_/g, "-")}:${v};`);
  }
  for (const [k, v] of Object.entries(tokens)) vars.push(`--owr-${k}:${v};`);

  const scheme = c.mode === "light" ? "light" : "dark";

  // Soft mode: page frame, text links and form controls. Respects the site's own layout colors.
  const soft = `
:root{color-scheme:${scheme};${vars.join("")}}
html,body{background-color:var(--owr-bg)!important;color:var(--owr-fg)!important}
html{scrollbar-color:var(--owr-muted) var(--owr-bg)}
::selection{background:var(--owr-accent)!important;color:var(--owr-bg)!important}
html a:any-link{color:var(--owr-accent)!important}
html a:visited{color:var(--owr-visited)!important}
html :is(input,textarea,select,button){background-color:var(--owr-bg-alt)!important;color:var(--owr-fg)!important;border-color:var(--owr-border)!important}
html ::placeholder{color:var(--owr-muted)!important}
`;

  if (mode === "soft") return soft;

  const site = owrSite(host);

  // Full mode. Backgrounds are NOT set here: CSS can't tell a painted element from a transparent
  // one, and forcing a color onto the invisible link-wrapper divs sites layer over avatars and
  // video hides the media beneath. paint.js reads each element's computed background and tags only
  // the painted ones with data-owr-bg (0 page, 1 surface, 2 border-ish) / data-owr-grad.
  // Border colors are only forced where borders are conventional; many sites use
  // `border: 1px solid transparent` on buttons, which a global override would reveal.
  return `${soft}
html *:not(svg *):not(svg){color:var(--owr-fg)!important;text-shadow:none!important}
html [data-owr-bg="0"]{background-color:var(--owr-bg)!important}
html [data-owr-bg="1"]{background-color:var(--owr-bg-alt)!important}
html [data-owr-bg="2"]{background-color:var(--owr-border)!important}
html [data-owr-grad]{background-image:none!important}
html :is(small,figcaption,caption,time,label,legend,summary,sub,sup,cite){color:var(--owr-fg-dim)!important}
html :is(pre,table,td,th,details,fieldset,blockquote,hr,input,textarea,select){border-color:var(--owr-border)!important}
html :is(button,input[type=submit],input[type=button]):hover{border-color:var(--owr-accent)!important}
html :is(input,textarea,select,[contenteditable=true]):focus{outline:1px solid var(--owr-accent)!important;border-color:var(--owr-accent)!important}
html :is(a:any-link,a:any-link *){color:var(--owr-accent)!important}
html hr{background-color:var(--owr-border)!important}
html mark{background-color:var(--owr-yellow)!important;color:var(--owr-bg)!important}
html :is(input[type=checkbox],input[type=radio],progress,meter){accent-color:var(--owr-accent)}
${site?.css || ""}
`;
}

// Per-site tweaks keyed by hostname suffix.
//   skip: elements (and their subtrees) paint.js leaves alone, keeping the site's own colors.
//   css:  extra rules appended last.
const OWR_SITES = {
  // Same bounding-box problem as X, but scoped to icon-only buttons and the search box: timestamp
  // badges, chips and Subscribe/Sign in need their fill, and the *Overlay* buttons sit on top of
  // thumbnails and need theirs to stay legible.
  "youtube.com": {
    skip: [".html5-video-player"],
    css: `html [data-owr-bg]:is(
  yt-icon-button button,yt-icon-button button *,
  button[class*=ytSpecButtonShapeNextIconButton]:not([class*=Overlay]),
  button[class*=ytSpecButtonShapeNextIconButton]:not([class*=Overlay]) *,
  .ytSearchboxComponentInput,.ytSearchboxComponentSearchButton,.ytSearchboxComponentSearchButton *){
  background-color:transparent!important}`,
  },
  // X draws touch targets as filled bounding boxes. Make interactive elements (and their inner
  // wrappers) transparent so they don't show up as lighter squares. Transparent rather than the
  // page color: the search pill's shape is a background on a container, and an opaque fill on the
  // input inside it spills past the pill's rounded edge. [role=link] is left
  // out on purpose: it is the whole clickable tweet, and its hover highlight is worth keeping.
  "x.com": {
    skip: ["[data-testid=videoPlayer]"],
    css: `html [data-owr-bg]:is(a,button,input,textarea,[role=button],[role=tab],[role=menuitem],[role=combobox],
  [data-testid=tweet-text-show-more-link],
  a *,button *,[role=button] *,[role=tab] *,[role=menuitem] *,[data-testid=tweet-text-show-more-link] *){
  background-color:transparent!important}`,
  },
};

function owrSite(host) {
  const hit = Object.keys(OWR_SITES).find((h) => host === h || host?.endsWith("." + h));
  return hit ? OWR_SITES[hit] : null;
}
