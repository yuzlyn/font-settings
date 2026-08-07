const MODULE_ID = "font-settings";
const ACTIVE_MODDIR = `/data/adb/modules/${MODULE_ID}`;
const UPDATE_MODDIR = `/data/adb/modules_update/${MODULE_ID}`;
const CHUNK_SIZE = 48 * 1024;
const TRANSLATIONS = {
  "zh-CN": {
    pageTitle: "字体设置",
    back: "返回",
    refresh: "刷新",
    authorLinkLabel: "访问 yuzlyn 的 GitHub 主页",
    authorAvatarAlt: "yuzlyn 的 GitHub 头像",
    controlsLabel: "连接与配色",
    connectingKernelSU: "正在连接 KernelSU",
    restartPending: "等待重启",
    loadingFontConfig: "正在加载字体配置",
    fontModuleConflict: "字体模块冲突",
    fontFilesLabel: "字体文件",
    chineseFont: "中文字体",
    latinFont: "西文字体",
    latinSize: "西文字号",
    loading: "读取中",
    chooseChineseTtf: "选择中文 TTF",
    chooseLatinTtf: "选择西文 TTF",
    uploadingChineseFont: "正在上传中文字体",
    uploadingLatinFont: "正在上传西文字体",
    emojiSettings: "Emoji 设置",
    loadingEmojiConfig: "正在读取系统 Emoji 配置",
    emojiDefaultName: "保持系统默认",
    emojiDefaultDetail: "不覆盖系统 Emoji 字体",
    uploadingCustomEmoji: "正在上传自定义 Emoji 字体",
    systemStatus: "系统状态",
    loadingModuleStatus: "正在读取模块状态",
    restartDevice: "重启手机",
    sourceLinkLabel: "打开字体设置源码仓库",
    sourceRepository: "源码仓库",
    communityLinksLabel: "社群与关于",
    telegramGroup: "Telegram 群组",
    telegramLinkLabel: "打开 Telegram 群组",
    qqGroup: "QQ群",
    qqGroupNumber: "群号 1082347624",
    qqLinkLabel: "打开 QQ 群 1082347624",
    about: "关于",
    aboutDetail: "查看 README",
    aboutLinkLabel: "打开 README 关于页面",
    donateAuthor: "捐赠作者",
    donateDetail: "支付宝 / 微信支付",
    donateLinkLabel: "打开捐赠页面",
    telegramCopied: "Telegram 群组链接已复制",
    qqCopied: "QQ群号已复制",
    copyFailed: "复制失败",
    versionInfo: "版本信息",
    restartDialogHeadline: "重启手机？",
    restartDialogDescription: "未保存的应用状态会丢失，重启后新字体生效。",
    cancel: "取消",
    restart: "重启",
    chooseEmoji: "选择 Emoji",
    emojiStyleLabel: "Emoji 样式",
    emojiBlobmojiName: "经典果冻人",
    emojiCustomName: "自定义文件",
    chooseTtfOrOtf: "选择 .ttf 或 .otf 文件",
    unknownFont: "未知字体",
    chooseTtfOrOtfError: "请选择 .ttf 或 .otf 字体文件",
    chooseTtfError: "请选择扩展名为 .ttf 的字体文件",
    fontSizeError: "字体文件大小必须在 512 MB 以内",
    fontHeaderIncomplete: "字体文件头不完整",
    invalidSfnt: "文件不是有效的 SFNT/TrueType 字体",
    invalidTableDirectory: "字体表目录无效",
    fontCmapMissing: "字体缺少可用的 Unicode 字符映射表",
    fontCmapUnsupported: "暂不支持此字体的字符映射格式",
    fontCmapTooLarge: "按中西文范围处理后，字体字符映射表过大",
    fontIsolationFailed: "无法隔离此字体的中文与西文字形",
    roleFontSaved: "{role}字体已保存",
    latinSizeSaved: "西文字号已设为 {size}%",
    latinSizeError: "西文字号设置失败",
    chineseRole: "中文",
    latinRole: "西文",
    uploadFailed: "上传失败",
    customEmojiSaved: "自定义 Emoji 已保存",
    emojiSourceMissing: "所选内置 Emoji 文件未包含在模块中",
    emojiTargetNotFound: "未在 /system/fonts 中找到系统正在使用的 Emoji 字体",
    emojiTargetInvalid: "检测到的系统 Emoji 文件名无效",
    emojiSetupFailed: "Emoji 设置失败",
    fileMissingSuffix: "（文件缺失）",
    currentDefaultEmoji: "当前使用系统默认 Emoji",
    overrideTarget: "覆盖目标：{target}",
    waitingForDetection: "等待检测",
    restoredDefaultEmoji: "已恢复系统默认 Emoji",
    emojiStyleSaved: "Emoji 样式已保存",
    fontFileMissing: "字体文件缺失",
    variableFont: "可变字体",
    staticFont: "静态字体",
    kernelSUConnected: "KernelSU 已连接",
    configSavedRestart: "已适配 {western} 项西文和 {chinese} 项中文字体映射，重启后生效",
    configLoaded: "已加载 {western} 项西文和 {chinese} 项中文字体映射",
    configBackupMissing: "系统字体配置备份缺失，请重新安装模块",
    configGeneratorMissing: "字体配置生成器缺失，请重新安装模块",
    configPathInvalid: "检测到无效的字体配置路径",
    configWriteFailed: "无法写入字体配置",
    configGenerateFailed: "无法生成此设备的字体配置",
    westernFamilyNotFound: "未找到系统默认西文字族",
    chineseFamilyNotFound: "未找到系统中文字体族",
    configApplyFailed: "应用字体配置失败",
    disableConflicts: "请在 KernelSU 中停用：{modules}",
    connectionFailed: "KernelSU 连接失败",
    openFromKernelSU: "请从 KernelSU 模块页面打开 WebUI",
    restartFailed: "重启失败",
  },
  "zh-TW": {
    pageTitle: "字型設定",
    back: "返回",
    refresh: "重新整理",
    authorLinkLabel: "前往 yuzlyn 的 GitHub 個人頁面",
    authorAvatarAlt: "yuzlyn 的 GitHub 大頭貼",
    controlsLabel: "連線與配色",
    connectingKernelSU: "正在連線至 KernelSU",
    restartPending: "等待重新啟動",
    loadingFontConfig: "正在載入字型設定",
    fontModuleConflict: "字型模組衝突",
    fontFilesLabel: "字型檔案",
    chineseFont: "中文字型",
    latinFont: "西文字型",
    latinSize: "西文字號",
    loading: "讀取中",
    chooseChineseTtf: "選擇中文 TTF",
    chooseLatinTtf: "選擇西文 TTF",
    uploadingChineseFont: "正在上傳中文字型",
    uploadingLatinFont: "正在上傳西文字型",
    emojiSettings: "Emoji 設定",
    loadingEmojiConfig: "正在讀取系統 Emoji 設定",
    emojiDefaultName: "保持系統預設",
    emojiDefaultDetail: "不覆寫系統 Emoji 字型",
    uploadingCustomEmoji: "正在上傳自訂 Emoji 字型",
    systemStatus: "系統狀態",
    loadingModuleStatus: "正在讀取模組狀態",
    restartDevice: "重新啟動手機",
    sourceLinkLabel: "開啟字型設定原始碼儲存庫",
    sourceRepository: "原始碼儲存庫",
    communityLinksLabel: "社群與關於",
    telegramGroup: "Telegram 群組",
    telegramLinkLabel: "開啟 Telegram 群組",
    qqGroup: "QQ 群組",
    qqGroupNumber: "群號 1082347624",
    qqLinkLabel: "開啟 QQ 群組 1082347624",
    about: "關於",
    aboutDetail: "查看 README",
    aboutLinkLabel: "開啟 README 關於頁面",
    donateAuthor: "贊助作者",
    donateDetail: "支付寶 / 微信支付",
    donateLinkLabel: "開啟贊助頁面",
    telegramCopied: "已複製 Telegram 群組連結",
    qqCopied: "已複製 QQ 群號",
    copyFailed: "複製失敗",
    versionInfo: "版本資訊",
    restartDialogHeadline: "要重新啟動手機嗎？",
    restartDialogDescription: "尚未儲存的應用程式狀態將會遺失。重新啟動後，新字型才會生效。",
    cancel: "取消",
    restart: "重新啟動",
    chooseEmoji: "選擇 Emoji",
    emojiStyleLabel: "Emoji 樣式",
    emojiBlobmojiName: "經典果凍人",
    emojiCustomName: "自訂檔案",
    chooseTtfOrOtf: "選擇 .ttf 或 .otf 檔案",
    unknownFont: "未知字型",
    chooseTtfOrOtfError: "請選擇 .ttf 或 .otf 字型檔案",
    chooseTtfError: "請選擇副檔名為 .ttf 的字型檔案",
    fontSizeError: "字型檔案大小不得超過 512 MB",
    fontHeaderIncomplete: "字型檔頭不完整",
    invalidSfnt: "檔案不是有效的 SFNT/TrueType 字型",
    invalidTableDirectory: "字型表目錄無效",
    fontCmapMissing: "字型缺少可用的 Unicode 字元對應表",
    fontCmapUnsupported: "暫不支援此字型的字元對應格式",
    fontCmapTooLarge: "依中西文範圍處理後，字型字元對應表過大",
    fontIsolationFailed: "無法隔離此字型的中文與西文字形",
    roleFontSaved: "{role}字型已儲存",
    latinSizeSaved: "西文字號已設為 {size}%",
    latinSizeError: "西文字號設定失敗",
    chineseRole: "中文",
    latinRole: "西文",
    uploadFailed: "上傳失敗",
    customEmojiSaved: "自訂 Emoji 已儲存",
    emojiSourceMissing: "模組中缺少所選的內建 Emoji 檔案",
    emojiTargetNotFound: "在 /system/fonts 中找不到系統目前使用的 Emoji 字型",
    emojiTargetInvalid: "偵測到的系統 Emoji 檔名無效",
    emojiSetupFailed: "Emoji 設定失敗",
    fileMissingSuffix: "（檔案缺失）",
    currentDefaultEmoji: "目前使用系統預設 Emoji",
    overrideTarget: "覆寫目標：{target}",
    waitingForDetection: "等待偵測",
    restoredDefaultEmoji: "已恢復系統預設 Emoji",
    emojiStyleSaved: "Emoji 樣式已儲存",
    fontFileMissing: "字型檔案缺失",
    variableFont: "可變字型",
    staticFont: "靜態字型",
    kernelSUConnected: "KernelSU 已連線",
    configSavedRestart: "已調整 {western} 個西文與 {chinese} 個中文字型對應項目，重新啟動後生效",
    configLoaded: "已載入 {western} 個西文與 {chinese} 個中文字型對應項目",
    configBackupMissing: "系統字型設定備份缺失，請重新安裝模組",
    configGeneratorMissing: "字型設定產生器缺失，請重新安裝模組",
    configPathInvalid: "偵測到無效的字型設定路徑",
    configWriteFailed: "無法寫入字型設定",
    configGenerateFailed: "無法產生此裝置的字型設定",
    westernFamilyNotFound: "找不到系統預設的西文字型家族",
    chineseFamilyNotFound: "找不到系統中文字型家族",
    configApplyFailed: "套用字型設定失敗",
    disableConflicts: "請在 KernelSU 中停用：{modules}",
    connectionFailed: "KernelSU 連線失敗",
    openFromKernelSU: "請從 KernelSU 模組頁面開啟 WebUI",
    restartFailed: "重新啟動失敗",
  },
  "en-US": {
    pageTitle: "Font settings",
    back: "Back",
    refresh: "Refresh",
    authorLinkLabel: "Open yuzlyn's GitHub profile",
    authorAvatarAlt: "yuzlyn's GitHub avatar",
    controlsLabel: "Connection and colors",
    connectingKernelSU: "Connecting to KernelSU",
    restartPending: "Restart pending",
    loadingFontConfig: "Loading font configuration",
    fontModuleConflict: "Font module conflict",
    fontFilesLabel: "Font files",
    chineseFont: "Chinese font",
    latinFont: "Latin font",
    latinSize: "Latin size",
    loading: "Loading",
    chooseChineseTtf: "Choose Chinese TTF",
    chooseLatinTtf: "Choose Latin TTF",
    uploadingChineseFont: "Uploading Chinese font",
    uploadingLatinFont: "Uploading Latin font",
    emojiSettings: "Emoji settings",
    loadingEmojiConfig: "Loading system Emoji configuration",
    emojiDefaultName: "Keep system default",
    emojiDefaultDetail: "Do not override the system Emoji font",
    uploadingCustomEmoji: "Uploading custom Emoji font",
    systemStatus: "System status",
    loadingModuleStatus: "Loading module status",
    restartDevice: "Restart device",
    sourceLinkLabel: "Open the Font settings source repository",
    sourceRepository: "Source repository",
    communityLinksLabel: "Community and about",
    telegramGroup: "Telegram group",
    telegramLinkLabel: "Open the Telegram group",
    qqGroup: "QQ group",
    qqGroupNumber: "Group 1082347624",
    qqLinkLabel: "Open QQ group 1082347624",
    about: "About",
    aboutDetail: "View README",
    aboutLinkLabel: "Open the README about page",
    donateAuthor: "Support the author",
    donateDetail: "Alipay / WeChat Pay",
    donateLinkLabel: "Open the donation page",
    telegramCopied: "Telegram group link copied",
    qqCopied: "QQ group number copied",
    copyFailed: "Copy failed",
    versionInfo: "Version information",
    restartDialogHeadline: "Restart device?",
    restartDialogDescription: "Unsaved app state will be lost. The new fonts will take effect after restart.",
    cancel: "Cancel",
    restart: "Restart",
    chooseEmoji: "Choose Emoji",
    emojiStyleLabel: "Emoji style",
    emojiBlobmojiName: "Classic Blobmoji",
    emojiCustomName: "Custom file",
    chooseTtfOrOtf: "Choose a .ttf or .otf file",
    unknownFont: "Unknown font",
    chooseTtfOrOtfError: "Choose a .ttf or .otf font file",
    chooseTtfError: "Choose a font file with the .ttf extension",
    fontSizeError: "Font file size must be between 1 byte and 512 MB",
    fontHeaderIncomplete: "The font file header is incomplete",
    invalidSfnt: "The file is not a valid SFNT/TrueType font",
    invalidTableDirectory: "The font table directory is invalid",
    fontCmapMissing: "The font has no usable Unicode character map",
    fontCmapUnsupported: "This font's character-map format is not supported",
    fontCmapTooLarge: "The isolated character map is too large for this font format",
    fontIsolationFailed: "Could not isolate the font's Chinese and Latin glyphs",
    roleFontSaved: "{role} font saved",
    latinSizeSaved: "Latin size set to {size}%",
    latinSizeError: "Could not set Latin size",
    chineseRole: "Chinese",
    latinRole: "Latin",
    uploadFailed: "Upload failed",
    customEmojiSaved: "Custom Emoji saved",
    emojiSourceMissing: "The selected built-in Emoji file is missing from the module",
    emojiTargetNotFound: "The system Emoji font currently in use was not found in /system/fonts",
    emojiTargetInvalid: "The detected system Emoji filename is invalid",
    emojiSetupFailed: "Emoji setup failed",
    fileMissingSuffix: " (file missing)",
    currentDefaultEmoji: "Using the system default Emoji",
    overrideTarget: "Override target: {target}",
    waitingForDetection: "Waiting for detection",
    restoredDefaultEmoji: "System default Emoji restored",
    emojiStyleSaved: "Emoji style saved",
    fontFileMissing: "Font file missing",
    variableFont: "Variable font",
    staticFont: "Static font",
    kernelSUConnected: "KernelSU connected",
    configSavedRestart: "Adapted {western} Latin and {chinese} Chinese font entries. Restart to apply.",
    configLoaded: "Loaded {western} Latin and {chinese} Chinese font entries",
    configBackupMissing: "The system font configuration backup is missing. Reinstall the module.",
    configGeneratorMissing: "The font configuration generator is missing. Reinstall the module.",
    configPathInvalid: "An invalid font configuration path was detected",
    configWriteFailed: "Could not write the font configuration",
    configGenerateFailed: "Could not generate a font configuration for this device",
    westernFamilyNotFound: "The system's default Latin font family was not found",
    chineseFamilyNotFound: "The system's Chinese font family was not found",
    configApplyFailed: "Could not apply the font configuration",
    disableConflicts: "Disable in KernelSU: {modules}",
    connectionFailed: "KernelSU connection failed",
    openFromKernelSU: "Open this WebUI from the KernelSU module page",
    restartFailed: "Restart failed",
  },
};

