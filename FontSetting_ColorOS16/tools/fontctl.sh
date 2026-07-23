#!/system/bin/sh

SCRIPT_DIR=${0%/*}
MODDIR=$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd)
DATA_DIR="$MODDIR/data"
SYSTEM_FONT_DIR="$MODDIR/system/fonts"

fail() {
  echo "error=$1"
  exit 1
}

role_paths() {
  case "$1" in
    chinese)
      TARGET_FILE="$SYSTEM_FONT_DIR/FontSettingChinese.ttf"
      ROLE_FILE="$TARGET_FILE"
      NAME_FILE="$DATA_DIR/chinese.name.b64"
      VARIABLE_FILE="$DATA_DIR/chinese.variable"
      TEMP_FILE="$DATA_DIR/.chinese.upload"
      ;;
    western)
      TARGET_FILE="$SYSTEM_FONT_DIR/FontSettingWestern.ttf"
      ROLE_FILE="$TARGET_FILE"
      NAME_FILE="$DATA_DIR/western.name.b64"
      VARIABLE_FILE="$DATA_DIR/western.variable"
      TEMP_FILE="$DATA_DIR/.western.upload"
      ;;
    *) fail "invalid_role" ;;
  esac
}

read_flag() {
  value="$(cat "$1" 2>/dev/null)"
  [ "$value" = "1" ] || value=0
  echo "$value"
}

apply_config() {
  western_variable="$(read_flag "$DATA_DIR/western.variable")"
  chinese_variable="$(read_flag "$DATA_DIR/chinese.variable")"
  config="$MODDIR/config/fonts-w${western_variable}-c${chinese_variable}.xml"
  [ -f "$config" ] || fail "missing_config"

  cp -f "$config" "$MODDIR/system/etc/fonts.xml.new" || fail "config_copy_failed"
  cp -f "$config" "$MODDIR/system/system_ext/etc/fonts_base.xml.new" || fail "config_copy_failed"
  chmod 0644 "$MODDIR/system/etc/fonts.xml.new" "$MODDIR/system/system_ext/etc/fonts_base.xml.new"
  mv -f "$MODDIR/system/etc/fonts.xml.new" "$MODDIR/system/etc/fonts.xml"
  mv -f "$MODDIR/system/system_ext/etc/fonts_base.xml.new" "$MODDIR/system/system_ext/etc/fonts_base.xml"
}

print_status() {
  echo "module=ok"
  for role in chinese western; do
    role_paths "$role"
    size=0
    [ -f "$ROLE_FILE" ] && size="$(stat -c %s "$ROLE_FILE" 2>/dev/null)"
    name="$(cat "$NAME_FILE" 2>/dev/null)"
    variable="$(read_flag "$VARIABLE_FILE")"
    echo "${role}_size=$size"
    echo "${role}_name_b64=$name"
    echo "${role}_variable=$variable"
  done

  [ -f "$DATA_DIR/pending_reboot" ] && echo "pending_reboot=1" || echo "pending_reboot=0"

  conflicts=""
  for id in PixelFonts PingRSCCaesiumVFOPlusOni tptq_and_googlesans; do
    path="/data/adb/modules/$id"
    if [ -d "$path" ] && [ ! -f "$path/disable" ] && [ ! -f "$path/remove" ]; then
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
  role_paths "$1"
  expected="$2"
  variable="$3"
  name_b64="$4"

  case "$expected" in
    ''|*[!0-9]*) fail "invalid_size" ;;
  esac
  case "$variable" in 0|1) ;; *) fail "invalid_variable" ;; esac
  case "$name_b64" in *[!A-Za-z0-9+/=]*) fail "invalid_name" ;; esac
  [ -f "$TEMP_FILE" ] || fail "missing_upload"

  actual="$(stat -c %s "$TEMP_FILE" 2>/dev/null)"
  [ "$actual" = "$expected" ] || fail "size_mismatch"

  mv -f "$TEMP_FILE" "$TARGET_FILE" || fail "save_failed"
  chmod 0644 "$TARGET_FILE"
  printf '%s\n' "$name_b64" > "$NAME_FILE"
  printf '%s\n' "$variable" > "$VARIABLE_FILE"
  chmod 0644 "$NAME_FILE" "$VARIABLE_FILE"

  apply_config
  touch "$DATA_DIR/pending_reboot"
  sync
  echo "ok=commit"
}

abort_upload() {
  role_paths "$1"
  rm -f "$TEMP_FILE"
  echo "ok=abort"
}

case "$1" in
  status) print_status ;;
  begin) begin_upload "$2" "$3" ;;
  commit) commit_upload "$2" "$3" "$4" "$5" ;;
  abort) abort_upload "$2" ;;
  *) fail "invalid_command" ;;
esac
