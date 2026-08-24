#!/system/bin/sh

SCRIPT_DIR=${0%/*}
MODDIR=$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd)
DATA_DIR="$MODDIR/data"
SYSTEM_FONT_DIR="$MODDIR/system/fonts"
EMOJI_DIR="$MODDIR/emoji"
EMOJI_MODE_FILE="$DATA_DIR/emoji.mode"
EMOJI_TARGETS_FILE="$DATA_DIR/emoji.targets"
EMOJI_CUSTOM_FILE="$DATA_DIR/emoji-custom.font"
WESTERN_SIZE_FILE="$DATA_DIR/western.size"
FALLBACK_FILE="$DATA_DIR/fallback"

fail() {
  echo "error=$1"
  exit 1
}

role_paths() {
  case "$1" in
    chinese)
      ROLE_PREFIX="FontSettingChinese"
      LIST_FILE="$DATA_DIR/chinese.list"
      TEMP_FILE="$DATA_DIR/.chinese.upload"
      ;;
    western)
      ROLE_PREFIX="FontSettingWestern"
      LIST_FILE="$DATA_DIR/western.list"
      TEMP_FILE="$DATA_DIR/.western.upload"
      ;;
    emoji)
      TARGET_FILE="$EMOJI_CUSTOM_FILE"
      ROLE_FILE="$TARGET_FILE"
      NAME_FILE="$DATA_DIR/emoji.name.b64"
      VARIABLE_FILE=""
      TEMP_FILE="$DATA_DIR/.emoji.upload"
      ;;
    *) fail "invalid_role" ;;
  esac
}

valid_font_slot() {
  role="$1"
  name="$2"
  [ -n "$name" ] || return 1
  case "$name" in
    */*|*[!A-Za-z0-9._-]*) return 1 ;;
  esac
  case "$role:$name" in
    chinese:FontSettingChinese.ttf) return 0 ;;
    chinese:FontSettingChinese-[0-9]*.ttf) return 0 ;;
    western:FontSettingWestern.ttf) return 0 ;;
    western:FontSettingWestern-[0-9]*.ttf) return 0 ;;
    *) return 1 ;;
  esac
}

# Create the ordered chain list from the legacy single-font slot on first run.
migrate_role() {
  role="$1"
  case "$role" in chinese|western) ;; *) return 0 ;; esac
  role_paths "$role"
  [ -s "$LIST_FILE" ] && return 0

  legacy="FontSettingChinese.ttf"
  [ "$role" = western ] && legacy="FontSettingWestern.ttf"

  mkdir -p "$DATA_DIR" || fail "mkdir_failed"
  if [ -f "$SYSTEM_FONT_DIR/$legacy" ]; then
    var="$(read_flag "$DATA_DIR/$role.variable")"
    name="$(cat "$DATA_DIR/$role.name.b64" 2>/dev/null)"
    if [ -z "$name" ]; then
      name="$(printf '%s' "$legacy" | base64 | tr -d '\n')"
    fi
    printf '%s %s %s\n' "$legacy" "$var" "$name" > "$LIST_FILE" || fail "chain_save_failed"
  else
    : > "$LIST_FILE" || fail "chain_save_failed"
  fi
  chmod 0644 "$LIST_FILE"
}

next_slot() {
  role="$1"
  role_paths "$role"
  n=1
  while [ "$n" -le 8 ]; do
    candidate="${ROLE_PREFIX}-${n}.ttf"
    [ -e "$SYSTEM_FONT_DIR/$candidate" ] || { echo "$candidate"; return 0; }
    n=$((n + 1))
  done
  return 1
}