function resolveLocale() {
  const language = String(navigator.language || "").replaceAll("_", "-").toLowerCase();
  if (/^zh-(?:[^-]+-)*tw(?:-|$)/.test(language)) return "zh-TW";
  if (language === "zh" || language.startsWith("zh-")) return "zh-CN";
  return "en-US";
}

const locale = resolveLocale();
const numberFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

function t(key, variables = {}) {
  const message = TRANSLATIONS[locale][key] ?? TRANSLATIONS["en-US"][key] ?? key;
  return String(message).replace(/\{(\w+)\}/g, (_, name) => String(variables[name] ?? `{${name}}`));
}

function applyTranslations() {
  document.documentElement.lang = locale;
  document.title = t("pageTitle");
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  const attributes = ["aria-label", "title", "alt", "headline", "description"];
  for (const attribute of attributes) {
    const datasetName = `i18n${attribute.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("")}`;
    for (const element of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
      element.setAttribute(attribute, t(element.dataset[datasetName]));
    }
  }
}

const EMOJI_PRESETS = {
  default: { nameKey: "emojiDefaultName", detailKey: "emojiDefaultDetail", preview: "🙂" },
  ios: { name: "iOS / Apple", detail: "AppleColorEmoji.ttf", preview: "🍎" },
  google: { name: "Google / Pixel", detail: "NotoColorEmoji.ttf", preview: "🤖" },
  blobmoji: { nameKey: "emojiBlobmojiName", detail: "Blobmoji.ttf", preview: "🫠" },
  facebook: { name: "Facebook", detail: "Facebook-Emoji.ttf", preview: "💙" },
  custom: { nameKey: "emojiCustomName", detailKey: "chooseTtfOrOtf", preview: "📁" },
};

