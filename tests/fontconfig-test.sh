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
# Placeholder slot files: read_role_chain only keeps fonts whose file still
# exists, mirroring the real module where removing a font deletes the file.
: > "$MODULE_DIR/system/fonts/FontSettingChinese.ttf"
: > "$MODULE_DIR/system/fonts/FontSettingWestern.ttf"

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

# Variable font weight shift: 400 is the identity; other values shift every
# slot's wght axis value and clamp into the 100-900 range.
printf '1\n' > "$MODULE_DIR/data/chinese.variable"
printf '1\n' > "$MODULE_DIR/data/western.variable"
printf '700\n' > "$MODULE_DIR/data/western.weight"
printf '300\n' > "$MODULE_DIR/data/chinese.weight"
FONT_CONFIG_ROOT="$TEST_DIR/fontconfig-fixture" sh "$MODULE_DIR/tools/fontconfig.sh" apply >/dev/null
grep -q '<axis tag="wght" stylevalue="900"/>' "$SYSTEM_OUTPUT"
grep -q '<axis tag="wght" stylevalue="300"/>' "$SYSTEM_OUTPUT"
# The unshifted 700 slot must survive when only the 400 slot moves to 700.
[ "$(grep -c '<axis tag="wght" stylevalue="700"/>' "$SYSTEM_OUTPUT")" -eq 1 ]

# Non-numeric weight values fall back to the identity.
printf 'abc\n' > "$MODULE_DIR/data/western.weight"
printf 'abc\n' > "$MODULE_DIR/data/chinese.weight"
FONT_CONFIG_ROOT="$TEST_DIR/fontconfig-fixture" sh "$MODULE_DIR/tools/fontconfig.sh" apply >/dev/null
grep -q '<axis tag="wght" stylevalue="400"/>' "$SYSTEM_OUTPUT"
grep -q '<axis tag="wght" stylevalue="700"/>' "$SYSTEM_OUTPUT"
! grep -q '<axis tag="wght" stylevalue="900"/>' "$SYSTEM_OUTPUT"

# Removing every font must restore the original system configuration
# verbatim: once the slot files are gone, the chain is empty and the
# generator emits the stock families untouched, so no missing font file is
# ever referenced (the previous behaviour referenced the deleted bundled
# files and could prevent booting).
rm -f "$MODULE_DIR/system/fonts/FontSettingChinese.ttf" "$MODULE_DIR/system/fonts/FontSettingWestern.ttf"
printf '400\n' > "$MODULE_DIR/data/western.weight"
printf '400\n' > "$MODULE_DIR/data/chinese.weight"
FONT_CONFIG_ROOT="$TEST_DIR/fontconfig-fixture" sh "$MODULE_DIR/tools/fontconfig.sh" apply >/dev/null
! grep -q 'FontSetting' "$SYSTEM_OUTPUT"
! grep -q 'FontSetting' "$EXT_OUTPUT"
! grep -q 'FontSetting' "$PRODUCT_OUTPUT"
grep -q '<family name="sans-serif">' "$SYSTEM_OUTPUT"
grep -q 'postScriptName="Roboto-Regular" supportedAxes="wght,ital"' "$SYSTEM_OUTPUT"
cmp -s "$SYSTEM_OUTPUT" "$TEST_DIR/fontconfig-fixture/system/etc/fonts.xml"
cmp -s "$EXT_OUTPUT" "$TEST_DIR/fontconfig-fixture/system_ext/etc/fonts_base.xml"
cmp -s "$PRODUCT_OUTPUT" "$TEST_DIR/fontconfig-fixture/product/etc/fonts_customization.xml"

# One role emptied while the other still carries fonts: the emptied role goes
# back to system defaults, the other role is still adapted.
: > "$MODULE_DIR/system/fonts/FontSettingWestern.ttf"
printf 'FontSettingWestern.ttf 1 Q2Flc2l1bVZGLVVwcmlnaHQudHRm\n' > "$MODULE_DIR/data/western.list"
FONT_CONFIG_ROOT="$TEST_DIR/fontconfig-fixture" sh "$MODULE_DIR/tools/fontconfig.sh" apply >/dev/null
! grep -q 'FontSettingChinese' "$SYSTEM_OUTPUT"
! grep -q 'FontSettingChinese' "$PRODUCT_OUTPUT"
grep -q 'FontSettingWestern.ttf' "$SYSTEM_OUTPUT"
grep -q 'NotoSansCJK-Regular.ttc' "$SYSTEM_OUTPUT"

echo "fontconfig fixtures: passed"
