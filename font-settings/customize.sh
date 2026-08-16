#!/system/bin/sh

ui_print "*******************************"
ui_print " font settings"
ui_print " by yuzlyn"
ui_print "*******************************"

sdk="$(getprop ro.build.version.sdk)"
case "$sdk" in ''|*[!0-9]*) abort "! 无法读取 Android API 版本" ;; esac
[ "$sdk" -ge 26 ] || abort "! 仅支持 Android 8.0 及以上版本（API 26+）"

MODID=font-settings
LEGACY_MODID=font_setting_coloros16
OLDMOD="/data/adb/modules/$MODID"
[ -d "$OLDMOD" ] || OLDMOD="/data/adb/modules/$LEGACY_MODID"

# 更新模块时保留用户已经上传的字体和元数据。
if [ -f "$OLDMOD/system/fonts/FontSettingChinese.ttf" ] && [ -f "$OLDMOD/system/fonts/FontSettingWestern.ttf" ]; then
  ui_print "- 保留已上传的字体"
  cp -af "$OLDMOD/system/fonts/FontSettingChinese.ttf" "$MODPATH/system/fonts/FontSettingChinese.ttf"
  cp -af "$OLDMOD/system/fonts/FontSettingWestern.ttf" "$MODPATH/system/fonts/FontSettingWestern.ttf"
  for file in chinese.name.b64 chinese.variable western.name.b64 western.variable; do
    [ -f "$OLDMOD/data/$file" ] && cp -af "$OLDMOD/data/$file" "$MODPATH/data/$file"
  done

  # 保留多字体链：slot 字体文件与顺序清单。
  for slot in "$OLDMOD"/system/fonts/FontSettingChinese-*.ttf "$OLDMOD"/system/fonts/FontSettingWestern-*.ttf; do
    [ -f "$slot" ] && cp -af "$slot" "$MODPATH/system/fonts/"
  done
  for file in chinese.list western.list; do
    [ -f "$OLDMOD/data/$file" ] && cp -af "$OLDMOD/data/$file" "$MODPATH/data/$file"
  done
fi

# 通用版保留首次安装时捕获的 ROM 原始配置，避免模块更新时备份到自己的 overlay。
if [ -s "$OLDMOD/data/font-configs.list" ] && [ -d "$OLDMOD/config/original" ]; then
  mkdir -p "$MODPATH/config/original"
  cp -af "$OLDMOD/config/original/." "$MODPATH/config/original/"
  cp -af "$OLDMOD/data/font-configs.list" "$MODPATH/data/font-configs.list"
fi

# 保留缺字回退开关状态，避免更新时被重置。
if [ -f "$OLDMOD/data/fallback" ]; then
  mkdir -p "$MODPATH/data"
  cp -af "$OLDMOD/data/fallback" "$MODPATH/data/fallback"
fi

config_result="$(sh "$MODPATH/tools/fontconfig.sh" prepare 2>&1)"
if [ "$?" -ne 0 ]; then
  ui_print "! 无法适配此设备的字体配置"
  ui_print "! $config_result"
  abort "! 未修改系统，请将安装日志反馈给开发者"
fi
ui_print "- 已动态适配系统字体配置"
ui_print "- 西文字体映射：$(cat "$MODPATH/data/western.targets" 2>/dev/null) 项"
ui_print "- 中文字体映射：$(cat "$MODPATH/data/chinese.targets" 2>/dev/null) 项"

# 保留自定义 Emoji 及选择状态；目标文件名会基于本次系统重新检测。
for file in emoji-custom.font emoji.name.b64 emoji.mode; do
  [ -f "$OLDMOD/data/$file" ] && cp -af "$OLDMOD/data/$file" "$MODPATH/data/$file"
done

emoji_mode="$(cat "$MODPATH/data/emoji.mode" 2>/dev/null)"
case "$emoji_mode" in
  ios|google|blobmoji|facebook|custom)
    if sh "$MODPATH/tools/fontctl.sh" emoji-set "$emoji_mode" >/dev/null 2>&1; then
      ui_print "- 保留 Emoji 设置：$emoji_mode"
    else
      printf '%s\n' default > "$MODPATH/data/emoji.mode"
      ui_print "! 无法恢复原 Emoji 设置，已改为系统默认"
    fi
    ;;
  *) printf '%s\n' default > "$MODPATH/data/emoji.mode" ;;
esac

set_perm_recursive "$MODPATH" 0 0 0755 0644
set_perm "$MODPATH/customize.sh" 0 0 0755
set_perm "$MODPATH/post-fs-data.sh" 0 0 0755
set_perm "$MODPATH/service.sh" 0 0 0755
set_perm "$MODPATH/action.sh" 0 0 0755
set_perm "$MODPATH/tools/fontctl.sh" 0 0 0755
set_perm "$MODPATH/tools/fontconfig.sh" 0 0 0755
set_perm "$MODPATH/tools/fontxml.awk" 0 0 0644

ui_print "- 安装完成"
ui_print "- 请在 KernelSU 中打开模块 WebUI 上传字体"
ui_print "- 支持 Android 8.0+，不再限定 ColorOS 或 Android 16"
ui_print "- 请勿与其他字体替换模块同时启用"