function localizedPreset(mode) {
  const preset = EMOJI_PRESETS[mode];
  return {
    ...preset,
    name: preset.nameKey ? t(preset.nameKey) : preset.name,
    detail: preset.detailKey ? t(preset.detailKey) : preset.detail,
  };
}
let moduleDir = ACTIVE_MODDIR;
let fontctl = `${moduleDir}/tools/fontctl.sh`;
let callbackSequence = 0;
let monetSeed = window.FontSettingsTheme?.getSeed() || "#4f635b";

const roles = {
  chinese: {
    fileInput: document.querySelector("#chinese-file"),
    button: document.querySelector("#chinese-upload"),
    name: document.querySelector("#chinese-name"),
    meta: document.querySelector("#chinese-meta"),
    type: document.querySelector("#chinese-type"),
    progress: document.querySelector("#chinese-progress"),
  },
  western: {
    fileInput: document.querySelector("#western-file"),
    button: document.querySelector("#western-upload"),
    name: document.querySelector("#western-name"),
    meta: document.querySelector("#western-meta"),
    type: document.querySelector("#western-type"),
    progress: document.querySelector("#western-progress"),
  },
};

const bridgeChip = document.querySelector("#bridge-chip");
const bridgeLabel = document.querySelector("#bridge-label");
const rebootChip = document.querySelector("#reboot-chip");
const rebootButton = document.querySelector("#reboot-button");
const rebootDialog = document.querySelector("#reboot-dialog");
const snackbar = document.querySelector("#snackbar");
const monetLabel = document.querySelector("#monet-label");
const pageProgress = document.querySelector("#page-progress");
const emojiOptions = document.querySelector("#emoji-options");
const emojiDialog = document.querySelector("#emoji-dialog");
const emojiPickerTrigger = document.querySelector("#emoji-picker-trigger");
const emojiFile = document.querySelector("#emoji-file");
const emojiProgress = document.querySelector("#emoji-progress");
const westernSize = document.querySelector("#western-size");
const westernSizeValue = document.querySelector("#western-size-value");
const topAppBar = document.querySelector("mdui-top-app-bar");
const compactTitle = document.querySelector("#compact-title");
const largeTitle = document.querySelector(".large-title");
const darkMode = window.matchMedia("(prefers-color-scheme: dark)");
let uploadInProgress = false;
let currentEmojiMode = "default";
let titleAnimationFrame = 0;
let monetSeedRequest = null;
let latestStatus = {};

