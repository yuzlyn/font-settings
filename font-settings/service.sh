#!/system/bin/sh

MODDIR=${0%/*}
count=0
while [ "$(getprop sys.boot_completed)" != "1" ] && [ "$count" -lt 180 ]; do
  sleep 1
  count=$((count + 1))
done
rm -f "$MODDIR/data/pending_reboot"

# A metamodule (e.g. Magic Mount-rs) can hot-apply an update and leave
# modules_update/<id> behind. KernelSU then lists this module twice, and its
# manager crashes with `IllegalArgumentException: Key "<id>" was already used`.
# Drop the leftover once it carries the same version as the active module; a
# genuinely newer staged update is left alone for the normal boot-time apply.
staged="/data/adb/modules_update/${MODDIR##*/}"
if [ -f "$staged/module.prop" ] && [ -f "$MODDIR/module.prop" ]; then
  if [ "$(grep '^version=' "$staged/module.prop")" = "$(grep '^version=' "$MODDIR/module.prop")" ]; then
    rm -rf "$staged"
  fi
fi

# Self-heal an install that skipped customize.sh: restore executable bits
# and regenerate the font config backup so the WebUI never ends up
# reporting connection failures over missing permissions. The staged update
# directory is healed as well: a metamodule can hot-apply an update and leave
# modules_update behind with scripts that are not executable yet.
for dir in "$MODDIR" /data/adb/modules_update/font-settings; do
  [ -d "$dir" ] || continue
  chmod 0755 "$dir/tools/fontctl.sh" "$dir/tools/fontconfig.sh" \
    "$dir/webroot/cgi-bin/exec" 2>/dev/null
done
if [ ! -d "$MODDIR/config/original" ] || [ ! -s "$MODDIR/data/font-configs.list" ]; then
  sh "$MODDIR/tools/fontconfig.sh" prepare >/dev/null 2>&1
fi

# Local WebUI server: lets any browser open the module UI at
# http://127.0.0.1:7125 even without a WebUI host (e.g. on Magisk).
# The /cgi-bin/exec endpoint runs POSTed shell commands as root.
#
# The files are served from a stable copy outside the module directory: a
# metamodule can replace <module>/webroot while the server is running, which
# leaves the daemon with a deleted working directory and every request 404s.
WEBUI_PORT=7125
WEBUI_ROOT=/data/adb/font-settings/webui
busybox=""
for candidate in /data/adb/magisk/busybox /data/adb/ksu/bin/busybox /data/adb/ap/bin/busybox; do
  if [ -x "$candidate" ] && "$candidate" httpd --help >/dev/null 2>&1; then
    busybox="$candidate"
    break
  fi
done

if [ -n "$busybox" ] && [ -x "$MODDIR/webroot/cgi-bin/exec" ]; then
  mkdir -p "$WEBUI_ROOT"
  module_mtime="$(stat -c %Y "$MODDIR/webroot/index.html" 2>/dev/null)"
  served_mtime="$(stat -c %Y "$WEBUI_ROOT/index.html" 2>/dev/null)"
  if [ ! -f "$WEBUI_ROOT/index.html" ] || [ "${module_mtime:-0}" -gt "${served_mtime:-0}" ]; then
    cp -af "$MODDIR/webroot/." "$WEBUI_ROOT/" 2>/dev/null
    chmod 0755 "$WEBUI_ROOT/cgi-bin/exec" 2>/dev/null
    find "$WEBUI_ROOT" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) -exec chmod 0644 {} \; 2>/dev/null
  fi
  (
    while :; do
      "$busybox" httpd -f -p "127.0.0.1:$WEBUI_PORT" -h "$WEBUI_ROOT" 2>/dev/null
      sleep 5
    done
  ) &
fi
