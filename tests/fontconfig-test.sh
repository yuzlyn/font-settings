#!/system/bin/sh

set -eu

TEST_DIR=${0%/*}
SOURCE_DIR=$(cd "$TEST_DIR/.." && pwd)
WORK_DIR="${TMPDIR:-/data/local/tmp}/fontsetting-fontconfig-test.$$"
MODULE_DIR="$WORK_DIR/module"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

mkdir -p "$MODULE_DIR/tools" "$MODULE_DIR/data" "$MODULE_DIR/config" "$MODULE_DIR/system/fonts"
cp -f "$SOURCE_DIR/font-settings/tools/fontconfig.sh" "$MODULE_DIR/tools/fontconfig.sh"
cp -f "$SOURCE_DIR/font-settings/tools/fontxml.awk" "$MODULE_DIR/tools/fontxml.awk"
printf '1\n' > "$MODULE_DIR/data/chinese.variable"
printf '1\n' > "$MODULE_DIR/data/western.variable"
printf '80\n' > "$MODULE_DIR/data/western.size"

FONT_CONFIG_ROOT="$TEST_DIR/fontconfig-fixture" sh "$MODULE_DIR/tools/fontconfig.sh" prepare >/dev/null

SYSTEM_OUTPUT="$MODULE_DIR/system/etc/fonts.xml"
EXT_OUTPUT="$MODULE_DIR/system/system_ext/etc/fonts_base.xml"
PRODUCT_OUTPUT="$MODULE_DIR/system/product/etc/fonts_customization.xml"

[ "$(grep -c 'FontSettingWestern.ttf' "$SYSTEM_OUTPUT")" -eq 2 ]
[ "$(grep -c 'FontSettingChinese.ttf' "$SYSTEM_OUTPUT")" -eq 1 ]
[ "$(grep -c 'FontSettingWestern.ttf' "$EXT_OUTPUT")" -eq 1 ]
[ "$(grep -c 'FontSettingChinese.ttf' "$PRODUCT_OUTPUT")" -eq 1 ]
grep -q 'NotoSerif-Regular.ttf' "$SYSTEM_OUTPUT"
grep -q 'lang="ja"' "$SYSTEM_OUTPUT"
grep -q 'NotoSansCJK-Regular.ttc' "$SYSTEM_OUTPUT"
grep -q 'NotoColorEmoji.ttf' "$SYSTEM_OUTPUT"
grep -q '<axis tag="wght" stylevalue="700"/>' "$SYSTEM_OUTPUT"
grep -q 'FontSettingWestern.ttf' "$SYSTEM_OUTPUT"
grep -q 'size="80"' "$SYSTEM_OUTPUT"
! grep -q 'postScriptName="Roboto-Regular"' "$SYSTEM_OUTPUT"
! grep -q 'supportedAxes=' "$SYSTEM_OUTPUT"
! grep -q 'FontSettingChinese.ttf.*index=' "$SYSTEM_OUTPUT"

printf '0\n' > "$MODULE_DIR/data/chinese.variable"
printf '0\n' > "$MODULE_DIR/data/western.variable"
FONT_CONFIG_ROOT="$TEST_DIR/fontconfig-fixture" sh "$MODULE_DIR/tools/fontconfig.sh" apply >/dev/null
! grep -q '<axis ' "$MODULE_DIR/system/system_ext/etc/fonts_base.xml"
! grep -q '<axis ' "$MODULE_DIR/system/product/etc/fonts_customization.xml"

printf '100\n' > "$MODULE_DIR/data/western.size"
FONT_CONFIG_ROOT="$TEST_DIR/fontconfig-fixture" sh "$MODULE_DIR/tools/fontconfig.sh" apply >/dev/null
! grep -q 'size="100"' "$MODULE_DIR/system/etc/fonts.xml"

echo "fontconfig fixtures: passed"
