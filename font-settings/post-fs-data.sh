#!/system/bin/sh

MODDIR=${0%/*}
chmod 0644 "$MODDIR/system/fonts/FontSettingChinese.ttf" 2>/dev/null
chmod 0644 "$MODDIR/system/fonts/FontSettingWestern.ttf" 2>/dev/null
if [ -f "$MODDIR/data/emoji.targets" ]; then
  while IFS= read -r target; do
    case "$target" in
      ""|*/*|*[!A-Za-z0-9._-]*) continue ;;
    esac
    chmod 0644 "$MODDIR/system/fonts/$target" 2>/dev/null
  done < "$MODDIR/data/emoji.targets"
fi
if [ -f "$MODDIR/data/font-configs.list" ]; then
  while IFS= read -r config; do
    case "$config" in
      ""|/*|*..*) continue ;;
    esac
    chmod 0644 "$MODDIR/system/$config" 2>/dev/null
  done < "$MODDIR/data/font-configs.list"
fi
