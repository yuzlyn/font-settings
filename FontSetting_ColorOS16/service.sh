#!/system/bin/sh

MODDIR=${0%/*}
count=0
while [ "$(getprop sys.boot_completed)" != "1" ] && [ "$count" -lt 180 ]; do
  sleep 1
  count=$((count + 1))
done
rm -f "$MODDIR/data/pending_reboot"

