import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "./.fontsetting-build/node_modules/playwright-core/index.mjs";

const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const pageUrl = pathToFileURL(path.resolve("FontSetting_ColorOS16/webroot/index.html")).href;
const browser = await chromium.launch({ executablePath: edge, headless: true });

const viewports = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

for (const viewport of viewports) {
  for (const colorScheme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport, colorScheme });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.ksu = {
      exec(command, options, callbackName) {
        let output = "ok";
        if (command.includes("modules_update")) output = "/data/adb/modules/font_setting_coloros16";
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
      hasWavyProgress: document.querySelectorAll(".wavy-progress .wave-value").length === 3,
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
      sourceBeforeFooter: sourceLink.nextElementSibling.tagName.toLowerCase() === "footer",
      sourceCardUsesLow: tokenMatches(sourceCard.backgroundColor, "surface-container-low"),
      sourceCardRadius: parseFloat(sourceCard.borderTopLeftRadius),
      sourceCardBorder: parseFloat(sourceCard.borderTopWidth),
      sourceCardShadow: sourceCard.boxShadow,
      westernIconText: westernIcon.textContent.trim(),
      westernIconHasSvg: Boolean(westernIcon.querySelector("svg")),
    };
  });

  const progressCheck = await page.evaluate(() => {
    const progress = document.querySelector("#chinese-progress");
    setWavyProgress(progress, 0.46);
    return {
      dash: progress.querySelector(".wave-value").style.strokeDasharray,
      value: progress.getAttribute("aria-valuenow"),
    };
  });

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
  if (!layout.hasWavyProgress || progressCheck.dash !== "46, 54" || progressCheck.value !== "46") {
    throw new Error(`${testName} wavy progress mismatch: ${JSON.stringify({ layout, progressCheck })}`);
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
  if (layout.sourceHref !== "https://github.com/yuzlyn/font-setting-for-coloros16" && layout.sourceHref !== "https://github.com/yuzlyn/font-setting-for-coloros16/") {
    throw new Error(`${testName} source URL mismatch: ${JSON.stringify(layout)}`);
  }
  if (!layout.sourceBeforeFooter || !layout.sourceCardUsesLow || layout.sourceCardRadius !== 35 || layout.sourceCardBorder !== 0 || layout.sourceCardShadow !== "none") {
    throw new Error(`${testName} source card mismatch: ${JSON.stringify(layout)}`);
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

await browser.close();
