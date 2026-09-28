#!/system/bin/sh

MODDIR=${0%/*}

# Restore the user's uploads from the persistent backup when the module
# directory lost them (a metamodule can replace the directory wholesale when it
# applies an update). Runs early so this boot's font mount sees the files.
BACKUP_DIR="/data/adb/font-settings"
if [ -d "$BACKUP_DIR/fonts" ]; then
  for font in "$BACKUP_DIR"/fonts/FontSettingChinese*.ttf "$BACKUP_DIR"/fonts/FontSettingWestern*.ttf; do
    [ -f "$font" ] || continue
    target="$MODDIR/system/fonts/${font##*/}"
    [ -f "$target" ] && continue
    cp -af "$font" "$target" 2>/dev/null
  done
fi
if [ -d "$BACKUP_DIR/data" ]; then
  for file in "$BACKUP_DIR"/data/*.list "$BACKUP_DIR"/data/*.b64 \
    "$BACKUP_DIR"/data/western.size "$BACKUP_DIR"/data/fallback \
    "$BACKUP_DIR"/data/emoji.mode "$BACKUP_DIR"/data/emoji-custom.font; do
    [ -f "$file" ] || continue
    target="$MODDIR/data/${file##*/}"
    [ -f "$target" ] && continue
    cp -af "$file" "$target" 2>/dev/null
  done
fi

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