function exec(command, options = {}) {
  return new Promise((resolve, reject) => {
    if (!window.ksu || typeof window.ksu.exec !== "function") {
      reject(new Error("KSU_BRIDGE_UNAVAILABLE"));
      return;
    }

    const callbackName = `font_setting_exec_${Date.now()}_${callbackSequence++}`;
    let settled = false;
    const timeoutMs = Math.max(1000, Number(options.timeout) || 30000);
    const timeout = window.setTimeout(() => finish(new Error("KSU_BRIDGE_TIMEOUT")), timeoutMs);

    function finish(error, output = "") {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      delete window[callbackName];
      if (error) reject(error);
      else resolve(String(output ?? "").trim());
    }

    window[callbackName] = (errno, stdout, stderr) => {
      const code = Number(errno) || 0;
      if (code !== 0) {
        finish(new Error(String(stderr || stdout || `command_failed_${code}`).trim()));
      } else {
        finish(null, stdout);
      }
    };

    try {
      const legacyResult = window.ksu.exec(command, JSON.stringify(options), callbackName);
      if (legacyResult !== undefined && legacyResult !== null) finish(null, legacyResult);
    } catch (modernError) {
      try {
        const legacyResult = window.ksu.exec(command);
        finish(null, legacyResult);
      } catch {
        finish(modernError);
      }
    }
  });
}

function parseProperties(text) {
  const result = {};
  for (const line of String(text).split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0) {
      result[line.slice(0, separator)] = line.slice(separator + 1);
    }
  }
  return result;
}

