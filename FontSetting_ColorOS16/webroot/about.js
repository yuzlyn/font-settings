const ABOUT_TRANSLATIONS = {
  "zh-CN": {
    back: "返回",
    readme: "README",
    authorLinkLabel: "访问 yuzlyn 的 GitHub 主页",
    authorAvatarAlt: "yuzlyn 的 GitHub 头像",
    overview: "适用于 Android 8.0 及以上版本的通用 KernelSU 字体与 Emoji 管理模块。",
    readmeLabel: "模块 README",
    compatibilityTitle: "兼容范围",
    compatibilityAndroid: "Android 8.0 及以上版本（API 26+）。",
    compatibilityRoot: "KernelSU，或兼容 KernelSU WebUI 与 systemless 模块挂载的实现。",
    compatibilityXml: "使用标准 Android familyset 或 fonts-modification XML 字体配置。",
    compatibilityNote: "使用私有字体引擎的设备可能会在安装时被拒绝，避免写入不安全的配置。",
    featuresTitle: "功能",
    featureFonts: "分别上传中文和西文 TTF 文件。",
    featureEmoji: "使用四款内置 Emoji，或上传自定义 TTF/OTF。",
    featureDetection: "安装时检测设备实际的字体 XML 与 Emoji 目标文件名。",
    featureLanguages: "WebUI 支持简体中文、台湾繁体中文和英文。",
    workingTitle: "工作方式",
    workingText: "安装程序会备份设备字体配置，只改写默认西文字族与中文语言 family，再通过 KernelSU 挂载生成的文件，不直接修改系统分区。",
    emojiTitle: "内置 Emoji",
    recoveryTitle: "故障恢复",
    recoveryText: "如果出现字体缺失或系统无法正常启动，请在 KernelSU 中停用模块并重启。保留 adb root 时也可以执行：",
    linksTitle: "相关链接",
    projectLinksLabel: "项目链接",
    sourceRepository: "源码仓库",
    telegramGroup: "Telegram 群组",
    qqGroup: "QQ群 1082347624",
    donateTitle: "捐赠作者",
    donateSubtitle: "支付宝",
    paymentMethods: "支付方式",
    alipayAlt: "支付宝收款二维码",
    wechatPay: "微信支付",
    wechatAlt: "微信支付收款二维码",
  },
  "zh-TW": {
    back: "返回",
    readme: "README",
    authorLinkLabel: "前往 yuzlyn 的 GitHub 個人頁面",
    authorAvatarAlt: "yuzlyn 的 GitHub 大頭貼",
    overview: "適用於 Android 8.0 以上版本的通用 KernelSU 字型與 Emoji 管理模組。",
    readmeLabel: "模組 README",
    compatibilityTitle: "相容範圍",
    compatibilityAndroid: "Android 8.0 以上版本（API 26+）。",
    compatibilityRoot: "KernelSU，或相容 KernelSU WebUI 與 systemless 模組掛載的實作。",
    compatibilityXml: "使用標準 Android familyset 或 fonts-modification XML 字型設定。",
    compatibilityNote: "使用私有字型引擎的裝置可能會在安裝時被拒絕，避免寫入不安全的設定。",
    featuresTitle: "功能",
    featureFonts: "分別上傳中文與西文 TTF 檔案。",
    featureEmoji: "使用四款內建 Emoji，或上傳自訂 TTF/OTF。",
    featureDetection: "安裝時偵測裝置實際的字型 XML 與 Emoji 目標檔名。",
    featureLanguages: "WebUI 支援簡體中文、台灣繁體中文與英文。",
    workingTitle: "運作方式",
    workingText: "安裝程式會備份裝置字型設定，只改寫預設西文字型家族與中文語系 family，再透過 KernelSU 掛載產生的檔案，不會直接修改系統分割區。",
    emojiTitle: "內建 Emoji",
    recoveryTitle: "故障排除",
    recoveryText: "若出現字型缺失或系統無法正常啟動，請在 KernelSU 中停用模組並重新啟動。保留 adb root 時也可以執行：",
    linksTitle: "相關連結",
    projectLinksLabel: "專案連結",
    sourceRepository: "原始碼儲存庫",
    telegramGroup: "Telegram 群組",
    qqGroup: "QQ 群組 1082347624",
    donateTitle: "贊助作者",
    donateSubtitle: "支付寶",
    paymentMethods: "付款方式",
    alipayAlt: "支付寶收款 QR Code",
    wechatPay: "微信支付",
    wechatAlt: "微信支付收款 QR Code",
  },
  "en-US": {
    back: "Back",
    readme: "README",
    authorLinkLabel: "Open yuzlyn's GitHub profile",
    authorAvatarAlt: "yuzlyn's GitHub avatar",
    overview: "A universal KernelSU module for managing system fonts and Emoji on Android 8.0 and later.",
    readmeLabel: "Module README",
    compatibilityTitle: "Compatibility",
    compatibilityAndroid: "Android 8.0 or later (API 26+).",
    compatibilityRoot: "KernelSU or a compatible WebUI and systemless module implementation.",
    compatibilityXml: "Standard Android familyset or fonts-modification XML font configuration.",
    compatibilityNote: "Devices using a private font engine may be rejected during installation instead of receiving an unsafe configuration.",
    featuresTitle: "Features",
    featureFonts: "Upload separate Chinese and Latin TTF files.",
    featureEmoji: "Use four built-in Emoji styles or upload a custom TTF/OTF.",
    featureDetection: "Detect the device's actual font XML and Emoji target filenames during installation.",
    featureLanguages: "WebUI languages: Simplified Chinese, Traditional Chinese for Taiwan, and English.",
    workingTitle: "How it works",
    workingText: "The installer backs up the device's font configuration, rewrites only the default Latin and Chinese locale families, and mounts the generated files through KernelSU. The system partition is never modified directly.",
    emojiTitle: "Built-in Emoji",
    recoveryTitle: "Recovery",
    recoveryText: "If fonts are missing or the system cannot start normally, disable the module through KernelSU and restart. With adb root available:",
    linksTitle: "Links",
    projectLinksLabel: "Project links",
    sourceRepository: "Source repository",
    telegramGroup: "Telegram group",
    qqGroup: "QQ group 1082347624",
    donateTitle: "Support the author",
    donateSubtitle: "Alipay",
    paymentMethods: "Payment methods",
    alipayAlt: "Alipay payment QR code",
    wechatPay: "WeChat Pay",
    wechatAlt: "WeChat Pay QR code",
  },
};

