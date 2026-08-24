import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "./.fontsetting-build/node_modules/playwright-core/index.mjs";

const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const pageUrl = pathToFileURL(path.resolve("font-settings/webroot/index.html")).href;
const aboutUrl = pathToFileURL(path.resolve("font-settings/webroot/about.html")).href;
const donateUrl = pathToFileURL(path.resolve("font-settings/webroot/donate.html")).href;
const browser = await chromium.launch({ executablePath: edge, headless: true });

const viewports = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

async function verifyLongPressCopy(page, selector, expectedValue) {
  const before = page.url();
  await page.dispatchEvent(selector, "pointerdown", {
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 24,
    clientY: 24,
  });
  await page.waitForTimeout(650);
  await page.dispatchEvent(selector, "pointerup", {
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: 24,
    clientY: 24,
  });
  await page.dispatchEvent(selector, "click", { button: 0 });
  await page.waitForTimeout(100);
  const result = await page.evaluate(() => ({
    copied: window.__copiedText,
    snackbar: document.querySelector("#snackbar").textContent,
    url: location.href,
  }));
  if (result.copied !== expectedValue || !result.snackbar || result.url !== before) {
    throw new Error(`${selector} long-press copy mismatch: ${JSON.stringify(result)}`);
  }
  await page.evaluate(() => {
    document.querySelector("#snackbar").open = false;
    window.__copiedText = "";
  });
}