function assertCommand(result, expected) {
  const values = parseProperties(result);
  if (values.error) {
    throw new Error(values.error);
  }
  if (expected && values.ok !== expected) {
    throw new Error("unexpected_response");
  }
}

function applyColorScheme() {
  if (window.FontSettingsTheme) {
    window.FontSettingsTheme.applyCurrent();
    monetSeed = window.FontSettingsTheme.getSeed();
  } else {
    document.documentElement.style.setProperty("--monet-seed", monetSeed);
    mdui.setColorScheme(monetSeed);
  }
  monetLabel.textContent = `Monet ${monetSeed.toUpperCase()}`;
}

function loadMonetSeed() {
  if (monetSeedRequest) return monetSeedRequest;
  monetSeedRequest = (async () => {
    try {
      const output = await exec("settings get secure theme_customization_overlay_packages");
      const start = output.indexOf("{");
      const settings = JSON.parse(start >= 0 ? output.slice(start) : output);
      const seed = window.FontSettingsTheme?.normalizeSeed(
        settings["android.theme.customization.system_palette"] ||
          settings["android.theme.customization.accent_color"],
      );
      if (seed) {
        window.FontSettingsTheme.updateSystemSeed(seed);
        monetSeed = window.FontSettingsTheme.getSeed();
      }
    } catch {
      // Keep the cached seed when the ROM does not expose Monet settings.
    }
    applyColorScheme();
  })().finally(() => {
    monetSeedRequest = null;
  });
  return monetSeedRequest;
}

async function resolveModuleDir() {
  const result = (await exec(`[ -d '${UPDATE_MODDIR}' ] && echo '${UPDATE_MODDIR}' || echo '${ACTIVE_MODDIR}'`))
    .split(/\r?\n/)
    .at(-1);
  moduleDir = result === UPDATE_MODDIR ? UPDATE_MODDIR : ACTIVE_MODDIR;
  fontctl = `${moduleDir}/tools/fontctl.sh`;
}

function bytesToBase64(bytes) {
  let binary = "";
  const block = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += block) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + block));
  }
  return btoa(binary);
}

function utf8ToBase64(value) {
  return bytesToBase64(new TextEncoder().encode(value));
}

function base64ToUtf8(value) {
  if (!value) return t("unknownFont");
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return t("unknownFont");
  }
}