function resolveLocale() {
  const language = String(navigator.language || "").replaceAll("_", "-").toLowerCase();
  if (/^zh-(?:[^-]+-)*tw(?:-|$)/.test(language)) return "zh-TW";
  if (language === "zh" || language.startsWith("zh-")) return "zh-CN";
  return "en-US";
}

const locale = resolveLocale();

function t(key) {
  return ABOUT_TRANSLATIONS[locale][key] ?? ABOUT_TRANSLATIONS["en-US"][key] ?? key;
}

function applyTranslations() {
  document.documentElement.lang = locale;
  document.title = t(document.body.dataset.pageTitleKey || "readme");
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  const attributes = ["aria-label", "title", "alt"];
  for (const attribute of attributes) {
    const datasetName = `i18n${attribute.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("")}`;
    for (const element of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
      element.setAttribute(attribute, t(element.dataset[datasetName]));
    }
  }
}

function exec(command) {
  return new Promise((resolve, reject) => {
    if (!window.ksu || typeof window.ksu.exec !== "function") {
      reject(new Error("KSU_BRIDGE_UNAVAILABLE"));
      return;
    }
    const callbackName = `font_setting_about_${Date.now()}`;
    window[callbackName] = (errno, stdout) => {
      delete window[callbackName];
      if (Number(errno)) reject(new Error("KSU_COMMAND_FAILED"));
      else resolve(String(stdout || ""));
    };
    try {
      const result = window.ksu.exec(command, "{}", callbackName);
      if (result !== undefined && result !== null) {
        delete window[callbackName];
        resolve(String(result));
      }
    } catch (error) {
      delete window[callbackName];
      reject(error);
    }
  });
}

async function applyTheme() {
  let seed = "#4f635b";
  try {
    const output = await exec("settings get secure theme_customization_overlay_packages");
    const start = output.indexOf("{");
    const settings = JSON.parse(start >= 0 ? output.slice(start) : output);
    const value = String(
      settings["android.theme.customization.system_palette"] ||
      settings["android.theme.customization.accent_color"] ||
      "",
    ).replace(/[^0-9a-f]/gi, "");
    if (value.length >= 6) seed = `#${value.slice(-6)}`;
  } catch {
    // Use the local seed when the page is opened outside KernelSU.
  }
  mdui.setColorScheme(seed);
}

function initialize() {
  applyTranslations();
  mdui.setColorScheme("#4f635b");
  applyTheme();
  document.querySelector("#about-back").addEventListener("click", () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "index.html";
  });
}

window.addEventListener("DOMContentLoaded", initialize);
