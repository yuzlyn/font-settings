#!/system/bin/sh

MODDIR=${0%/*}
count=0
while [ "$(getprop sys.boot_completed)" != "1" ] && [ "$count" -lt 180 ]; do
  sleep 1
  count=$((count + 1))
done
rm -f "$MODDIR/data/pending_reboot"

# Local WebUI server: lets any browser open the module UI at
# http://127.0.0.1:7125 even without a WebUI host (e.g. on Magisk).
# The /cgi-bin/exec endpoint runs POSTed shell commands as root.
WEBUI_PORT=7125
busybox=""
for candidate in /data/adb/magisk/busybox /data/adb/ksu/bin/busybox /data/adb/ap/bin/busybox; do
  if [ -x "$candidate" ] && "$candidate" httpd --help >/dev/null 2>&1; then
    busybox="$candidate"
    break
  fi
done

if [ -n "$busybox" ] && [ -x "$MODDIR/webroot/cgi-bin/exec" ]; then
  (
    while :; do
      "$busybox" httpd -f -p "127.0.0.1:$WEBUI_PORT" -h "$MODDIR/webroot" 2>/dev/null
      sleep 5
    done
  ) &
fi