print_role_chain() {
  role="$1"
  role_paths "$role"
  migrate_role "$role"
  count=0
  if [ -s "$LIST_FILE" ]; then
    while IFS= read -r entry; do
      set -- $entry
      name="$1"
      var="$2"
      nameb64="$3"
      valid_font_slot "$role" "$name" || continue
      case "$var" in 0|1) ;; *) var=0 ;; esac
      size=0
      [ -f "$SYSTEM_FONT_DIR/$name" ] && size="$(stat -c %s "$SYSTEM_FONT_DIR/$name" 2>/dev/null)"
      count=$((count + 1))
      echo "${role}_font_${count}=$name"
      echo "${role}_font_${count}_size=$size"
      echo "${role}_font_${count}_variable=$var"
      echo "${role}_font_${count}_name_b64=$nameb64"
    done < "$LIST_FILE"
  fi
  echo "${role}_font_count=$count"
}

read_flag() {
  value="$(cat "$1" 2>/dev/null)"
  [ "$value" = "1" ] || value=0
  echo "$value"
}

read_percent() {
  value="$(cat "$1" 2>/dev/null)"
  case "$value" in
    ''|*[!0-9]*) value=100 ;;
  esac
  [ "$value" -ge 20 ] 2>/dev/null || value=20
  [ "$value" -le 100 ] 2>/dev/null || value=100
  echo "$value"
}

read_fallback() {
  value="$(cat "$1" 2>/dev/null)"
  [ "$value" = "0" ] || value=1
  echo "$value"
}

read_weight() {
  value="$(cat "$1" 2>/dev/null)"
  case "$value" in
    ''|*[!0-9]*) value=400 ;;
  esac
  [ "$value" -ge 100 ] 2>/dev/null || value=100
  [ "$value" -le 900 ] 2>/dev/null || value=900
  echo "$value"
}

read_emoji_mode() {
  mode="$(cat "$EMOJI_MODE_FILE" 2>/dev/null)"
  case "$mode" in
    default|ios|google|blobmoji|facebook|custom) echo "$mode" ;;
    *) echo "default" ;;
  esac
}

apply_config() {
  result="$(sh "$MODDIR/tools/fontconfig.sh" apply 2>&1)" || {
    error="${result##*error=}"
    [ -n "$error" ] || error="config_apply_failed"
    fail "$error"
  }
}

emoji_source() {
  case "$1" in
    ios) echo "$EMOJI_DIR/ios/AppleColorEmoji.ttf" ;;
    google) echo "$EMOJI_DIR/google/NotoColorEmoji.ttf" ;;
    blobmoji) echo "$EMOJI_DIR/blobmoji/Blobmoji.ttf" ;;
    facebook) echo "$EMOJI_DIR/facebook/Facebook-Emoji.ttf" ;;
    custom) echo "$EMOJI_CUSTOM_FILE" ;;
    *) return 1 ;;
  esac
}

valid_emoji_target() {
  case "$1" in
    ""|*/*|*[!A-Za-z0-9._-]*|*Flags*|*flags*|*Compat*|*compat*) return 1 ;;
    *Emoji*.ttf|*emoji*.ttf|*Emoji*.otf|*emoji*.otf) return 0 ;;
    *) return 1 ;;
  esac
}

# Print the first non-ignored und-Zsye font referenced by an Android fonts XML.
emoji_from_config() {
  awk '
    BEGIN { in_family = 0; emoji_family = 0; ignored = 0; tag = "" }
    {
      line = $0
      if (!in_family && line ~ /<family([[:space:]>])/) {
        in_family = 1
        tag = line
      } else if (in_family && tag !~ />/) {
        tag = tag " " line
      }

      if (in_family && tag ~ />/) {
        emoji_family = tag ~ /lang="[^"]*und-Zsye/
        ignored = tag ~ /ignore="true"/
      }

      if (in_family && emoji_family && !ignored) {
        rest = line
        while (match(rest, /[A-Za-z0-9._-]+[Ee]moji[A-Za-z0-9._-]*\.(ttf|otf)/)) {
          name = substr(rest, RSTART, RLENGTH)
          if (name !~ /([Ff]lags|[Cc]ompat)/) {
            print name
            exit
          }
          rest = substr(rest, RSTART + RLENGTH)
        }
      }

      if (in_family && line ~ /<\/family>/) {
        in_family = 0
        emoji_family = 0
        ignored = 0
        tag = ""
      }
    }
  ' "$1" 2>/dev/null
}

detect_emoji_target() {
  for config in \
    /system/etc/fonts.xml \
    /system/etc/font_fallback.xml \
    /system/system_ext/etc/fonts_base.xml \
    /product/etc/fonts_customization.xml \
    /product/etc/fonts.xml \
    /vendor/etc/fonts.xml; do
    [ -f "$config" ] || continue
    candidate="$(emoji_from_config "$config")"
    if valid_emoji_target "$candidate" && [ -e "/system/fonts/$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  for path in \
    /system/fonts/NotoColorEmoji.ttf \
    /system/fonts/SamsungColorEmoji.ttf \
    /system/fonts/NotoColorEmojiLegacy.ttf \
    /system/fonts/*Emoji*.ttf \
    /system/fonts/*emoji*.ttf \
    /system/fonts/*Emoji*.otf \
    /system/fonts/*emoji*.otf; do
    [ -e "$path" ] || continue
    candidate=${path##*/}
    if valid_emoji_target "$candidate"; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

