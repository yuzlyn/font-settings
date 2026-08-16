#!/system/bin/sh

MODDIR=${0%/*}
chmod 0644 "$MODDIR/system/fonts/FontSettingChinese.ttf" 2>/dev/null
chmod 0644 "$MODDIR/system/fonts/FontSettingWestern.ttf" 2>/dev/null
for list in chinese.list western.list; do
  [ -f "$MODDIR/data/$list" ] || continue
  while IFS= read -r entry; do
    set -- $entry
    name="$1"
    case "$name" in
      FontSettingChinese.ttf|FontSettingChinese-[0-9]*.ttf|FontSettingWestern.ttf|FontSettingWestern-[0-9]*.ttf) ;;
      *) continue ;;
    esac
    chmod 0644 "$MODDIR/system/fonts/$name" 2>/dev/null
  done < "$MODDIR/data/$list"
done
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
