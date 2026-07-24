#!/system/bin/sh

SCRIPT_DIR=${0%/*}
MODDIR=$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd)
DATA_DIR="$MODDIR/data"
ORIGINAL_DIR="$MODDIR/config/original"
MANIFEST="$DATA_DIR/font-configs.list"
AWK_SCRIPT="$SCRIPT_DIR/fontxml.awk"
SYSTEM_ROOT=${FONT_CONFIG_ROOT:-}

fail() {
  echo "error=$1"
  exit 1
}

read_flag() {
  value="$(cat "$1" 2>/dev/null)"
  [ "$value" = "1" ] || value=0
  echo "$value"
}

valid_relative_path() {
  case "$1" in
    etc/fonts.xml|etc/font_fallback.xml|system_ext/etc/fonts.xml|system_ext/etc/fonts_base.xml|product/etc/fonts.xml|product/etc/fonts_customization.xml|vendor/etc/fonts.xml) return 0 ;;
    *) return 1 ;;
  esac
}

manifest_ready() {
  [ -s "$MANIFEST" ] || return 1
  while IFS= read -r relative; do
    valid_relative_path "$relative" || return 1
    [ -f "$ORIGINAL_DIR/$relative" ] || return 1
  done < "$MANIFEST"
}

capture_one() {
  source="$SYSTEM_ROOT$1"
  relative="$2"
  [ -f "$source" ] || return 0
  [ -f "$ORIGINAL_DIR/$relative" ] && return 0
  mkdir -p "${ORIGINAL_DIR}/${relative%/*}" || fail "config_backup_failed"
  cp -af "$source" "$ORIGINAL_DIR/$relative" || fail "config_backup_failed"
  printf '%s\n' "$relative" >> "$MANIFEST.new" || fail "config_manifest_failed"
}

capture_configs() {
  if manifest_ready; then
    echo "ok=capture"
    return 0
  fi

  rm -rf "$ORIGINAL_DIR"
  mkdir -p "$ORIGINAL_DIR" "$DATA_DIR" || fail "config_backup_failed"
  : > "$MANIFEST.new" || fail "config_manifest_failed"

  capture_one /system/etc/fonts.xml etc/fonts.xml
  capture_one /system/etc/font_fallback.xml etc/font_fallback.xml
  capture_one /system_ext/etc/fonts.xml system_ext/etc/fonts.xml
  capture_one /system_ext/etc/fonts_base.xml system_ext/etc/fonts_base.xml
  if [ ! -f "$ORIGINAL_DIR/system_ext/etc/fonts_base.xml" ]; then
    capture_one /system/system_ext/etc/fonts_base.xml system_ext/etc/fonts_base.xml
  fi
  capture_one /product/etc/fonts.xml product/etc/fonts.xml
  capture_one /product/etc/fonts_customization.xml product/etc/fonts_customization.xml
  capture_one /vendor/etc/fonts.xml vendor/etc/fonts.xml

  [ -f "$ORIGINAL_DIR/etc/fonts.xml" ] || fail "system_fonts_config_missing"
  sort -u "$MANIFEST.new" > "$MANIFEST" || fail "config_manifest_failed"
  rm -f "$MANIFEST.new"
  chmod 0644 "$MANIFEST"
  echo "ok=capture"
}

apply_configs() {
  manifest_ready || fail "font_config_backup_missing"
  [ -f "$AWK_SCRIPT" ] || fail "font_config_generator_missing"

  western_variable="$(read_flag "$DATA_DIR/western.variable")"
  chinese_variable="$(read_flag "$DATA_DIR/chinese.variable")"
  total_western=0
  total_chinese=0

  while IFS= read -r relative; do
    valid_relative_path "$relative" || fail "font_config_path_invalid"
    source="$ORIGINAL_DIR/$relative"
    output="$MODDIR/system/$relative"
    stats_file="$DATA_DIR/.fontxml.stats"
    allow_unnamed=0
    [ "$relative" = "etc/fonts.xml" ] && allow_unnamed=1
    mkdir -p "${output%/*}" || fail "font_config_write_failed"

    awk \
      -v western="FontSettingWestern.ttf" \
      -v chinese="FontSettingChinese.ttf" \
      -v western_variable="$western_variable" \
      -v chinese_variable="$chinese_variable" \
      -v allow_unnamed="$allow_unnamed" \
      -v stats="$stats_file" \
      -f "$AWK_SCRIPT" "$source" > "$output.new" || fail "font_config_generate_failed"

    set -- $(cat "$stats_file" 2>/dev/null)
    western_count=${1:-0}
    chinese_count=${2:-0}
    total_western=$((total_western + western_count))
    total_chinese=$((total_chinese + chinese_count))
    chmod 0644 "$output.new"
    mv -f "$output.new" "$output" || fail "font_config_write_failed"
  done < "$MANIFEST"

  rm -f "$DATA_DIR/.fontxml.stats"
  [ "$total_western" -gt 0 ] || fail "western_family_not_found"
  [ "$total_chinese" -gt 0 ] || fail "chinese_family_not_found"
  printf '%s\n' "$total_western" > "$DATA_DIR/western.targets"
  printf '%s\n' "$total_chinese" > "$DATA_DIR/chinese.targets"
  chmod 0644 "$DATA_DIR/western.targets" "$DATA_DIR/chinese.targets"
  echo "ok=config"
}

case "$1" in
  capture) capture_configs ;;
  apply) apply_configs ;;
  prepare)
    capture_configs >/dev/null || exit 1
    apply_configs
    ;;
  *) fail "invalid_config_command" ;;
esac