clear_emoji_overlays() {
  [ -f "$EMOJI_TARGETS_FILE" ] || return 0
  while IFS= read -r target; do
    valid_emoji_target "$target" || continue
    rm -f "$SYSTEM_FONT_DIR/$target" || return 1
  done < "$EMOJI_TARGETS_FILE"
  rm -f "$EMOJI_TARGETS_FILE"
}

apply_emoji() {
  mode="$1"
  case "$mode" in
    default)
      clear_emoji_overlays || fail "emoji_clear_failed"
      printf '%s\n' "$mode" > "$EMOJI_MODE_FILE" || fail "emoji_state_failed"
      chmod 0644 "$EMOJI_MODE_FILE"
      touch "$DATA_DIR/pending_reboot"
      sync
      echo "ok=emoji"
      return 0
      ;;
    ios|google|blobmoji|facebook|custom) ;;
    *) fail "invalid_emoji_mode" ;;
  esac

  source="$(emoji_source "$mode")"
  [ -f "$source" ] || fail "emoji_source_missing"
  target="$(detect_emoji_target)"
  [ -n "$target" ] || fail "emoji_target_not_found"
  valid_emoji_target "$target" || fail "emoji_target_invalid"

  mkdir -p "$DATA_DIR" "$SYSTEM_FONT_DIR" || fail "mkdir_failed"
  cp -f "$source" "$SYSTEM_FONT_DIR/$target.new" || fail "emoji_copy_failed"
  chmod 0644 "$SYSTEM_FONT_DIR/$target.new"
  if ! clear_emoji_overlays; then
    rm -f "$SYSTEM_FONT_DIR/$target.new"
    fail "emoji_clear_failed"
  fi
  mv -f "$SYSTEM_FONT_DIR/$target.new" "$SYSTEM_FONT_DIR/$target" || fail "emoji_save_failed"
  printf '%s\n' "$target" > "$EMOJI_TARGETS_FILE" || fail "emoji_state_failed"
  printf '%s\n' "$mode" > "$EMOJI_MODE_FILE" || fail "emoji_state_failed"
  chmod 0644 "$EMOJI_TARGETS_FILE" "$EMOJI_MODE_FILE"
  touch "$DATA_DIR/pending_reboot"
  sync
  echo "ok=emoji"
}