for (const viewport of viewports) {
  for (const colorScheme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport, colorScheme });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        async writeText(value) {
          window.__copiedText = value;
        },
      },
    });
    window.ksu = {
      exec(command, options, callbackName) {
        let output = "ok";
        if (command.includes("modules_update")) output = "/data/adb/modules/font-settings";
        if (command.includes("theme_customization_overlay_packages")) {
          output = JSON.stringify({
            "android.theme.customization.color_source": "home_wallpaper",
            "android.theme.customization.system_palette": "FF1875F5",
          });
        }
        if (command.endsWith(" status")) output = [
          "module=ok",
          "chinese_size=54604100",
          "chinese_name_b64=UGluZ1JvdW5kU0NWRi50dGY=",
          "chinese_variable=1",
          "western_size=188148",
          "western_name_b64=Q2Flc2l1bVZGLVVwcmlnaHQudHRm",
          "western_variable=1",
          "emoji_mode=google",
          "emoji_target=NotoColorEmoji.ttf",
          "emoji_custom_size=3145728",
          "emoji_name_b64=TXlFbW9qaS5vdGY=",
          "emoji_builtin_ios=1",
          "emoji_builtin_google=1",
          "emoji_builtin_blobmoji=1",
          "emoji_builtin_facebook=1",
          "western_targets=58",
          "chinese_targets=56",
          "pending_reboot=1",
          "conflicts=PixelFonts,PingRSCCaesiumVFOPlusOni",
        ].join("\n");
        setTimeout(() => window[callbackName](0, output, ""), 0);
      },
    };
  });
  await page.goto(pageUrl);
  await page.waitForTimeout(500);

  const layout = await page.evaluate(() => {
    const visible = [...document.querySelectorAll("body *")].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    const overflow = visible
      .map((element) => ({ tag: element.tagName.toLowerCase(), rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.left < -0.5 || rect.right > innerWidth + 0.5)
      .map(({ tag, rect }) => ({ tag, left: rect.left, right: rect.right }));
    const style = (selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing visual-check selector: ${selector}`);
      return getComputedStyle(element);
    };
    const token = (name) => getComputedStyle(document.documentElement)
      .getPropertyValue(`--mdui-color-${name}`)
      .trim();
    const channels = (value) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number).join(",");
    const tokenMatches = (actual, name) => channels(actual) === channels(token(name));
    const card = style(".font-card");
    const listItem = style(".font-card .list-item");
    const leadingIcon = style(".font-card .leading-icon");
    const bridge = style("#bridge-chip");
    const typeChip = style("#chinese-type");
    const uploadButton = style("#chinese-upload");
    const rebootButton = style("#reboot-button");
    const authorLink = document.querySelector(".author-link");
    const authorStyle = getComputedStyle(authorLink);
    const avatar = document.querySelector(".github-avatar");
    const avatarStyle = getComputedStyle(avatar);
    const sourceLink = document.querySelector(".source-link");
    const sourceCard = style(".source-card");
    const resourceGrid = document.querySelector(".resource-grid");
    const resourceCards = [...resourceGrid.querySelectorAll(".resource-card")];
    const donateLink = document.querySelector("#donate-card");
    const donateCard = style(".donate-card");
    const emojiCard = style(".emoji-card");
    const selectedEmoji = document.querySelector("#emoji-picker-trigger");
    const selectedEmojiStyle = getComputedStyle(selectedEmoji);
    const emojiHeadingIconRect = document.querySelector(".emoji-leading").getBoundingClientRect();
    const emojiHeadingCopyRect = document.querySelector(".emoji-heading-row .item-copy").getBoundingClientRect();
    const westernIcon = document.querySelector(".font-card:nth-of-type(2) .leading-icon");
    return {
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflow,
      bodyUsesContainer: tokenMatches(style("body").backgroundColor, "surface-container"),
      topBarUsesContainer: tokenMatches(style("mdui-top-app-bar").backgroundColor, "surface-container"),
      cardUsesLow: tokenMatches(card.backgroundColor, "surface-container-low"),
      listItemMatchesCard: tokenMatches(listItem.backgroundColor, "surface-container-low"),
      cardRadius: parseFloat(card.borderTopLeftRadius),
      cardBorder: parseFloat(card.borderTopWidth),
      cardShadow: card.boxShadow,
      cardPadding: parseFloat(card.paddingTop),
      bridgeUsesPrimaryContainer: tokenMatches(bridge.backgroundColor, "primary-container") &&
        tokenMatches(bridge.color, "on-primary-container"),
      typeUsesHighestContainer: tokenMatches(typeChip.backgroundColor, "surface-container-highest"),
      uploadUsesPrimaryContainer: tokenMatches(uploadButton.backgroundColor, "primary-container") &&
        tokenMatches(uploadButton.color, "on-primary-container"),
      leadingUsesPrimaryContainer: tokenMatches(leadingIcon.backgroundColor, "primary-container") &&
        tokenMatches(leadingIcon.color, "on-primary-container"),
      leadingSize: [parseFloat(leadingIcon.width), parseFloat(leadingIcon.height)],
      chipRadius: parseFloat(bridge.borderTopLeftRadius),
      buttonRadius: parseFloat(uploadButton.borderTopLeftRadius),
      monetLabel: document.querySelector("#monet-chip").textContent,
      monetSeed: getComputedStyle(document.documentElement).getPropertyValue("--monet-seed").trim(),
      monetOnly: !document.querySelector("#color-style, mdui-segmented-button-group") &&
        !document.body.innerText.includes("配色风格"),
      monetNotInteractive: style("#monet-chip").pointerEvents === "none" &&
        document.querySelector("#monet-chip").variant === "assist",
      libraryLoaded: Boolean(window.MaterialKolor),
      topBarVariant: document.querySelector("mdui-top-app-bar").variant,
      hasLargeTitle: Boolean(document.querySelector(".large-title #page-title")),
      hasBackIcon: Boolean(document.querySelector("#back-button svg")),
      hasRefreshIcon: Boolean(document.querySelector("#refresh-button svg")),
      hasLinearProgress: document.querySelectorAll("mdui-linear-progress").length === 4,
      footerCentered: style("footer").justifyContent === "center",
      authorHref: authorLink.href,
      authorUsesPrimary: tokenMatches(authorStyle.backgroundColor, "primary") &&
        tokenMatches(authorStyle.color, "on-primary"),
      authorIsUnderTitle: document.querySelector(".large-title").nextElementSibling === authorLink &&
        authorLink.nextElementSibling.classList.contains("controls"),
      avatarLoaded: avatar.complete && avatar.naturalWidth > 0,
      avatarSize: [parseFloat(avatarStyle.width), parseFloat(avatarStyle.height)],
      avatarRound: parseFloat(avatarStyle.borderTopLeftRadius) >= 22,
      sourceHref: sourceLink.href,
      sourceBeforeResources: sourceLink.nextElementSibling === resourceGrid,
      resourcesBeforeDonate: resourceGrid.nextElementSibling === donateLink,
      donateBeforeFooter: donateLink.nextElementSibling.tagName.toLowerCase() === "footer",
      donateHref: donateLink.href,
      donateCardUsesLow: tokenMatches(donateCard.backgroundColor, "surface-container-low"),
      sourceCardUsesLow: tokenMatches(sourceCard.backgroundColor, "surface-container-low"),
      sourceCardRadius: parseFloat(sourceCard.borderTopLeftRadius),
      sourceCardBorder: parseFloat(sourceCard.borderTopWidth),
      sourceCardShadow: sourceCard.boxShadow,
      resourceCount: resourceCards.length,
      resourceCardsUseLow: resourceCards.every((element) => tokenMatches(getComputedStyle(element).backgroundColor, "surface-container-low")),
      resourceColumns: getComputedStyle(resourceGrid).gridTemplateColumns.split(" ").length,
      telegramHref: document.querySelector("#telegram-card").href,
      telegramCopy: document.querySelector("#telegram-card").dataset.copyValue,
      qqHref: document.querySelector("#qq-card").href,
      qqCopy: document.querySelector("#qq-card").dataset.copyValue,
      aboutHref: document.querySelector("#about-card").href,
      emojiCardUsesLow: tokenMatches(emojiCard.backgroundColor, "surface-container-low"),
      emojiSelected: document.querySelector("#selected-emoji-name").textContent === "Google / Pixel" &&
        document.querySelector("#selected-emoji-detail").textContent === "NotoColorEmoji.ttf",
      emojiTriggerUsesSecondaryContainer: tokenMatches(selectedEmojiStyle.backgroundColor, "secondary-container"),
      emojiHeadingSeparated: emojiHeadingIconRect.right <= emojiHeadingCopyRect.left,
      emojiTarget: document.querySelector("#emoji-status").textContent,
      emojiCustomName: document.querySelector("#emoji-custom-name").textContent,
      westernIconText: westernIcon.textContent.trim(),
      westernIconHasSvg: Boolean(westernIcon.querySelector("svg")),
    };
  });

  const progressCheck = await page.evaluate(async () => {
    const progress = document.querySelector("#chinese-progress");
    setProgress(progress, 0.46);
    await progress.updateComplete;
    return {
      width: progress.shadowRoot.querySelector(".determinate").style.width,
      height: getComputedStyle(progress).height,
      value: progress.getAttribute("aria-valuenow"),
    };
  });

  await page.click("#emoji-picker-trigger");
  await page.waitForTimeout(500);
  const emojiDialogCheck = await page.evaluate(() => {
    const dialog = document.querySelector("#emoji-dialog");
    const list = document.querySelector("#emoji-options");
    const selected = list.querySelector('.emoji-picker-option[data-mode="google"]');
    const rect = list.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    const radio = selected.querySelector(".radio-indicator");
    const radioRect = radio.getBoundingClientRect();
    const radioStyle = getComputedStyle(radio);
    return {
      open: dialog.open,
      optionCount: list.querySelectorAll(".emoji-picker-option").length,
      selected: selected.classList.contains("selected") && selected.querySelector("input").checked,
      hasSamsung: Boolean(list.querySelector('[data-mode="samsung"]')),
      withinViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      dialogRect: { left: dialogRect.left, top: dialogRect.top, right: dialogRect.right, bottom: dialogRect.bottom },
      radio: { left: radioRect.left, right: radioRect.right, width: radioRect.width, display: radioStyle.display, opacity: radioStyle.opacity },
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  if (viewport.name === "mobile" && colorScheme === "light") {
    await page.screenshot({ path: "fontsetting-mobile-emoji-dialog.png" });
  }
  await page.click("#close-emoji-dialog");
  await page.waitForTimeout(500);
  if (viewport.name === "mobile" && colorScheme === "light") {
    await verifyLongPressCopy(page, "#telegram-card", "t.me/fontsettings");
    await verifyLongPressCopy(page, "#qq-card", "1082347624");
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const disabledCheck = await page.evaluate(async () => {
    const button = document.querySelector("#reboot-button");
    button.disabled = true;
    await button.updateComplete;
    const computed = getComputedStyle(button);
    return [computed.backgroundColor, computed.color];
  });

  const titleCheck = await page.evaluate(async () => {
    const bar = document.querySelector("mdui-top-app-bar");
    const compact = document.querySelector("#compact-title");
    const large = document.querySelector(".large-title");
    const initialBar = bar.getBoundingClientRect();
    const initialOpacity = getComputedStyle(compact).opacity;
    const spacer = document.createElement("div");
    spacer.style.height = "1200px";
    document.body.append(spacer);
    window.scrollTo(0, large.offsetTop + large.offsetHeight + 24);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const collapsedBar = bar.getBoundingClientRect();
    const compactRect = compact.getBoundingClientRect();
    const collapsedOpacity = getComputedStyle(compact).opacity;
    const submerged = large.getBoundingClientRect().bottom <= collapsedBar.bottom + 1;
    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 500));
    spacer.remove();
    return {
      initialOpacity,
      collapsedOpacity,
      submerged,
      stableTop: initialBar.top === collapsedBar.top,
      stableHeight: initialBar.height === collapsedBar.height,
      barHeight: collapsedBar.height,
      topGap: compactRect.top - collapsedBar.top,
      bottomGap: collapsedBar.bottom - compactRect.bottom,
      restoredOpacity: getComputedStyle(compact).opacity,
    };
  });

  const testName = `${viewport.name}-${colorScheme}`;
  if (errors.length) throw new Error(`${testName} page errors: ${errors.join("; ")}`);
  if (layout.scrollWidth > layout.viewport || layout.overflow.length) {
    throw new Error(`${testName} horizontal overflow: ${JSON.stringify(layout)}`);
  }
  if (!layout.libraryLoaded || !layout.monetLabel.includes("#1875F5") || !layout.monetOnly || !layout.monetNotInteractive) {
    throw new Error(`${testName} Monet state mismatch: ${JSON.stringify(layout)}`);
  }
  if (!layout.bodyUsesContainer || !layout.topBarUsesContainer || !layout.cardUsesLow || !layout.listItemMatchesCard || layout.cardRadius !== 35 || layout.cardBorder !== 0 || layout.cardShadow !== "none" || layout.cardPadding !== 0) {
    throw new Error(`${testName} card specification mismatch: ${JSON.stringify(layout)}`);
  }
  if (!layout.bridgeUsesPrimaryContainer || !layout.typeUsesHighestContainer || !layout.uploadUsesPrimaryContainer || !layout.leadingUsesPrimaryContainer) {
    throw new Error(`${testName} container color mismatch: ${JSON.stringify(layout)}`);
  }
  if (layout.leadingSize.some((size) => size !== 40) || layout.topBarVariant !== "small" || !layout.hasLargeTitle || !layout.hasBackIcon || !layout.hasRefreshIcon) {
    throw new Error(`${testName} expressive list or app bar mismatch: ${JSON.stringify(layout)}`);
  }
  if (layout.chipRadius < 16 || layout.buttonRadius < 20) {
    throw new Error(`${testName} full shape mismatch: ${JSON.stringify(layout)}`);
  }
  if (titleCheck.initialOpacity !== "0" || titleCheck.collapsedOpacity !== "1" || !titleCheck.submerged || !titleCheck.stableTop || !titleCheck.stableHeight || titleCheck.barHeight !== 48 || Math.abs(titleCheck.topGap - titleCheck.bottomGap) > 0.5 || titleCheck.topGap > 4.5 || titleCheck.restoredOpacity !== "0") {
    throw new Error(`${testName} app bar threshold mismatch: ${JSON.stringify(titleCheck)}`);
  }
  if (!layout.hasLinearProgress || progressCheck.width !== "46%" || progressCheck.height !== "4px" || progressCheck.value !== "46") {
    throw new Error(`${testName} linear progress mismatch: ${JSON.stringify({ layout, progressCheck })}`);
  }
  if (!disabledCheck[0].includes("0.12") || !disabledCheck[1].includes("0.38") || !layout.footerCentered) {
    throw new Error(`${testName} disabled or footer state mismatch: ${JSON.stringify({ layout, disabledCheck })}`);
  }
  if (layout.authorHref !== "https://github.com/yuzlyn" && layout.authorHref !== "https://github.com/yuzlyn/") {
    throw new Error(`${testName} author URL mismatch: ${JSON.stringify(layout)}`);
  }
  if (!layout.authorUsesPrimary || !layout.authorIsUnderTitle || !layout.avatarLoaded || layout.avatarSize.some((size) => size !== 44) || !layout.avatarRound) {
    throw new Error(`${testName} author capsule mismatch: ${JSON.stringify(layout)}`);
  }
  if (layout.sourceHref !== "https://github.com/yuzlyn/font-settings" && layout.sourceHref !== "https://github.com/yuzlyn/font-settings/") {
    throw new Error(`${testName} source URL mismatch: ${JSON.stringify(layout)}`);
  }
  if (!layout.sourceBeforeResources || !layout.resourcesBeforeDonate || !layout.donateBeforeFooter || !layout.donateHref.endsWith("/donate.html") || !layout.donateCardUsesLow || !layout.sourceCardUsesLow || layout.sourceCardRadius !== 35 || layout.sourceCardBorder !== 0 || layout.sourceCardShadow !== "none") {
    throw new Error(`${testName} source card mismatch: ${JSON.stringify(layout)}`);
  }
  const expectedResourceColumns = viewport.name === "mobile" ? 1 : 3;
  if (layout.resourceCount !== 3 || !layout.resourceCardsUseLow || layout.resourceColumns !== expectedResourceColumns || layout.telegramHref !== "https://t.me/fontsettings" || layout.telegramCopy !== "t.me/fontsettings" || !layout.qqHref.startsWith("mqqapi://card/show_pslcard?") || layout.qqCopy !== "1082347624" || !layout.aboutHref.endsWith("/about.html")) {
    throw new Error(`${testName} community cards mismatch: ${JSON.stringify(layout)}`);
  }
  if (!layout.emojiCardUsesLow || !layout.emojiSelected || !layout.emojiTriggerUsesSecondaryContainer || !layout.emojiHeadingSeparated || !layout.emojiTarget.includes("NotoColorEmoji.ttf") || !layout.emojiCustomName.includes("MyEmoji.otf")) {
    throw new Error(`${testName} Emoji panel mismatch: ${JSON.stringify(layout)}`);
  }
  if (!emojiDialogCheck.open || emojiDialogCheck.optionCount !== 6 || !emojiDialogCheck.selected || emojiDialogCheck.hasSamsung || !emojiDialogCheck.withinViewport || emojiDialogCheck.radio.width < 20 || emojiDialogCheck.radio.right > emojiDialogCheck.dialogRect.right) {
    throw new Error(`${testName} Emoji dialog mismatch: ${JSON.stringify(emojiDialogCheck)}`);
  }
  if (layout.westernIconText !== "Aa" || layout.westernIconHasSvg || layout.westernIconText.includes("文")) {
    throw new Error(`${testName} western icon mismatch: ${JSON.stringify(layout)}`);
  }

  if (colorScheme === "light") {
    await page.screenshot({ path: `fontsetting-${viewport.name}-final.png`, fullPage: true });
  }
  console.log(`${testName}: ${layout.viewport}px, MD3 tokens and layout verified`);
  await page.close();
  }
}

const cacheContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  colorScheme: "light",
});
const cachePage = await cacheContext.newPage();
const cacheErrors = [];
cachePage.on("pageerror", (error) => cacheErrors.push(error.message));
await cachePage.addInitScript(() => {
  const cacheKey = "font-settings.monet-seed.v1";
  if (!sessionStorage.getItem("theme-cache-test-ready")) {
    localStorage.setItem(cacheKey, "#aa2200");
    sessionStorage.setItem("theme-cache-test-ready", "1");
  }
  let monetWrites = 0;
  const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (name, ...args) {
    if (name === "--monet-seed" && this === document.documentElement.style) monetWrites += 1;
    return originalSetProperty.call(this, name, ...args);
  };
  window.__monetWrites = () => monetWrites;
  window.ksu = {
    exec(command, options, callbackName) {
      let output = "ok";
      let delay = 0;
      if (command.includes("modules_update")) output = "/data/adb/modules/font-settings";
      if (command.includes("theme_customization_overlay_packages")) {
        output = JSON.stringify({ "android.theme.customization.system_palette": "FF008855" });
        delay = 300;
      }
      if (command.endsWith(" status")) output = [
        "module=ok",
        "chinese_size=1",
        "western_size=1",
        "emoji_mode=default",
        "western_targets=1",
        "chinese_targets=1",
        "pending_reboot=0",
        "conflicts=",
      ].join("\n");
      setTimeout(() => window[callbackName](0, output, ""), delay);
    },
  };
});
await cachePage.goto(pageUrl);
const cachedFirstPaint = await cachePage.evaluate(() => ({
  seed: window.FontSettingsTheme.getSeed(),
  cssSeed: getComputedStyle(document.documentElement).getPropertyValue("--monet-seed").trim(),
  source: document.documentElement.dataset.colorSource,
  writes: window.__monetWrites(),
}));
if (cachedFirstPaint.seed !== "#aa2200" || cachedFirstPaint.cssSeed !== "#aa2200" || cachedFirstPaint.source !== "cache" || cachedFirstPaint.writes !== 1) {
  throw new Error(`cached first paint mismatch: ${JSON.stringify(cachedFirstPaint)}`);
}
await cachePage.waitForFunction(() => window.FontSettingsTheme.getSeed() === "#008855");
const changedTheme = await cachePage.evaluate(() => ({
  seed: window.FontSettingsTheme.getSeed(),
  cached: localStorage.getItem(window.FontSettingsTheme.CACHE_KEY),
  writes: window.__monetWrites(),
}));
if (changedTheme.cached !== "#008855" || changedTheme.writes !== 2) {
  throw new Error(`changed theme cache mismatch: ${JSON.stringify(changedTheme)}`);
}

await cachePage.reload();
await cachePage.waitForTimeout(450);
const unchangedTheme = await cachePage.evaluate(() => ({
  seed: window.FontSettingsTheme.getSeed(),
  cached: localStorage.getItem(window.FontSettingsTheme.CACHE_KEY),
  writes: window.__monetWrites(),
  source: document.documentElement.dataset.colorSource,
}));
if (cacheErrors.length || unchangedTheme.seed !== "#008855" || unchangedTheme.cached !== "#008855" || unchangedTheme.writes !== 1 || unchangedTheme.source !== "monet") {
  throw new Error(`unchanged theme cache mismatch: ${JSON.stringify({ cacheErrors, unchangedTheme })}`);
}
console.log("theme cache: cached first paint and change-only refresh verified");
await cacheContext.close();

const localeCases = [
  {
    browserLocale: "zh-CN",
    expectedLang: "zh-CN",
    expected: ["字体设置", "中文字体", "西文字体", "Emoji 设置", "系统状态", "源码仓库", "Telegram 群组", "QQ群", "关于", "重启手机", "KernelSU 已连接"],
  },
  {
    browserLocale: "zh-TW",
    expectedLang: "zh-TW",
    expected: ["字型設定", "中文字型", "西文字型", "Emoji 設定", "系統狀態", "原始碼儲存庫", "Telegram 群組", "QQ 群組", "關於", "重新啟動手機", "KernelSU 已連線"],
  },
  {
    browserLocale: "zh-Hant-TW",
    expectedLang: "zh-TW",
    expected: ["字型設定", "中文字型", "西文字型", "Emoji 設定", "系統狀態", "原始碼儲存庫", "Telegram 群組", "QQ 群組", "關於", "重新啟動手機", "KernelSU 已連線"],
  },
  {
    browserLocale: "zh-HK",
    expectedLang: "zh-CN",
    expected: ["字体设置", "中文字体", "西文字体", "Emoji 设置", "系统状态", "源码仓库", "Telegram 群组", "QQ群", "关于", "重启手机", "KernelSU 已连接"],
  },
  {
    browserLocale: "fr-FR",
    expectedLang: "en-US",
    expected: ["Font settings", "Chinese font", "Latin font", "Emoji settings", "System status", "Source repository", "Telegram group", "QQ group", "About", "Restart device", "KernelSU connected"],
  },
];

for (const localeCase of localeCases) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    colorScheme: "light",
    locale: localeCase.browserLocale,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.ksu = {
      exec(command, options, callbackName) {
        let output = "ok";
        if (command.includes("modules_update")) output = "/data/adb/modules/font-settings";
        if (command.includes("theme_customization_overlay_packages")) output = "{}";
        if (command.endsWith(" status")) output = [
          "module=ok",
          "chinese_size=54604100",
          "chinese_name_b64=UGluZ1JvdW5kU0NWRi50dGY=",
          "chinese_variable=1",
          "western_size=188148",
          "western_name_b64=Q2Flc2l1bVZGLVVwcmlnaHQudHRm",
          "western_variable=1",
          "emoji_mode=google",
          "emoji_target=NotoColorEmoji.ttf",
          "emoji_custom_size=0",
          "emoji_builtin_ios=1",
          "emoji_builtin_google=1",
          "emoji_builtin_blobmoji=1",
          "emoji_builtin_facebook=1",
          "western_targets=58",
          "chinese_targets=56",
          "pending_reboot=1",
          "conflicts=",
        ].join("\n");
        setTimeout(() => window[callbackName](0, output, ""), 0);
      },
    };
  });
  await page.goto(pageUrl);
  await page.waitForTimeout(500);

  const localized = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    text: document.body.innerText,
    pageTitle: document.querySelector("#page-title").textContent,
    backLabel: document.querySelector("#back-button").getAttribute("aria-label"),
    backTitle: document.querySelector("#back-button").getAttribute("title"),
    avatarAlt: document.querySelector(".github-avatar").getAttribute("alt"),
    rebootHeadline: document.querySelector("#reboot-dialog").getAttribute("headline"),
    emojiHeadline: document.querySelector("#emoji-dialog").getAttribute("headline"),
    scrollWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));

  if (errors.length) throw new Error(`${localeCase.browserLocale} page errors: ${errors.join("; ")}`);
  if (localized.lang !== localeCase.expectedLang || localized.title !== localeCase.expected[0] || localized.pageTitle !== localeCase.expected[0]) {
    throw new Error(`${localeCase.browserLocale} locale resolution mismatch: ${JSON.stringify(localized)}`);
  }
  for (const label of localeCase.expected) {
    if (!localized.text.includes(label)) {
      throw new Error(`${localeCase.browserLocale} missing translation ${label}: ${JSON.stringify(localized)}`);
    }
  }
  if (!localized.backLabel || localized.backLabel !== localized.backTitle || !localized.avatarAlt || !localized.rebootHeadline || !localized.emojiHeadline) {
    throw new Error(`${localeCase.browserLocale} localized attributes mismatch: ${JSON.stringify(localized)}`);
  }
  if (localized.scrollWidth > localized.viewport) {
    throw new Error(`${localeCase.browserLocale} mobile horizontal overflow: ${JSON.stringify(localized)}`);
  }
  if (localeCase.expectedLang === "zh-TW" && /字体|文件|连接|重启|源码仓库/.test(localized.text)) {
    throw new Error(`zh-TW contains non-Taiwan terminology: ${JSON.stringify(localized)}`);
  }

  console.log(`${localeCase.browserLocale} -> ${localized.lang}: localized UI verified`);
  await page.close();
}

const aboutLocaleCases = [
  {
    browserLocale: "zh-CN",
    expectedLang: "zh-CN",
    expected: ["兼容范围", "功能", "工作方式", "内置 Emoji", "故障恢复", "相关链接", "QQ群 1082347624"],
  },
  {
    browserLocale: "zh-Hant-TW",
    expectedLang: "zh-TW",
    expected: ["相容範圍", "功能", "運作方式", "內建 Emoji", "故障排除", "相關連結", "QQ 群組 1082347624"],
  },
  {
    browserLocale: "fr-FR",
    expectedLang: "en-US",
    expected: ["Compatibility", "Features", "How it works", "Built-in Emoji", "Recovery", "Links", "QQ group 1082347624"],
  },
];

for (const viewport of viewports) {
  for (const localeCase of aboutLocaleCases) {
    const page = await browser.newPage({ viewport, colorScheme: "light", locale: localeCase.browserLocale });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.ksu = {
        exec(command, options, callbackName) {
          const output = command.includes("theme_customization_overlay_packages")
            ? JSON.stringify({ "android.theme.customization.system_palette": "FF1875F5" })
            : "";
          setTimeout(() => window[callbackName](0, output, ""), 0);
        },
      };
    });
    await page.goto(aboutUrl);
    await page.waitForTimeout(500);

    const about = await page.evaluate(() => {
      const visible = [...document.querySelectorAll("body *")].filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      });
      return {
        lang: document.documentElement.lang,
        title: document.title,
        text: document.body.innerText,
        h1: document.querySelector("h1").textContent,
        sectionCount: document.querySelectorAll(".readme-section").length,
        topBarVariant: document.querySelector("mdui-top-app-bar").variant,
        backLabel: document.querySelector("#about-back").getAttribute("aria-label"),
        backTitle: document.querySelector("#about-back").getAttribute("title"),
        avatarLoaded: document.querySelector(".about-author img").complete && document.querySelector(".about-author img").naturalWidth > 0,
        sourceHref: document.querySelector('.readme-links a[href*="github.com"]').href,
        telegramHref: document.querySelector('.readme-links a[href*="t.me"]').href,
        qqHref: document.querySelector('.readme-links a[href^="mqqapi:"]').href,
        scrollWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
        overflow: visible
          .map((element) => ({ tag: element.tagName.toLowerCase(), rect: element.getBoundingClientRect() }))
          .filter(({ rect }) => rect.left < -0.5 || rect.right > innerWidth + 0.5)
          .map(({ tag, rect }) => ({ tag, left: rect.left, right: rect.right })),
      };
    });

    const testName = `about-${viewport.name}-${localeCase.browserLocale}`;
    if (errors.length) throw new Error(`${testName} page errors: ${errors.join("; ")}`);
    if (about.lang !== localeCase.expectedLang || about.title !== "README" || about.h1 !== "Font Settings" || about.sectionCount !== 6 || about.topBarVariant !== "small") {
      throw new Error(`${testName} structure mismatch: ${JSON.stringify(about)}`);
    }
    for (const label of localeCase.expected) {
      if (!about.text.includes(label)) throw new Error(`${testName} missing ${label}: ${JSON.stringify(about)}`);
    }
    if (!about.backLabel || about.backLabel !== about.backTitle || !about.avatarLoaded || about.sourceHref !== "https://github.com/yuzlyn/font-settings" || about.telegramHref !== "https://t.me/fontsettings" || !about.qqHref.startsWith("mqqapi://card/show_pslcard?")) {
      throw new Error(`${testName} links or accessibility mismatch: ${JSON.stringify(about)}`);
    }
    if (about.scrollWidth > about.viewport || about.overflow.length) {
      throw new Error(`${testName} horizontal overflow: ${JSON.stringify(about)}`);
    }
    if (localeCase.expectedLang === "zh-TW" && /字体|文件|连接|重启|源码仓库/.test(about.text)) {
      throw new Error(`${testName} contains non-Taiwan terminology: ${JSON.stringify(about)}`);
    }
    if (viewport.name === "mobile" && localeCase.browserLocale === "zh-Hant-TW") {
      await page.screenshot({ path: "fontsetting-mobile-about.png", fullPage: true });
    }
    console.log(`${testName}: README page verified`);
    await page.close();
  }
}

const donateLocaleCases = [
  { browserLocale: "zh-CN", expectedLang: "zh-CN", title: "捐赠作者", alipay: "支付宝", wechat: "微信支付" },
  { browserLocale: "zh-Hant-TW", expectedLang: "zh-TW", title: "贊助作者", alipay: "支付寶", wechat: "微信支付" },
  { browserLocale: "fr-FR", expectedLang: "en-US", title: "Support the author", alipay: "Alipay", wechat: "WeChat Pay" },
];

for (const viewport of viewports) {
  for (const localeCase of donateLocaleCases) {
    const page = await browser.newPage({ viewport, colorScheme: "light", locale: localeCase.browserLocale });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(donateUrl);
    await page.waitForTimeout(500);

    const donate = await page.evaluate(() => {
      const figures = [...document.querySelectorAll(".payment-figure")].map((figure) => {
        const image = figure.querySelector("img");
        const rect = image.getBoundingClientRect();
        return {
          label: figure.querySelector("figcaption").textContent,
          alt: image.alt,
          loaded: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          width: rect.width,
          height: rect.height,
          objectFit: getComputedStyle(image).objectFit,
          buttonLabel: figure.querySelector("button").getAttribute("aria-label"),
        };
      });
      const card = document.querySelector(".donate-card");
      const grid = document.querySelector(".payment-grid");
      return {
        lang: document.documentElement.lang,
        title: document.title,
        h1: document.querySelector("h1").textContent,
        paymentLabel: card.getAttribute("aria-label"),
        backLabel: document.querySelector("#about-back").getAttribute("aria-label"),
        backTitle: document.querySelector("#about-back").getAttribute("title"),
        figures,
        heading: card.querySelector("h2").textContent,
        cardRadius: parseFloat(getComputedStyle(card).borderTopLeftRadius),
        gridColumns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        previewHidden: document.querySelector("#payment-preview").hidden,
        confirmationHidden: document.querySelector("#donate-confirm").hidden,
        hasKofi: document.body.innerText.includes("Ko-fi"),
        thanks: document.querySelector(".donate-thanks").textContent,
        previewImage: document.querySelector("#payment-preview img"),
        scrollWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
      };
    });

    const testName = `donate-${viewport.name}-${localeCase.browserLocale}`;
    if (errors.length) throw new Error(`${testName} page errors: ${errors.join("; ")}`);
    if (donate.lang !== localeCase.expectedLang || donate.title !== localeCase.title || donate.h1 !== localeCase.title) {
      throw new Error(`${testName} locale mismatch: ${JSON.stringify(donate)}`);
    }
    if (!donate.paymentLabel || !donate.backLabel || donate.backLabel !== donate.backTitle || donate.figures.length !== 2) {
      throw new Error(`${testName} structure or accessibility mismatch: ${JSON.stringify(donate)}`);
    }
    if (donate.figures[0].label !== (localeCase.expectedLang === "en-US" ? "WeChat reward" : "微信" + (localeCase.expectedLang === "zh-TW" ? "贊賞" : "赞赏")) || donate.figures[1].label !== localeCase.alipay || donate.figures.some((figure) => !figure.alt || !figure.buttonLabel)) {
      throw new Error(`${testName} payment labels mismatch: ${JSON.stringify(donate)}`);
    }
    for (const figure of donate.figures) {
      const renderedRatio = figure.width / figure.height;
      if (!figure.loaded || figure.objectFit !== "contain" || Math.abs(renderedRatio - 1) > 0.01 || figure.width > donate.viewport * 0.5) {
        throw new Error(`${testName} payment image mismatch: ${JSON.stringify(donate)}`);
      }
    }
    if (!donate.heading || donate.cardRadius < 24 || donate.gridColumns !== 2 || !donate.previewHidden || !donate.confirmationHidden || donate.hasKofi || !donate.thanks) {
      throw new Error(`${testName} donation card mismatch: ${JSON.stringify(donate)}`);
    }
    await page.click("[data-payment-preview]");
    const confirmation = await page.evaluate(() => {
      const dialog = document.querySelector("#donate-confirm");
      return { hidden: dialog.hidden, text: dialog.textContent, previewHidden: document.querySelector("#payment-preview").hidden };
    });
    if (confirmation.hidden || !confirmation.previewHidden || !confirmation.text.trim()) {
      throw new Error(`${testName} donation confirmation mismatch: ${JSON.stringify(confirmation)}`);
    }
    await page.click(".donate-confirm-accept");
    const preview = await page.evaluate(() => {
      const overlay = document.querySelector("#payment-preview");
      const image = overlay.querySelector("img");
      return { hidden: overlay.hidden, loaded: image.complete && image.naturalWidth > 0, alt: image.alt };
    });
    if (preview.hidden || !preview.loaded || !preview.alt) {
      throw new Error(`${testName} payment preview mismatch: ${JSON.stringify(preview)}`);
    }
    await page.click(".payment-preview-close");
    if (donate.scrollWidth > donate.viewport) {
      throw new Error(`${testName} horizontal overflow: ${JSON.stringify(donate)}`);
    }
    if (viewport.name === "mobile" && localeCase.browserLocale === "zh-Hant-TW") {
      await page.screenshot({ path: "fontsetting-mobile-donate.png", fullPage: true });
    }
    console.log(`${testName}: donation page verified`);
    await page.close();
  }
}

await browser.close();