function base64ToBytes(value) {
  const binary = atob(String(value || "").replace(/\s+/g, ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${numberFormatter.format(size)} B`;
  if (size < 1024 * 1024) return `${numberFormatter.format(size / 1024)} KB`;
  return `${numberFormatter.format(size / (1024 * 1024))} MB`;
}

function normalizeWesternSize(value) {
  const size = Math.round(Number(value) || 100);
  return Math.max(20, Math.min(100, size));
}

function showMessage(message) {
  snackbar.textContent = message;
  snackbar.open = true;
}

async function copyText(value) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall back for WebViews that expose Clipboard API without granting access.
    }
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  input.remove();
  return copied;
}

function setupLongPressCopy(element) {
  let timer = 0;
  let startX = 0;
  let startY = 0;
  let longPressed = false;

  const cancel = () => {
    window.clearTimeout(timer);
    timer = 0;
    element.classList.remove("long-press-active");
  };

  element.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    cancel();
    startX = event.clientX;
    startY = event.clientY;
    longPressed = false;
    element.classList.add("long-press-active");
    timer = window.setTimeout(async () => {
      timer = 0;
      longPressed = true;
      element.classList.remove("long-press-active");
      const copied = await copyText(element.dataset.copyValue || "");
      showMessage(t(copied ? element.dataset.copyMessage : "copyFailed"));
    }, 600);
  });

  element.addEventListener("pointermove", (event) => {
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancel();
  });
  element.addEventListener("pointerup", cancel);
  element.addEventListener("pointercancel", cancel);
  element.addEventListener("pointerleave", cancel);
  element.addEventListener("dragstart", (event) => event.preventDefault());
  element.addEventListener("contextmenu", (event) => event.preventDefault());
  element.addEventListener("click", (event) => {
    if (!longPressed) return;
    event.preventDefault();
    event.stopPropagation();
    longPressed = false;
  });
}

function setProgress(element, value) {
  const number = Math.max(0, Math.min(1, Number(value) || 0));
  const percent = Math.round(number * 100);
  element.value = number;
  element.setAttribute("aria-valuenow", String(percent));
}

function setIndeterminate(element, active) {
  element.classList.toggle("hidden", !active);
  if (active) {
    element.value = undefined;
    element.removeAttribute("aria-valuenow");
  }
}

function updateTopBarTitle() {
  if (titleAnimationFrame) return;
  titleAnimationFrame = window.requestAnimationFrame(() => {
    titleAnimationFrame = 0;
    const barBottom = topAppBar.getBoundingClientRect().bottom;
    const titleSubmerged = largeTitle.getBoundingClientRect().bottom <= barBottom + 1;
    compactTitle.classList.toggle("title-visible", titleSubmerged);
    compactTitle.setAttribute("aria-hidden", String(!titleSubmerged));
  });
}

function readTag(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

async function inspectFont(file, allowOpenType = false) {
  const lowerName = file.name.toLowerCase();
  const validExtension = lowerName.endsWith(".ttf") || (allowOpenType && lowerName.endsWith(".otf"));
  if (!validExtension) {
    throw new Error(t(allowOpenType ? "chooseTtfOrOtfError" : "chooseTtfError"));
  }
  if (file.size <= 0 || file.size > 512 * 1024 * 1024) {
    throw new Error(t("fontSizeError"));
  }

  const headerBuffer = await file.slice(0, Math.min(file.size, 256 * 1024)).arrayBuffer();
  const view = new DataView(headerBuffer);
  if (view.byteLength < 12) throw new Error(t("fontHeaderIncomplete"));

  const signature = view.getUint32(0, false);
  const accepted = new Set([0x00010000, 0x4f54544f, 0x74727565, 0x74797031]);
  if (!accepted.has(signature)) throw new Error(t("invalidSfnt"));

  const tableCount = view.getUint16(4, false);
  const directorySize = 12 + tableCount * 16;
  if (tableCount === 0 || tableCount > 512 || directorySize > view.byteLength) {
    throw new Error(t("invalidTableDirectory"));
  }

  let fvar = null;
  for (let index = 0; index < tableCount; index += 1) {
    const offset = 12 + index * 16;
    if (readTag(view, offset) === "fvar") {
      fvar = {
        offset: view.getUint32(offset + 8, false),
        length: view.getUint32(offset + 12, false),
      };
      break;
    }
  }

  const axes = [];
  if (fvar && fvar.offset + fvar.length <= file.size && fvar.length >= 16) {
    const fvarBuffer = await file.slice(fvar.offset, fvar.offset + Math.min(fvar.length, 64 * 1024)).arrayBuffer();
    const fvarView = new DataView(fvarBuffer);
    const axesOffset = fvarView.getUint16(4, false);
    const axisCount = fvarView.getUint16(8, false);
    const axisSize = fvarView.getUint16(10, false);
    if (axisSize >= 20 && axisCount <= 64) {
      for (let index = 0; index < axisCount; index += 1) {
        const offset = axesOffset + index * axisSize;
        if (offset + 4 <= fvarView.byteLength) axes.push(readTag(fvarView, offset));
      }
    }
  }

  return { variableWeight: axes.includes("wght") };
}

function setBusy(role, busy) {
  const current = roles[role];
  for (const [name, item] of Object.entries(roles)) {
    item.button.disabled = busy;
    item.fileInput.disabled = busy;
    if (name !== role && !busy) item.progress.classList.add("hidden");
  }
  current.progress.classList.toggle("hidden", !busy);
  if (busy) setProgress(current.progress, 0);
  emojiPickerTrigger.disabled = busy;
  emojiFile.disabled = busy;
  westernSize.disabled = busy;
  for (const input of emojiOptions.querySelectorAll('input[name="emoji-mode"]')) {
    input.disabled = busy || input.dataset.available === "0";
  }
  document.querySelector("#refresh-button").disabled = busy;
  rebootButton.disabled = busy || rebootChip.classList.contains("hidden");
}

function setEmojiBusy(busy) {
  emojiPickerTrigger.disabled = busy;
  emojiFile.disabled = busy;
  westernSize.disabled = busy;
  emojiProgress.classList.toggle("hidden", !busy);
  if (busy) setProgress(emojiProgress, 0);
  for (const input of emojiOptions.querySelectorAll('input[name="emoji-mode"]')) {
    input.disabled = busy || input.dataset.available === "0";
  }
  document.querySelector("#refresh-button").disabled = busy;
  for (const current of Object.values(roles)) current.button.disabled = busy;
  rebootButton.disabled = busy || rebootChip.classList.contains("hidden");
}

async function appendChunk(role, bytes) {
  const encoded = bytesToBase64(bytes);
  const temporaryPath = `${moduleDir}/data/.${role}.upload`;
  const command = `printf '%s' '${encoded}' | base64 -d >> '${temporaryPath}' && echo ok`;
  if ((await exec(command)).split(/\r?\n/).at(-1) !== "ok") {
    throw new Error("write_failed");
  }
}

async function uploadRoleBytes(role, bytes, variable, name) {
  assertCommand(await exec(`${fontctl} begin ${role} ${bytes.byteLength}`), "begin");
  for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_SIZE) {
    const end = Math.min(offset + CHUNK_SIZE, bytes.byteLength);
    await appendChunk(role, bytes.subarray(offset, end));
    setProgress(roles[role].progress, end / bytes.byteLength);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  assertCommand(await exec(`${fontctl} commit ${role} ${bytes.byteLength} ${variable} ${name}`), "commit");
}

async function uploadFont(role, file) {
  if (uploadInProgress) return;
  uploadInProgress = true;
  const current = roles[role];
  setBusy(role, true);
  setProgress(current.progress, 0);

  try {
    const info = await inspectFont(file);
    if (!window.FontRoleIsolation) throw new Error("font_isolation_failed");
    const source = new Uint8Array(await file.arrayBuffer());
    let isolated = window.FontRoleIsolation.isolateFont(source, role);
    if (role === "western") {
      isolated = window.FontRoleIsolation.scaleFont(isolated, 100, normalizeWesternSize(westernSize.value));
    }
    const variable = info.variableWeight ? 1 : 0;
    const name = utf8ToBase64(file.name);
    await uploadRoleBytes(role, isolated, variable, name);
    if (role === "western") {
      assertCommand(await exec(`${fontctl} western-size ${normalizeWesternSize(westernSize.value)}`), "western-size");
    }
    showMessage(t("roleFontSaved", { role: t(role === "chinese" ? "chineseRole" : "latinRole") }));
    await refreshStatus();
  } catch (error) {
    try {
      await exec(`${fontctl} abort ${role}`);
    } catch {
      // The bridge can be unavailable before an upload starts.
    }
    showMessage(formatFontError(error));
  } finally {
    current.fileInput.value = "";
    setBusy(role, false);
    uploadInProgress = false;
  }
}

async function uploadEmojiFont(file) {
  if (uploadInProgress) return;
  uploadInProgress = true;
  setEmojiBusy(true);

  try {
    await inspectFont(file, true);
    assertCommand(await exec(`${fontctl} begin emoji ${file.size}`), "begin");

    for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
      const end = Math.min(offset + CHUNK_SIZE, file.size);
      const bytes = new Uint8Array(await file.slice(offset, end).arrayBuffer());
      await appendChunk("emoji", bytes);
      setProgress(emojiProgress, end / file.size);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const name = utf8ToBase64(file.name);
    assertCommand(await exec(`${fontctl} commit emoji ${file.size} 0 ${name}`), "emoji");
    showMessage(t("customEmojiSaved"));
    await refreshStatus();
  } catch (error) {
    try {
      await exec(`${fontctl} abort emoji`);
    } catch {
      // The bridge can be unavailable before an upload starts.
    }
    showMessage(formatEmojiError(error));
    await refreshStatus();
  } finally {
    emojiFile.value = "";
    setEmojiBusy(false);
    uploadInProgress = false;
  }
}

function formatFontError(error) {
  const message = String(error?.message || error || "");
  const messages = {
    font_config_backup_missing: t("configBackupMissing"),
    font_config_generator_missing: t("configGeneratorMissing"),
    font_config_path_invalid: t("configPathInvalid"),
    font_config_write_failed: t("configWriteFailed"),
    font_config_generate_failed: t("configGenerateFailed"),
    western_family_not_found: t("westernFamilyNotFound"),
    chinese_family_not_found: t("chineseFamilyNotFound"),
    config_apply_failed: t("configApplyFailed"),
    font_cmap_missing: t("fontCmapMissing"),
    font_cmap_unsupported: t("fontCmapUnsupported"),
    font_cmap_too_large: t("fontCmapTooLarge"),
    font_isolation_failed: t("fontIsolationFailed"),
  };
  return messages[message] || message || t("uploadFailed");
}

function formatEmojiError(error) {
  const message = String(error?.message || error || "");
  const messages = {
    emoji_source_missing: t("emojiSourceMissing"),
    emoji_target_not_found: t("emojiTargetNotFound"),
    emoji_target_invalid: t("emojiTargetInvalid"),
  };
  return messages[message] || message || t("emojiSetupFailed");
}

function renderEmoji(values) {
  const modes = new Set(Object.keys(EMOJI_PRESETS));
  currentEmojiMode = modes.has(values.emoji_mode) ? values.emoji_mode : "default";
  const availability = {
    default: true,
    ios: values.emoji_builtin_ios === "1",
    google: values.emoji_builtin_google === "1",
    blobmoji: values.emoji_builtin_blobmoji === "1",
    facebook: values.emoji_builtin_facebook === "1",
    custom: true,
  };

  for (const input of emojiOptions.querySelectorAll('input[name="emoji-mode"]')) {
    const available = availability[input.value];
    input.dataset.available = available ? "1" : "0";
    input.disabled = !available || uploadInProgress;
    input.checked = input.value === currentEmojiMode;
    const option = input.closest(".emoji-picker-option");
    option.classList.toggle("selected", input.checked);
    option.classList.toggle("unavailable", !available);
    const preset = localizedPreset(input.value);
    if (!available) {
      option.querySelector("small").textContent = `${preset.detail}${t("fileMissingSuffix")}`;
    } else if (input.value !== "custom") {
      option.querySelector("small").textContent = preset.detail;
    }
  }

  const customSize = Number(values.emoji_custom_size) || 0;
  const customName = customSize > 0 ? base64ToUtf8(values.emoji_name_b64) : t("chooseTtfOrOtf");
  document.querySelector("#emoji-custom-name").textContent = customSize > 0
    ? `${customName} · ${formatBytes(customSize)}`
    : customName;
  const selectedPreset = localizedPreset(currentEmojiMode);
  document.querySelector("#selected-emoji-preview").textContent = selectedPreset.preview;
  document.querySelector("#selected-emoji-name").textContent = selectedPreset.name;
  document.querySelector("#selected-emoji-detail").textContent = currentEmojiMode === "custom"
    ? customName
    : selectedPreset.detail;
  document.querySelector("#emoji-status").textContent = currentEmojiMode === "default"
    ? t("currentDefaultEmoji")
    : t("overrideTarget", { target: values.emoji_target || t("waitingForDetection") });
}

async function applyEmojiMode(mode) {
  if (uploadInProgress || mode === "custom") {
    if (mode === "custom" && !uploadInProgress) {
      emojiDialog.open = false;
      emojiFile.click();
    }
    return;
  }

  emojiDialog.open = false;
  uploadInProgress = true;
  setEmojiBusy(true);
  try {
    assertCommand(await exec(`${fontctl} emoji-set ${mode}`), "emoji");
    showMessage(t(mode === "default" ? "restoredDefaultEmoji" : "emojiStyleSaved"));
    await refreshStatus();
  } catch (error) {
    showMessage(formatEmojiError(error));
    await refreshStatus();
  } finally {
    setEmojiBusy(false);
    uploadInProgress = false;
  }
}

function renderRole(role, values) {
  const current = roles[role];
  const size = Number(values[`${role}_size`]) || 0;
  const variable = values[`${role}_variable`] === "1";
  current.name.textContent = base64ToUtf8(values[`${role}_name_b64`]);
  current.meta.textContent = size > 0 ? formatBytes(size) : t("fontFileMissing");
  current.type.textContent = t(variable ? "variableFont" : "staticFont");
}

function renderWesternSize(values) {
  const size = normalizeWesternSize(values.western_scale);
  westernSize.value = String(size);
  westernSizeValue.textContent = `${size}%`;
}

async function applyWesternSize() {
  const size = normalizeWesternSize(westernSize.value);
  const previousSize = normalizeWesternSize(latestStatus.western_scale);
  westernSize.value = String(size);
  westernSizeValue.textContent = `${size}%`;
  westernSize.disabled = true;
  document.querySelector("#refresh-button").disabled = true;
  try {
    if (!window.FontRoleIsolation || typeof window.FontRoleIsolation.scaleFont !== "function") {
      throw new Error("font_isolation_failed");
    }
    const encoded = await exec(`base64 '${moduleDir}/system/fonts/FontSettingWestern.ttf'`, { timeout: 60000 });
    const current = base64ToBytes(encoded);
    const scaled = window.FontRoleIsolation.scaleFont(current, previousSize, size);
    await uploadRoleBytes(
      "western",
      scaled,
      latestStatus.western_variable === "1" ? 1 : 0,
      latestStatus.western_name_b64 || utf8ToBase64("FontSettingWestern.ttf"),
    );
    assertCommand(await exec(`${fontctl} western-size ${size}`), "western-size");
    showMessage(t("latinSizeSaved", { size }));
    await refreshStatus();
  } catch (error) {
    showMessage(formatFontError(error) || t("latinSizeError"));
    await refreshStatus();
  } finally {
    westernSize.disabled = uploadInProgress;
    document.querySelector("#refresh-button").disabled = uploadInProgress;
  }
}

async function refreshStatus() {
  setIndeterminate(pageProgress, true);
  try {
    await resolveModuleDir();
    const values = parseProperties(await exec(`${fontctl} status`));
    if (values.module !== "ok") throw new Error("status_failed");
    latestStatus = values;

    bridgeLabel.textContent = t("kernelSUConnected");
    bridgeChip.classList.add("connected");
    bridgeChip.classList.remove("connection-error");
    renderRole("chinese", values);
    renderRole("western", values);
    renderWesternSize(values);
    renderEmoji(values);

    const pending = values.pending_reboot === "1";
    const configTargets = {
      western: values.western_targets || "0",
      chinese: values.chinese_targets || "0",
    };
    rebootChip.classList.toggle("hidden", !pending);
    rebootButton.disabled = !pending || uploadInProgress;
    document.querySelector("#system-status").textContent = pending
      ? t("configSavedRestart", configTargets)
      : t("configLoaded", configTargets);

    const conflicts = (values.conflicts || "").split(",").filter(Boolean);
    const conflictCard = document.querySelector("#conflict-card");
    conflictCard.classList.toggle("hidden", conflicts.length === 0);
    document.querySelector("#conflict-text").textContent = conflicts.length
      ? t("disableConflicts", { modules: conflicts.join(locale === "en-US" ? ", " : "、") })
      : "";
  } catch (error) {
    bridgeLabel.textContent = t("connectionFailed");
    bridgeChip.classList.remove("connected");
    bridgeChip.classList.add("connection-error");
    document.querySelector("#system-status").textContent = t("openFromKernelSU");
    rebootButton.disabled = true;
  } finally {
    setIndeterminate(pageProgress, false);
  }
}

function initialize() {
  applyTranslations();
  applyColorScheme();

  for (const element of document.querySelectorAll(".copy-resource")) {
    setupLongPressCopy(element);
  }

  darkMode.addEventListener("change", applyColorScheme);
  window.addEventListener("focus", loadMonetSeed);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") loadMonetSeed();
  });
  window.addEventListener("scroll", updateTopBarTitle, { passive: true });
  window.addEventListener("resize", updateTopBarTitle, { passive: true });
  updateTopBarTitle();

  for (const [role, current] of Object.entries(roles)) {
    current.button.addEventListener("click", () => current.fileInput.click());
    current.fileInput.addEventListener("change", () => {
      const [file] = current.fileInput.files;
      if (file) uploadFont(role, file);
    });
  }

  for (const input of emojiOptions.querySelectorAll('input[name="emoji-mode"]')) {
    input.addEventListener("change", () => {
      for (const option of emojiOptions.querySelectorAll(".emoji-picker-option")) {
        option.classList.toggle("selected", option.contains(input));
      }
      applyEmojiMode(input.value);
    });
  }
  emojiPickerTrigger.addEventListener("click", () => {
    emojiDialog.open = true;
  });
  document.querySelector("#close-emoji-dialog").addEventListener("click", () => {
    emojiDialog.open = false;
  });
  emojiFile.addEventListener("change", () => {
    const [file] = emojiFile.files;
    if (file) uploadEmojiFont(file);
    else refreshStatus();
  });
  emojiFile.addEventListener("cancel", refreshStatus);
  westernSize.addEventListener("input", () => {
    westernSizeValue.textContent = `${normalizeWesternSize(westernSize.value)}%`;
  });
  westernSize.addEventListener("change", applyWesternSize);

  document.querySelector("#back-button").addEventListener("click", () => {
    if (window.history.length > 1) window.history.back();
    else window.close();
  });

  document.querySelector("#refresh-button").addEventListener("click", async () => {
    document.querySelector("#refresh-button").disabled = true;
    await Promise.all([loadMonetSeed(), refreshStatus()]);
    document.querySelector("#refresh-button").disabled = uploadInProgress;
  });
  rebootButton.addEventListener("click", () => {
    rebootDialog.open = true;
  });
  document.querySelector("#cancel-reboot").addEventListener("click", () => {
    rebootDialog.open = false;
  });
  document.querySelector("#confirm-reboot").addEventListener("click", async () => {
    rebootDialog.open = false;
    try {
      await exec("svc power reboot");
    } catch (error) {
      showMessage(error.message || t("restartFailed"));
    }
  });

  loadMonetSeed();
  refreshStatus();
}

window.addEventListener("DOMContentLoaded", initialize);
