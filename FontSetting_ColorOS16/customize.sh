#!/system/bin/sh

ui_print "*******************************"
ui_print " font setting for coloros16"
ui_print " by yuzlyn"
ui_print "*******************************"

if [ "$(getprop ro.build.version.sdk)" != "36" ]; then
  abort "! 仅支持 Android 16 / ColorOS 16（API 36）"
fi

MODID=font_setting_coloros16
OLDMOD="/data/adb/modules/$MODID"

# 更新模块时保留用户已经上传的字体和元数据。
if [ -f "$OLDMOD/system/fonts/FontSettingChinese.ttf" ] && [ -f "$OLDMOD/system/fonts/FontSettingWestern.ttf" ]; then
  ui_print "- 保留已上传的字体"
  cp -af "$OLDMOD/system/fonts/FontSettingChinese.ttf" "$MODPATH/system/fonts/FontSettingChinese.ttf"
  cp -af "$OLDMOD/system/fonts/FontSettingWestern.ttf" "$MODPATH/system/fonts/FontSettingWestern.ttf"
  for file in chinese.name.b64 chinese.variable western.name.b64 western.variable; do
    [ -f "$OLDMOD/data/$file" ] && cp -af "$OLDMOD/data/$file" "$MODPATH/data/$file"
  done

  chinese_variable="$(cat "$MODPATH/data/chinese.variable" 2>/dev/null)"
  western_variable="$(cat "$MODPATH/data/western.variable" 2>/dev/null)"
  [ "$chinese_variable" = "1" ] || chinese_variable=0
  [ "$western_variable" = "1" ] || western_variable=0
  config="$MODPATH/config/fonts-w${western_variable}-c${chinese_variable}.xml"
  cp -af "$config" "$MODPATH/system/etc/fonts.xml"
  cp -af "$config" "$MODPATH/system/system_ext/etc/fonts_base.xml"
fi

set_perm_recursive "$MODPATH" 0 0 0755 0644
set_perm "$MODPATH/customize.sh" 0 0 0755
set_perm "$MODPATH/post-fs-data.sh" 0 0 0755
set_perm "$MODPATH/service.sh" 0 0 0755
set_perm "$MODPATH/action.sh" 0 0 0755
set_perm "$MODPATH/tools/fontctl.sh" 0 0 0755

ui_print "- 安装完成"
ui_print "- 请在 KernelSU 中打开模块 WebUI 上传字体"
ui_print "- 与其他字体模块同时启用会发生挂载冲突"
