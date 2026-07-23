#!/system/bin/sh

MODDIR=${0%/*}
chmod 0644 "$MODDIR/system/fonts/FontSettingChinese.ttf" 2>/dev/null
chmod 0644 "$MODDIR/system/fonts/FontSettingWestern.ttf" 2>/dev/null
chmod 0644 "$MODDIR/system/etc/fonts.xml" 2>/dev/null
chmod 0644 "$MODDIR/system/system_ext/etc/fonts_base.xml" 2>/dev/null

