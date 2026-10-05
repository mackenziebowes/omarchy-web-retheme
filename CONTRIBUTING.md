# Forking and contributing

This started as a personal itch, so it is small and easy to bend. If you want it to look or behave
differently, fork it. If your change would help other people, a PR is very welcome.

## How it fits together

```
colors.toml (Omarchy)
      │  host/omarchy-web-retheme-host   reads it, pushes it on change (native messaging)
      ▼
extension/background.js                   keeps the port open, stores the theme in chrome.storage
      ▼
extension/content.js                      runs in every page at document_start
   ├─ css.js    palette -> CSS variables + override rules   (the "look")
   └─ paint.js  tags elements with an opaque background     (the "smarts")
```

- `css.js` decides what things look like: which palette color is the page, which is a surface,
  link colors, per-site tweaks (`OWR_SITES`).
- `paint.js` decides *which elements* get recolored, by reading computed backgrounds. Transparent
  elements are never touched (that is what keeps avatars and video visible).
- The host is a small stdlib-only Python script. You should rarely need to change it.

## Dev loop

No build step. Edit, reload, look.

1. `./install.sh` once, to register the native host.
2. Load `extension/` unpacked (Chromium: `chrome://extensions`; Firefox:
   `about:debugging#/runtime/this-firefox`, then grant site access in the popup).
3. After editing anything in `extension/`, hit the reload button on the extension, then reload the
   tab. Content scripts only update on a fresh page load.
4. Switch themes (`omarchy theme set <name>`) to see it follow along live.

Handy when debugging a page:

- Painted elements carry `data-owr-bg="0|1|2"` (page / surface / border-ish) and scrims carry
  `data-owr-grad`. Inspect an element: no attribute means the painter left it alone.
- The popup has a per-site "Skip" toggle and a Soft mode (page, text, links, form controls only).
  If Soft looks right and Full does not, the problem is in `paint.js` or the site tweak.
- A theme is just `colors.toml`. Keys become `--omarchy-<key>` variables, and `css.js` maps them
  to `--owr-*` tokens with fallbacks, so themes with missing keys still work.

## Common changes

**Fix a site.** Add an entry to `OWR_SITES` in `extension/css.js`, keyed by hostname suffix:

```js
"example.com": {
  skip: [".video-player"],           // keep the site's own colors inside these
  css: `html [data-owr-bg]:is(.icon-btn, .icon-btn *){background-color:transparent!important}`,
},
```

Use `skip` for media players and anything that must keep its colors. Use `css` for fixes like
"this site draws buttons as filled boxes". Prefer specific selectors over broad ones (a blanket
"all links transparent" rule strips timestamp badges and call-to-action buttons). Class names on big
sites are often generated and change over time, so keep rules narrow and commented.

**Change the look.** The `tokens` object at the top of `css.js` maps theme colors to roles
(`bg`, `bg-alt`, `border`, `accent`, ...). Swap which palette key plays which role there.

**Change what counts as "surface".** `rank()` in `paint.js` buckets neutral backgrounds by how far
they sit from pure white or black, and leaves saturated colors alone. The thresholds are the knobs.

**Another browser.** Chromium and Firefox are handled in `install.sh` and the manifest. Other
Chromium-based browsers usually just need their config directory added to the list in `install.sh`.

## Making your own copy (fork identity)

The extension ID, Firefox add-on ID, and native host name are tied together. If you publish your own
build, or just want it to coexist with the original, change them in one pass:

1. **Firefox add-on ID.** Edit `browser_specific_settings.gecko.id` in `extension/manifest.json`
   and `GECKO_ID` in `install.sh` to the same new value (`name@yourdomain` is fine).
2. **Chromium extension ID.** Generate your own key so you get your own ID:

   ```sh
   openssl genrsa 2048 > key.pem                      # keep this private, never commit it
   openssl rsa -in key.pem -pubout -outform DER > pub.der
   base64 -w0 pub.der                                 # -> "key" in extension/manifest.json
   sha256sum pub.der | head -c32 | tr '0-9a-f' 'a-p'  # -> EXT_ID in install.sh
   ```

3. **Host name (only if both copies must run side by side).** Rename `com.omarchy.web_retheme` in
   `extension/background.js` and `install.sh` (the host manifest filename follows from it).
4. Re-run `./install.sh` and reload the extension.

The repo's `.gitignore` already excludes `*.pem`.

## Pull requests

- Keep them small and focused: one site, one bug, or one behavior.
- For a site fix, include a before and after screenshot, and say which theme you tested with. A dark
  and a light theme is ideal.
- Note how you tested (Chromium, Firefox, or both).
- Keep comments to the non-obvious "why", the way the existing code does.
- No build tooling, dependencies or frameworks please; the zero-build setup is a feature.

## Ideas that would be nice

Things that came up while building this and are still open:

- Icon recoloring (dark glyph images disappear on a dark theme, e.g. Gmail's side rail).
- A site-tweak format that users can add from the popup without editing `css.js`.
- Shadow DOM support (page CSS does not reach into it).
- Periodic rescan for elements whose colors change without a class, style, or hover change.
- Packaging for the Firefox and Chrome stores.