print_status() {
  echo "module=ok"
  print_role_chain chinese
  print_role_chain western

  emoji_mode="$(read_emoji_mode)"
  emoji_target="$(cat "$EMOJI_TARGETS_FILE" 2>/dev/null)"
  custom_size=0
  [ -f "$EMOJI_CUSTOM_FILE" ] && custom_size="$(stat -c %s "$EMOJI_CUSTOM_FILE" 2>/dev/null)"
  echo "emoji_mode=$emoji_mode"
  echo "emoji_target=$emoji_target"
  echo "emoji_custom_size=$custom_size"
  echo "emoji_name_b64=$(cat "$DATA_DIR/emoji.name.b64" 2>/dev/null)"
  [ -f "$EMOJI_DIR/ios/AppleColorEmoji.ttf" ] && echo "emoji_builtin_ios=1" || echo "emoji_builtin_ios=0"
  [ -f "$EMOJI_DIR/google/NotoColorEmoji.ttf" ] && echo "emoji_builtin_google=1" || echo "emoji_builtin_google=0"
  [ -f "$EMOJI_DIR/blobmoji/Blobmoji.ttf" ] && echo "emoji_builtin_blobmoji=1" || echo "emoji_builtin_blobmoji=0"
  [ -f "$EMOJI_DIR/facebook/Facebook-Emoji.ttf" ] && echo "emoji_builtin_facebook=1" || echo "emoji_builtin_facebook=0"
  echo "western_targets=$(cat "$DATA_DIR/western.targets" 2>/dev/null)"
  echo "chinese_targets=$(cat "$DATA_DIR/chinese.targets" 2>/dev/null)"
  echo "western_scale=$(read_percent "$WESTERN_SIZE_FILE")"
  echo "chinese_weight=$(read_weight "$DATA_DIR/chinese.weight")"
  echo "western_weight=$(read_weight "$DATA_DIR/western.weight")"
  echo "fallback=$(read_fallback "$FALLBACK_FILE")"

  [ -f "$DATA_DIR/pending_reboot" ] && echo "pending_reboot=1" || echo "pending_reboot=0"

  conflicts=""
  for path in /data/adb/modules/*; do
    [ -d "$path" ] || continue
    id=${path##*/}
    [ "$id" = "${MODDIR##*/}" ] && continue
    [ -f "$path/disable" ] && continue
    [ -f "$path/remove" ] && continue
    has_font_overlay=0
    [ -f "$path/system/etc/fonts.xml" ] && has_font_overlay=1
    [ -f "$path/system/system_ext/etc/fonts_base.xml" ] && has_font_overlay=1
    [ -f "$path/system/product/etc/fonts_customization.xml" ] && has_font_overlay=1
    if [ "$has_font_overlay" = "0" ]; then
      for font in "$path"/system/fonts/*.ttf "$path"/system/fonts/*.otf "$path"/system/fonts/*.ttc; do
        [ -f "$font" ] && has_font_overlay=1 && break
      done
    fi
    if [ "$has_font_overlay" = "1" ]; then
      [ -n "$conflicts" ] && conflicts="$conflicts,$id" || conflicts="$id"
    fi
  done
  echo "conflicts=$conflicts"
}

begin_upload() {
  role_paths "$1"
  expected="$2"
  case "$expected" in
    ''|*[!0-9]*) fail "invalid_size" ;;
  esac
  [ "$expected" -gt 0 ] || fail "empty_file"
  [ "$expected" -le 536870912 ] || fail "file_too_large"
  mkdir -p "$DATA_DIR" || fail "mkdir_failed"
  rm -f "$TEMP_FILE"
  : > "$TEMP_FILE" || fail "create_failed"
  chmod 0600 "$TEMP_FILE"
  echo "ok=begin"
}

commit_upload() {
  role="$1"
  expected="$2"
  variable="$3"
  name_b64="$4"

  case "$expected" in
    ''|*[!0-9]*) fail "invalid_size" ;;
  esac
  case "$variable" in 0|1) ;; *) fail "invalid_variable" ;; esac
  case "$name_b64" in *[!A-Za-z0-9+/=]*) fail "invalid_name" ;; esac

  role_paths "$role"

  [ -f "$TEMP_FILE" ] || fail "missing_upload"
  actual="$(stat -c %s "$TEMP_FILE" 2>/dev/null)"
  [ "$actual" = "$expected" ] || fail "size_mismatch"

  if [ "$role" = "emoji" ]; then
    mv -f "$TEMP_FILE" "$TARGET_FILE" || fail "save_failed"
    chmod 0644 "$TARGET_FILE"
    printf '%s\n' "$name_b64" > "$NAME_FILE"
    chmod 0644 "$NAME_FILE"
    apply_emoji custom
    return
  fi

  migrate_role "$role"
  slot="$(next_slot "$role")"
  [ -n "$slot" ] || fail "too_many_fonts"

  mkdir -p "$SYSTEM_FONT_DIR" || fail "mkdir_failed"
  mv -f "$TEMP_FILE" "$SYSTEM_FONT_DIR/$slot" || fail "save_failed"
  chmod 0644 "$SYSTEM_FONT_DIR/$slot"
  printf '%s %s %s\n' "$slot" "$variable" "$name_b64" >> "$LIST_FILE" || fail "chain_save_failed"
  chmod 0644 "$LIST_FILE"
  apply_config
  touch "$DATA_DIR/pending_reboot"
  sync
  echo "ok=commit"
}

remove_font() {
  role="$1"
  name="$2"
  case "$role" in chinese|western) ;; *) fail "invalid_role" ;; esac
  role_paths "$role"
  valid_font_slot "$role" "$name" || fail "invalid_font_name"
  migrate_role "$role"
  [ -s "$LIST_FILE" ] || fail "font_not_found"

  tmp="$DATA_DIR/.$role.list.new"
  found=0
  : > "$tmp" || fail "chain_save_failed"
  while IFS= read -r entry; do
    set -- $entry
    [ "$1" = "$name" ] && { found=1; continue; }
    printf '%s\n' "$entry" >> "$tmp"
  done < "$LIST_FILE"

  if [ "$found" != 1 ]; then
    rm -f "$tmp"
    fail "font_not_found"
  fi

  mv -f "$tmp" "$LIST_FILE" || fail "chain_save_failed"
  chmod 0644 "$LIST_FILE"
  rm -f "$SYSTEM_FONT_DIR/$name"
  apply_config
  touch "$DATA_DIR/pending_reboot"
  sync
  echo "ok=remove"
}

reorder_fonts() {
  role="$1"
  shift
  case "$role" in chinese|western) ;; *) fail "invalid_role" ;; esac
  role_paths "$role"
  migrate_role "$role"

  tmp="$DATA_DIR/.$role.list.new"
  : > "$tmp" || fail "chain_save_failed"

  for name in "$@"; do
    [ -n "$name" ] || continue
    valid_font_slot "$role" "$name" || { rm -f "$tmp"; fail "invalid_font_name"; }
    line=""
    while IFS= read -r entry; do
      set -- $entry
      [ "$1" = "$name" ] && { line="$entry"; break; }
    done < "$LIST_FILE"
    [ -n "$line" ] || { rm -f "$tmp"; fail "font_not_found"; }
    printf '%s\n' "$line" >> "$tmp"
  done

  if [ "$(sort "$tmp" 2>/dev/null)" != "$(sort "$LIST_FILE" 2>/dev/null)" ]; then
    rm -f "$tmp"
    fail "reorder_mismatch"
  fi

  mv -f "$tmp" "$LIST_FILE" || fail "chain_save_failed"
  chmod 0644 "$LIST_FILE"
  apply_config
  touch "$DATA_DIR/pending_reboot"
  sync
  echo "ok=reorder"
}

replace_font() {
  role="$1"
  name="$2"
  expected="$3"
  variable="$4"
  name_b64="$5"
  case "$role" in chinese|western) ;; *) fail "invalid_role" ;; esac
  role_paths "$role"
  valid_font_slot "$role" "$name" || fail "invalid_font_name"
  migrate_role "$role"

  case "$expected" in ''|*[!0-9]*) fail "invalid_size" ;; esac
  case "$variable" in 0|1) ;; *) fail "invalid_variable" ;; esac
  case "$name_b64" in *[!A-Za-z0-9+/=]*) fail "invalid_name" ;; esac
  [ -f "$TEMP_FILE" ] || fail "missing_upload"
  actual="$(stat -c %s "$TEMP_FILE" 2>/dev/null)"
  [ "$actual" = "$expected" ] || fail "size_mismatch"

  tmp="$DATA_DIR/.$role.list.new"
  found=0
  : > "$tmp" || fail "chain_save_failed"
  while IFS= read -r entry; do
    set -- $entry
    if [ "$1" = "$name" ]; then
      printf '%s %s %s\n' "$name" "$variable" "$name_b64" >> "$tmp"
      found=1
    else
      printf '%s\n' "$entry" >> "$tmp"
    fi
  done < "$LIST_FILE"
  if [ "$found" != 1 ]; then
    rm -f "$tmp"
    fail "font_not_found"
  fi

  mv -f "$TEMP_FILE" "$SYSTEM_FONT_DIR/$name" || fail "save_failed"
  chmod 0644 "$SYSTEM_FONT_DIR/$name"
  mv -f "$tmp" "$LIST_FILE" || fail "chain_save_failed"
  chmod 0644 "$LIST_FILE"
  apply_config
  touch "$DATA_DIR/pending_reboot"
  sync
  echo "ok=replace"
}

abort_upload() {
  role_paths "$1"
  rm -f "$TEMP_FILE"
  echo "ok=abort"
}

set_western_size() {
  value="$1"
  case "$value" in
    ''|*[!0-9]*) fail "invalid_western_size" ;;
  esac
  [ "$value" -ge 20 ] 2>/dev/null || fail "invalid_western_size"
  [ "$value" -le 100 ] 2>/dev/null || fail "invalid_western_size"
  mkdir -p "$DATA_DIR" || fail "mkdir_failed"
  printf '%s\n' "$value" > "$WESTERN_SIZE_FILE" || fail "western_size_save_failed"
  chmod 0644 "$WESTERN_SIZE_FILE"
  apply_config
  touch "$DATA_DIR/pending_reboot"
  sync
  echo "ok=western-size"
}

set_fallback() {
  value="$1"
  case "$value" in 0|1) ;; *) fail "invalid_fallback" ;; esac
  mkdir -p "$DATA_DIR" || fail "mkdir_failed"
  printf '%s\n' "$value" > "$FALLBACK_FILE" || fail "fallback_save_failed"
  chmod 0644 "$FALLBACK_FILE"
  apply_config
  touch "$DATA_DIR/pending_reboot"
  sync
  echo "ok=fallback"
}

set_font_weight() {
  role="$1"
  value="$2"
  case "$role" in chinese|western) ;; *) fail "invalid_role" ;; esac
  case "$value" in ''|*[!0-9]*) fail "invalid_weight" ;; esac
  [ "$value" -ge 100 ] 2>/dev/null || fail "invalid_weight"
  [ "$value" -le 900 ] 2>/dev/null || fail "invalid_weight"
  mkdir -p "$DATA_DIR" || fail "mkdir_failed"
  printf '%s\n' "$value" > "$DATA_DIR/$role.weight" || fail "weight_save_failed"
  chmod 0644 "$DATA_DIR/$role.weight"
  apply_config
  touch "$DATA_DIR/pending_reboot"
  sync
  echo "ok=weight"
}

case "$1" in
  status) print_status ;;
  begin) begin_upload "$2" "$3" ;;
  commit) commit_upload "$2" "$3" "$4" "$5" ;;
  abort) abort_upload "$2" ;;
  remove) remove_font "$2" "$3" ;;
  replace) replace_font "$2" "$3" "$4" "$5" "$6" ;;
  reorder) reorder_fonts "$2" "$3" "$4" "$5" "$6" "$7" "$8" "$9" ;;
  western-size) set_western_size "$2" ;;
  weight-set) set_font_weight "$2" "$3" ;;
  fallback-set) set_fallback "$2" ;;
  emoji-set) apply_emoji "$2" ;;
  emoji-detect)
    target="$(detect_emoji_target)"
    [ -n "$target" ] || fail "emoji_target_not_found"
    echo "emoji_target=$target"
    ;;
  *) fail "invalid_command" ;;
esac
