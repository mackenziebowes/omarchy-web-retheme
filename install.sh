#!/bin/bash
# Registers the native messaging host for Chromium-family browsers and Firefox.
# Chromium: chrome://extensions -> Developer mode -> Load unpacked -> ./extension
# Firefox:  about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> extension/manifest.json
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="$HERE/host/omarchy-web-retheme-host"
EXT_ID="cbbpoenjcaalpfleijfeihcfnfdeekpm"          # pinned by "key" in extension/manifest.json
GECKO_ID="omarchy-web-retheme@mackenziebowes.com"  # browser_specific_settings.gecko.id

chmod +x "$HOST"

write_host() { # <dir> <allow-key> <allow-value>
  mkdir -p "$1"
  cat >"$1/com.omarchy.web_retheme.json" <<EOF
{
  "name": "com.omarchy.web_retheme",
  "description": "Streams the current Omarchy theme to the Web Retheme extension",
  "path": "$HOST",
  "type": "stdio",
  "$2": ["$3"]
}
EOF
}

for dir in chromium google-chrome BraveSoftware/Brave-Browser; do
  [[ -d $HOME/.config/$dir ]] || continue
  write_host "$HOME/.config/$dir/NativeMessagingHosts" allowed_origins "chrome-extension://$EXT_ID/"
  echo "registered host for $dir"
done

# Firefox reads ~/.mozilla and whitelists by add-on id (allowed_extensions).
write_host "$HOME/.mozilla/native-messaging-hosts" allowed_extensions "$GECKO_ID"
echo "registered host for firefox"

echo "Now load $HERE/extension (see the header of this script for per-browser steps)."
