/**
 * Headless smoke test for the built WebUI.
 *
 * Serves font-settings/webroot over HTTP (module scripts cannot load from
 * file://) and drives the real bundle with a mocked root bridge, checking the
 * screen structure, navigation, motion classes, empty state and the fallback
 * toggle. Run with: node webui/tests/ui-smoke.mjs
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "../../.fontsetting-build/node_modules/playwright-core/index.mjs";

const workspace = path.resolve(import.meta.dirname, "..", "..");
const webroot = path.join(workspace, "font-settings", "webroot");
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ttf": "font/ttf",
};

const fontBase64 = fs.readFileSync(path.join(workspace, "FontSettingWestern-current.ttf")).toString("base64");

const STATUS = [
  "module=ok",
  "chinese_font_count=2",
  "chinese_font_1=FontSettingChinese.ttf",
  "chinese_font_1_size=54604100",
  "chinese_font_1_variable=1",
  "chinese_font_1_name_b64=UGluZ1JvdW5kU0NWRi50dGY=",
  "chinese_font_2=FontSettingChinese-1.ttf",
  "chinese_font_2_size=12000000",
  "chinese_font_2_variable=0",
  "chinese_font_2_name_b64=TXlDaGluZXNlLnR0Zg==",
  "western_font_count=0",
  "emoji_mode=default",
  "emoji_target=",
  "emoji_custom_size=0",
  "emoji_builtin_ios=1",
  "emoji_builtin_google=1",
  "emoji_builtin_blobmoji=0",
  "emoji_builtin_facebook=1",
  "western_targets=8",
  "chinese_targets=10",
  "western_scale=90",
  "chinese_weight=600",
  "western_weight=400",
  "fallback=1",
  "pending_reboot=0",
  "conflicts=",
].join("\n");

const FAMILIES = [
  '<family name="sans-serif" lang="zh-Hans">',
  '<family name="sys-sans-en">',
  '<family lang="zh-Hant">',
  '<family name="NotoSansTC" lang="zh-Hant">',
  '<family name="NotoSansSC" lang="zh-Hans">',
  '<family name="NotoSansJP" lang="ja">',
].join("\n");

function createServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const filePath = path.join(webroot, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!filePath.startsWith(webroot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404).end("not found");
      return;
    }
    response.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function bridgeInitScript({ fontBase64, status, families }) {
  window.__commands = [];
  window.ksu = {
    exec(command, options, callbackName) {
      window.__commands.push(command);
      let output = "ok";
      if (command.includes("modules_update")) output = "/data/adb/modules/font-settings";
      if (command.includes("theme_customization_overlay_packages")) output = "{}";
      if (command.includes("module.prop")) output = "version=v2.9.9";
      if (command.endsWith(" status")) output = status;
      if (command.includes("<family")) output = families;
      if (command.startsWith("base64 ")) output = fontBase64;
      if (command.includes("fallback-set")) output = "ok=fallback";
      if (command.includes("weight-set")) output = "ok=weight";
      if (command.includes("western-size")) output = "ok=western-size";
      if (command.includes("emoji-set")) output = "ok=emoji";
      // Mirror KernelSU's three call signatures.
      if (typeof options === "string" && callbackName === undefined) {
        setTimeout(() => {
          const callback = window[options];
          if (typeof callback === "function") callback(0, output, "");
        }, 0);
        return undefined;
      }
      if (callbackName === undefined) return output;
      setTimeout(() => {
        const callback = window[callbackName];
        if (typeof callback === "function") callback(0, output, "");
      }, 0);
      return undefined;
    },
  };
}

const checks = [];
function check(name, condition, detail = "") {
  checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) console.error(`FAIL  ${name} ${detail}`);
  else console.log(`ok    ${name}`);
}

const { server, port } = await createServer();
const browser = await chromium.launch({ executablePath: edge, headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 412, height: 892 }, locale: "zh-TW", colorScheme: "light" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(bridgeInitScript, { fontBase64, status: STATUS, families: FAMILIES });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForSelector("section[data-screen='menu'] md-list-item", { timeout: 15000 });
  await page.waitForTimeout(600);

  check("no page errors", errors.length === 0, errors.join("; "));

  const menu = await page.evaluate(() => {
    const screen = document.querySelector("section[data-screen='menu']");
    const items = [...screen.querySelectorAll("md-list-item")];
    const title = screen.querySelector(".screen-title");
    const rows = items.map((item) => item.querySelector('[slot="headline"]')?.textContent.trim());
    return {
      title: title?.textContent.trim(),
      titleFontSize: title ? getComputedStyle(title).fontSize : "",
      rowCount: items.length,
      rows,
      fabs: document.querySelectorAll(".screen-stack md-fab").length,
      layerFabs: document.querySelectorAll("[data-fab-layer] md-fab").length,
      visibleFabs: [...document.querySelectorAll("[data-fab-layer] md-fab")].filter(
        (fab) => fab.dataset.active === "true",
      ).length,
      firstRowTone: items[0]?.dataset.tone,
      firstRowColor: items[0] ? getComputedStyle(items[0]).backgroundColor : "",
      primaryContainer: getComputedStyle(document.documentElement).getPropertyValue("--md-sys-color-primary-container").trim(),
      shapeFirst: items[0]?.dataset.shape,
      shapeMiddle: items[1]?.dataset.shape,
      shapeLast: items[items.length - 1]?.dataset.shape,
      themeSource: document.documentElement.dataset.colorSource,
      groupGap: getComputedStyle(document.querySelector(".list-group")).rowGap,
    };
  });
  check("menu title is 字型設定 at 22sp titleLarge", menu.title === "字型設定" && menu.titleFontSize === "22px", JSON.stringify(menu));
  check("menu renders ten rows", menu.rowCount === 10, `rows=${menu.rowCount}`);
  check(
    "menu row labels match the spec",
    ["yuzlyn", "中文字型", "西文字型", "Emoji 設定", "缺字回退", "系統狀態", "tg 群組", "QQ 群組", "原始碼儲存庫", "贊助作者"].every(
      (label, index) => menu.rows[index] === label,
    ),
    JSON.stringify(menu.rows),
  );
  check("author row uses primaryContainer tone", menu.firstRowTone === "primary-container" && menu.firstRowColor === "rgb(234, 221, 255)", `${menu.firstRowTone} ${menu.firstRowColor}`);
  check("list group shapes are expressive", menu.shapeFirst === "first" && menu.shapeMiddle === "middle" && menu.shapeLast === "last", JSON.stringify(menu));
  check(
    "menu has no floating action button",
    menu.fabs === 0 && menu.layerFabs === 0 && menu.visibleFabs === 0,
    JSON.stringify({ stack: menu.fabs, layer: menu.layerFabs, visible: menu.visibleFabs }),
  );
  check("list items are separated by 3dp", menu.groupGap === "3px", menu.groupGap);
  check("fallback palette active without accent", menu.themeSource === "fallback", menu.themeSource);

  // The top app bar pins to the top and turns surfaceContainer once the menu scrolls.
  await page.evaluate(() => {
    const screen = document.querySelector("section[data-screen='menu']");
    screen.scrollTop = screen.scrollHeight;
  });
  await page.waitForTimeout(200);
  const menuAppBar = await page.evaluate(() => {
    const screen = document.querySelector("section[data-screen='menu']");
    const header = screen.querySelector(".screen-header");
    return {
      scrolled: header.classList.contains("scrolled"),
      pinned: Math.round(header.getBoundingClientRect().top - screen.getBoundingClientRect().top) === 0,
    };
  });
  check("top app bar pins and turns surfaceContainer on scroll", menuAppBar.pinned && menuAppBar.scrolled, JSON.stringify(menuAppBar));
  await page.evaluate(() => {
    document.querySelector("section[data-screen='menu']").scrollTop = 0;
  });

  // 中文字型 -> slides in from the right
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll("section[data-screen='menu'] md-list-item")];
    rows[1].click();
  });
  await page.waitForTimeout(700);
  const chinese = await page.evaluate(() => {
    const screen = document.querySelector("section[data-screen='chinese']");
    const card = screen?.querySelector(".slider-card");
    const slider = card?.querySelector("md-slider");
    const valueChip = card?.querySelector(".value-chip");
    const chips = [...(card?.querySelectorAll(".preset-row md-filter-chip") ?? [])];
    const activeChip = chips.find((chip) => chip.selected);
    const innerChip = chips.find((chip) => chip.dataset.shape === "middle") ?? chips[1];
    const head = card?.querySelector(".slider-card-head");
    const title = card?.querySelector(".slider-card-title");
    return {
      exists: Boolean(screen),
      hidden: screen?.hidden,
      title: screen?.querySelector(".screen-title")?.textContent.trim(),
      enterClass: screen?.className,
      chainRows: screen?.querySelectorAll(".chain-row").length,
      hasMenu: Boolean(screen?.querySelector("md-filled-select, md-menu")),
      summary: screen?.querySelector("[data-summary] .role-card-head")?.textContent.replace(/\s+/g, " ").trim(),
      sliders: [...(screen?.querySelectorAll("md-slider") ?? [])].map((slider) => String(slider.value)),
      hash: location.hash,
      cardCount: screen?.querySelectorAll(".slider-card").length,
      cardHeight: card ? Math.round(card.getBoundingClientRect().height) : 0,
      cardWidth: card ? Math.round(card.getBoundingClientRect().width) : 0,
      cardGap: getComputedStyle(screen.querySelector(".card-stack")).rowGap,
      cardRadius: card ? getComputedStyle(card).borderTopLeftRadius : "",
      cardColor: card ? getComputedStyle(card).backgroundColor : "",
      rootPrimary: getComputedStyle(document.documentElement).getPropertyValue("--md-sys-color-primary").trim(),
      rootSecondaryContainer: getComputedStyle(document.documentElement).getPropertyValue("--md-sys-color-secondary-container").trim(),
      headRowHeight: head ? Math.round(head.getBoundingClientRect().height) : 0,
      headIsSingleLine:
        head && title
          ? Math.abs(
              head.getBoundingClientRect().height -
                Math.max(...[...head.children].map((child) => child.getBoundingClientRect().height)),
            ) <= 1
          : false,
      titleFontSize: title ? getComputedStyle(title).fontSize : "",
      titleWeight: title ? getComputedStyle(title).fontWeight : "",
      valueChipLabel: valueChip?.label,
      // The rendered text, not just the property: a value written before the
      // custom element is upgraded would never reach the shadow DOM.
      valueChipText: valueChip?.shadowRoot?.querySelector(".label-text")?.textContent.trim(),
      valueChipHeight: valueChip ? Math.round(valueChip.getBoundingClientRect().height) : 0,
      valueChipStretch: valueChip ? Math.round(valueChip.getBoundingClientRect().width) : 0,
      valueChipRadius: valueChip ? getComputedStyle(valueChip).borderTopLeftRadius : "",
      chipLabels: chips.map((chip) => chip.label),
      chipTexts: chips.map((chip) => chip.shadowRoot?.querySelector(".label-text")?.textContent.trim()),
      chipGap: card ? getComputedStyle(card.querySelector(".preset-row")).columnGap : "",
      chipRadius: innerChip ? getComputedStyle(innerChip).borderTopLeftRadius : "",
      chipHeight: chips[0] ? Math.round(chips[0].getBoundingClientRect().height) : 0,
      chipOverflow: card ? card.querySelector(".preset-row").scrollWidth - card.querySelector(".preset-row").clientWidth : 0,
      selectedChip: activeChip?.dataset.value,
      selectedChipAria: activeChip?.shadowRoot?.querySelector(".primary.action")?.getAttribute("aria-pressed"),
      selectedChipCheck: Boolean(activeChip?.shadowRoot?.querySelector(".checkmark")),
      selectedChipColor: activeChip
        ? getComputedStyle(activeChip).getPropertyValue("--md-filter-chip-selected-container-color").trim()
        : "",
      trackActive: getComputedStyle(slider).getPropertyValue("--md-slider-active-track-color").trim(),
      trackInactive: getComputedStyle(slider).getPropertyValue("--md-slider-inactive-track-color").trim(),
      trackHeight: getComputedStyle(slider).getPropertyValue("--md-slider-active-track-height").trim(),
      handleWidth: getComputedStyle(slider).getPropertyValue("--md-slider-handle-width").trim(),
      handleHeight: getComputedStyle(slider).getPropertyValue("--md-slider-handle-height").trim(),
      fab: (() => {
        const fab = document.querySelector('[data-fab-layer] [data-fab-owner="chinese"]');
        const rect = fab?.getBoundingClientRect();
        return fab && rect
          ? {
              active: fab.dataset.active,
              right: Math.round(window.innerWidth - rect.right),
              bottom: Math.round(window.innerHeight - rect.bottom),
              size: Math.round(rect.width),
              icon: fab.textContent.trim(),
            }
          : null;
      })(),
    };
  });
  check("chinese screen exists and is visible", chinese.exists && !chinese.hidden, JSON.stringify(chinese));
  check("chinese screen titled 中文字型", chinese.title === "中文字型", chinese.title);
  check("chinese screen lists the chain", chinese.chainRows === 2, `rows=${chinese.chainRows}`);
  check("secondary screen has no dropdown menu", chinese.hasMenu === false, JSON.stringify(chinese));
  check("secondary screen shows a font count summary", /2/.test(chinese.summary || ""), chinese.summary);
  check("weight slider reflects module value 600", chinese.sliders.includes("600"), JSON.stringify(chinese.sliders));
  check("hash reflects the screen", chinese.hash === "#chinese", chinese.hash);

  // M3 Expressive slider card: 380dp wide, at least 172dp tall, surfaceContainerHigh
  // with 28dp corners, and 16dp between the cards of a secondary screen.
  check(
    "slider card is a 380dp surfaceContainerHigh container with 28dp corners",
    chinese.cardWidth === 380 && chinese.cardHeight >= 172 && chinese.cardRadius === "28px" && chinese.cardColor === "rgb(236, 230, 240)",
    JSON.stringify({ w: chinese.cardWidth, h: chinese.cardHeight, r: chinese.cardRadius, c: chinese.cardColor }),
  );
  check("secondary screen cards are 16dp apart", chinese.cardGap === "16px", chinese.cardGap);
  check(
    "label row is one line: 28sp title plus a stretched value chip",
    chinese.headIsSingleLine &&
      chinese.titleFontSize === "28px" &&
      chinese.titleWeight === "700" &&
      chinese.valueChipLabel === "600" &&
      chinese.valueChipText === "600" &&
      chinese.valueChipHeight === 40 &&
      chinese.valueChipStretch > 150 &&
      chinese.valueChipRadius === "8px",
    JSON.stringify({
      single: chinese.headIsSingleLine,
      size: chinese.titleFontSize,
      weight: chinese.titleWeight,
      label: chinese.valueChipLabel,
      chipHeight: chinese.valueChipHeight,
      chipWidth: chinese.valueChipStretch,
      chipRadius: chinese.valueChipRadius,
    }),
  );
  check(
    "preset chips share 3dp gaps, 4dp inner corners and 32dp height",
    chinese.chipLabels.length === 9 &&
      JSON.stringify(chinese.chipTexts) === JSON.stringify(["100", "200", "300", "400", "500", "600", "700", "800", "900"]) &&
      chinese.chipGap === "3px" &&
      chinese.chipRadius === "4px" &&
      chinese.chipHeight === 32 &&
      chinese.chipOverflow > 0,
    JSON.stringify({ labels: chinese.chipLabels, gap: chinese.chipGap, radius: chinese.chipRadius, height: chinese.chipHeight, overflow: chinese.chipOverflow }),
  );
  check(
    "the preset matching the value is selected with secondaryContainer",
    chinese.selectedChip === "600" &&
      chinese.selectedChipAria === "true" &&
      chinese.selectedChipCheck &&
      chinese.selectedChipColor === chinese.rootSecondaryContainer,
    JSON.stringify({
      selected: chinese.selectedChip,
      aria: chinese.selectedChipAria,
      check: chinese.selectedChipCheck,
      color: chinese.selectedChipColor,
      secondaryContainer: chinese.rootSecondaryContainer,
    }),
  );
  check(
    "slider uses a 16dp track and a 4x44 handle (primary / secondaryContainer)",
    chinese.trackHeight === "16px" &&
      chinese.handleWidth === "4px" &&
      chinese.handleHeight === "44px" &&
      chinese.trackActive === chinese.rootPrimary &&
      chinese.trackInactive === chinese.rootSecondaryContainer,
    JSON.stringify({
      track: chinese.trackHeight,
      handle: [chinese.handleWidth, chinese.handleHeight],
      active: chinese.trackActive,
      primary: chinese.rootPrimary,
      inactive: chinese.trackInactive,
      secondaryContainer: chinese.rootSecondaryContainer,
    }),
  );
  check(
    "add FAB floats in the bottom-right corner of the app column",
    chinese.fab?.active === "true" &&
      chinese.fab.icon === "add" &&
      chinese.fab.size === 56 &&
      chinese.fab.right === 16 &&
      chinese.fab.bottom === 16,
    JSON.stringify(chinese.fab),
  );

  // The FAB must not scroll away with the list (it is anchored outside the scroller).
  await page.evaluate(() => {
    const screen = document.querySelector("section[data-screen='chinese']");
    screen.scrollTop = screen.scrollHeight;
  });
  await page.waitForTimeout(200);
  const scrolledFab = await page.evaluate(() => {
    const rect = document.querySelector('[data-fab-layer] [data-fab-owner="chinese"]').getBoundingClientRect();
    return { right: Math.round(window.innerWidth - rect.right), bottom: Math.round(window.innerHeight - rect.bottom) };
  });
  check(
    "FAB stays pinned while the screen scrolls",
    scrolledFab.right === chinese.fab.right && scrolledFab.bottom === chinese.fab.bottom,
    JSON.stringify(scrolledFab),
  );
  await page.evaluate(() => {
    document.querySelector("section[data-screen='chinese']").scrollTop = 0;
  });

  const material = await page.evaluate(() => {
    const screen = document.querySelector("section[data-screen='chinese']");
    const icon = screen.querySelector("md-icon");
    const iconRect = icon.getBoundingClientRect();
    const iconButton = screen.querySelector("md-icon-button");
    const buttonRect = iconButton.getBoundingClientRect();
    const title = screen.querySelector(".screen-title");
    const chainRow = screen.querySelector(".chain-row");
    const offenders = [...screen.querySelectorAll("*")]
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      // Elements inside a horizontal scroller (the connected preset chip group)
      // are clipped on purpose and do not widen the page.
      .filter(({ element, rect }) => rect.width > 0 && !element.closest(".preset-row"))
      .filter(({ rect }) => rect.right > window.innerWidth + 1 || rect.left < -1)
      .map(({ element }) => element.tagName.toLowerCase());
    return {
      robotoFlex: document.fonts.check('16px "Roboto Flex"'),
      symbols: document.fonts.check('24px "Material Symbols Rounded"'),
      iconFont: getComputedStyle(icon).fontFamily,
      iconWidth: iconRect.width,
      iconIsLigature: icon.textContent.trim().length > 1 && iconRect.width <= 40,
      iconButtonSize: [buttonRect.width, buttonRect.height],
      iconButtonRadius: parseFloat(getComputedStyle(iconButton).borderTopLeftRadius),
      titleVariation: getComputedStyle(title).fontVariationSettings,
      titleWeight: getComputedStyle(title).fontWeight,
      chainRowHeight: chainRow ? chainRow.getBoundingClientRect().height : 0,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      offenders,
    };
  });
  check("Roboto Flex and Material Symbols load offline", material.robotoFlex && material.symbols, JSON.stringify(material));
  check(
    "icons render as ligature glyphs, not text",
    material.iconFont.includes("Material Symbols Rounded") && material.iconIsLigature,
    JSON.stringify({ font: material.iconFont, width: material.iconWidth }),
  );
  check(
    "app bar title uses the titleLarge weight",
    material.titleWeight === "600",
    JSON.stringify({ variation: material.titleVariation, weight: material.titleWeight }),
  );
  check(
    "nothing overflows the secondary screen",
    material.overflowX <= 0 && material.offenders.length === 0,
    JSON.stringify({ overflowX: material.overflowX, offenders: material.offenders }),
  );
  check(
    "app bar icon button is a 48dp circle",
    material.iconButtonSize.every((size) => Math.round(size) === 48) &&
      (String(material.iconButtonRadius) === "50%" || material.iconButtonRadius >= 24),
    JSON.stringify({ size: material.iconButtonSize, radius: material.iconButtonRadius }),
  );

  // the on-screen back arrow must return to the menu
  await page.evaluate(() => document.querySelector("section[data-screen='chinese'] [data-back]").click());
  await page.waitForTimeout(700);
  const afterArrow = await page.evaluate(() => ({
    menuHidden: document.querySelector("section[data-screen='menu']")?.hidden,
    hash: location.hash,
  }));
  check("back arrow returns to the menu", afterArrow.menuHidden === false && afterArrow.hash === "#menu", JSON.stringify(afterArrow));

  // and so must the system back gesture from a secondary screen
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll("section[data-screen='menu'] md-list-item")];
    rows[1].click();
  });
  await page.waitForTimeout(700);
  await page.goBack();
  await page.waitForTimeout(700);
  const afterGesture = await page.evaluate(() => ({
    menuHidden: document.querySelector("section[data-screen='menu']")?.hidden,
    screens: [...document.querySelectorAll("section.screen")].map((s) => `${s.dataset.screen}${s.hidden ? "(hidden)" : ""}`),
  }));
  check("back gesture returns to the menu", afterGesture.menuHidden === false, JSON.stringify(afterGesture));

  // 西文字型 -> slides in from the left, empty state
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll("section[data-screen='menu'] md-list-item")];
    rows[2].click();
  });
  await page.waitForTimeout(700);
    const latin = await page.evaluate(() => {
    const screen = document.querySelector("section[data-screen='western']");
    const card = screen?.querySelector(".slider-card");
    const fab = document.querySelector('[data-fab-layer] [data-fab-owner="western"]');
    const rect = fab?.getBoundingClientRect();
    return {
      title: screen?.querySelector(".screen-title")?.textContent.trim(),
      emptyTitle: screen?.querySelector(".empty-state .typescale-title-medium-emphasized")?.textContent.trim(),
      inScreenFab: Boolean(screen?.querySelector("md-fab")),
      fab: Boolean(fab && fab.dataset.active === "true"),
      fabCorner: rect ? { right: Math.round(window.innerWidth - rect.right), bottom: Math.round(window.innerHeight - rect.bottom) } : null,
      menuFabHidden: document.querySelector('[data-fab-layer] [data-fab-owner="chinese"]')?.dataset.active,
      cardTitle: card?.querySelector(".slider-card-title")?.textContent.trim(),
      valueChipLabel: card?.querySelector(".value-chip")?.label,
      presetLabels: [...(card?.querySelectorAll(".preset-row md-filter-chip") ?? [])].map((chip) => chip.label),
      selectedPreset: [...(card?.querySelectorAll(".preset-row md-filter-chip") ?? [])].find((chip) => chip.selected)?.dataset.value,
      sliders: [...(screen?.querySelectorAll("md-slider") ?? [])].map((slider) => String(slider.value)),
    };
  });
  check("latin screen titled 西文字型", latin.title === "西文字型", latin.title);
  check("latin empty state shown", latin.emptyTitle === "尚未上傳字型", JSON.stringify(latin));
  check(
    "the add FAB floats outside the screen, bottom-right, and only for the visible screen",
    latin.fab && !latin.inScreenFab && latin.fabCorner?.right === 16 && latin.fabCorner?.bottom === 16 && latin.menuFabHidden === "false",
    JSON.stringify(latin),
  );
  check(
    "latin size card shows 西文字號 with a stretched 90% chip and presets",
    latin.cardTitle === "西文字號" &&
      latin.valueChipLabel === "90%" &&
      JSON.stringify(latin.presetLabels) === JSON.stringify(["50%", "75%", "90%", "100%"]) &&
      latin.selectedPreset === "90",
    JSON.stringify(latin),
  );
  check("latin size slider reflects 90", latin.sliders.includes("90"), JSON.stringify(latin.sliders));
  check("latin screen hides the weight slider (static chain)", latin.sliders.length === 1, JSON.stringify(latin.sliders));

  // a preset chip writes the value straight through to the module
  await page.evaluate(() => {
    const chip = [...document.querySelectorAll("section[data-screen='western'] .preset-row md-filter-chip")].find(
      (item) => item.dataset.value === "75",
    );
    chip.click();
  });
  await page.waitForTimeout(500);
  const presetCommand = await page.evaluate(() =>
    window.__commands.filter((command) => command.includes("western-size")).at(-1),
  );
  check("a preset chip applies its value", /western-size 75$/.test(presetCommand || ""), presetCommand);

  // the value chip opens the exact-value dialog; invalid input must not save
  await page.evaluate(() => document.querySelector("section[data-screen='western'] .value-chip").click());
  await page.waitForTimeout(400);
  const valueDialogState = await page.evaluate(() => {
    const dialog = [...document.querySelectorAll("md-dialog")].find((item) => item.open);
    return {
      open: Boolean(dialog),
      headline: dialog?.querySelector('[slot="headline"]')?.textContent.trim(),
      field: dialog?.querySelector("md-outlined-text-field")?.value,
    };
  });
  check(
    "the value chip opens the exact value dialog",
    valueDialogState.open && valueDialogState.headline === "輸入精確數值" && valueDialogState.field === "75",
    JSON.stringify(valueDialogState),
  );
  await page.evaluate(() => {
    const dialog = [...document.querySelectorAll("md-dialog")].find((item) => item.open);
    dialog.querySelector("md-outlined-text-field").value = "999";
    dialog.querySelector('.dialog-actions [value="confirm"]').click();
  });
  await page.waitForTimeout(300);
  const invalidState = await page.evaluate(() => {
    const dialog = [...document.querySelectorAll("md-dialog")].find((item) => item.open);
    const field = dialog?.querySelector("md-outlined-text-field");
    return { stillOpen: Boolean(dialog), error: field?.error, errorText: field?.errorText };
  });
  check(
    "an out-of-range value keeps the dialog open with an error",
    invalidState.stillOpen && invalidState.error === true && /20 到 100/.test(invalidState.errorText || ""),
    JSON.stringify(invalidState),
  );
  await page.evaluate(() => {
    const dialog = [...document.querySelectorAll("md-dialog")].find((item) => item.open);
    dialog.querySelector("md-outlined-text-field").value = "55";
    dialog.querySelector('.dialog-actions [value="confirm"]').click();
  });
  await page.waitForTimeout(800);
  const exactCommand = await page.evaluate(() => ({
    command: window.__commands.filter((command) => command.includes("western-size")).at(-1),
    dialogOpen: [...document.querySelectorAll("md-dialog")].some((item) => item.open),
  }));
  check(
    "a valid exact value is saved and closes the dialog",
    /western-size 55$/.test(exactCommand.command || "") && !exactCommand.dialogOpen,
    JSON.stringify(exactCommand),
  );

  // add-font dialog from the FAB
  await page.evaluate(() =>
    document.querySelector('[data-fab-layer] [data-fab-owner="western"]').click(),
  );
  await page.waitForTimeout(400);
  const addDialog = await page.evaluate(() => {
    const dialog = [...document.querySelectorAll("md-dialog")].find((item) => item.open);
    return {
      open: Boolean(dialog),
      headline: dialog?.querySelector('[slot="headline"]')?.textContent.trim(),
      buttons: [...(dialog?.querySelectorAll("md-text-button, md-filled-button") ?? [])].map((button) => button.textContent.trim()),
    };
  });
  check("add font dialog opens with file and path actions", addDialog.open && addDialog.buttons.includes("選擇檔案") && addDialog.buttons.includes("匯入"), JSON.stringify(addDialog));

  // clicking an action button must close the dialog (Material Web only closes on
  // a <form method="dialog"> submit, so ui.js wires the actions up itself)
  await page.evaluate(() => {
    const dialog = [...document.querySelectorAll("md-dialog")].find((item) => item.open);
    dialog.querySelector('.dialog-actions [value="cancel"]').click();
  });
  await page.waitForTimeout(800);
  const closed = await page.evaluate(() => [...document.querySelectorAll("md-dialog")].some((item) => item.open));
  check("an action button closes the dialog", closed === false, String(closed));

  // dismiss the dialog and use the inline fallback switch on the menu
  await page.evaluate(() => {
    const dialog = [...document.querySelectorAll("md-dialog")].find((item) => item.open);
    dialog?.close?.();
    if (dialog) dialog.open = false;
  });
  await page.goBack();
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll("section[data-screen='menu'] md-list-item")];
    const toggle = rows[4].querySelector("md-switch");
    toggle.selected = false;
    toggle.dispatchEvent(new Event("change"));
  });
  await page.waitForTimeout(500);
  const fallbackCommand = await page.evaluate(() =>
    window.__commands.filter((command) => command.includes("fallback-set")).at(-1),
  );
  check("inline fallback switch calls fallback-set 0", /fallback-set 0$/.test(fallbackCommand || ""), fallbackCommand);

  //  Emoji 設定 -> top app bar, settings card and preview card
  await page.evaluate(() => document.querySelectorAll("section[data-screen='menu'] md-list-item")[3].click());
  await page.waitForTimeout(700);
  const emoji = await page.evaluate(() => {
    const screen = document.querySelector("section[data-screen='emoji']");
    const header = screen?.querySelector(".screen-header");
    const back = header?.querySelector("[data-back]");
    const switchEl = screen?.querySelector("[data-enable]");
    const select = screen?.querySelector("[data-mode]");
    const preview = screen?.querySelector(".emoji-preview-card");
    const media = screen?.querySelector(".emoji-preview-media");
    return {
      title: screen?.querySelector(".screen-title")?.textContent.trim(),
      headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
      backSize: back ? Math.round(back.getBoundingClientRect().width) : 0,
      settingsTitle: screen?.querySelector(".emoji-settings-copy .typescale-title-medium-emphasized")?.textContent.trim(),
      switchOn: switchEl?.selected,
      selectValue: select?.value,
      selectLabel: select?.getAttribute("label"),
      leadingIcon: select?.querySelector('md-icon[slot="leading-icon"]')?.textContent.trim(),
      trailingIcon: select?.querySelector('md-icon[slot="trailing-icon"]')?.textContent.trim(),
      options: [...(select?.querySelectorAll("md-select-option") ?? [])].map((option) => ({
        value: option.value,
        text: option.querySelector('[slot="headline"]')?.textContent.trim(),
        disabled: option.disabled,
      })),
      previewTitle: preview?.querySelector(".typescale-title-medium-emphasized")?.textContent.trim(),
      previewBody: screen?.querySelector("[data-target]")?.textContent.trim(),
      mediaHeight: media ? Math.round(media.getBoundingClientRect().height) : 0,
      mediaColor: media ? getComputedStyle(media).backgroundColor : "",
      cardHeight: preview ? Math.round(preview.getBoundingClientRect().height) : 0,
      cardRadius: preview ? getComputedStyle(preview).borderTopLeftRadius : "",
      cardColor: preview ? getComputedStyle(preview).backgroundColor : "",
    };
  });
  check(
    "emoji screen uses the 64dp Emoji top app bar",
    emoji.title === "Emoji" && emoji.headerHeight === 64 && emoji.backSize === 48,
    JSON.stringify(emoji),
  );
  check(
    "emoji settings card shows the copy and an off switch",
    emoji.settingsTitle === "Emoji 設定" && emoji.switchOn === false,
    JSON.stringify(emoji),
  );
  check(
    "emoji dropdown starts with system/Google/Blobmoji and a face icon",
    emoji.selectValue === "default" &&
      emoji.selectLabel === "Emoji" &&
      emoji.leadingIcon === "face" &&
      emoji.trailingIcon === "arrow_drop_down" &&
      JSON.stringify(emoji.options.slice(0, 3).map((option) => option.value)) === JSON.stringify(["default", "google", "blobmoji"]),
    JSON.stringify(emoji),
  );
  check(
    "emoji preview is a 380dp filled card with a 280dp primaryContainer image",
    emoji.previewTitle === "Emoji 預覽" &&
      emoji.cardHeight >= 380 &&
      emoji.mediaHeight === 280 &&
      emoji.cardRadius === "20px" &&
      emoji.cardColor === "rgb(230, 224, 233)" &&
      emoji.mediaColor === "rgb(234, 221, 255)",
    JSON.stringify(emoji),
  );
  check("emoji preview shows the current target", /不覆蓋/.test(emoji.previewBody || ""), emoji.previewBody);

  // turning the switch on applies the first available source (Google)
  await page.evaluate(() => {
    const sw = document.querySelector("section[data-screen='emoji'] [data-enable]");
    sw.selected = true;
    sw.dispatchEvent(new Event("change"));
  });
  await page.waitForTimeout(500);
  const emojiSwitchCommand = await page.evaluate(() =>
    window.__commands.filter((command) => command.includes("emoji-set")).at(-1),
  );
  check("turning the switch on applies a source", /emoji-set google$/.test(emojiSwitchCommand || ""), emojiSwitchCommand);

  // choosing Blobmoji from the dropdown applies it
  await page.evaluate(() => {
    const select = document.querySelector("section[data-screen='emoji'] [data-mode]");
    select.value = "blobmoji";
    select.dispatchEvent(new Event("change"));
  });
  await page.waitForTimeout(500);
  const emojiSelectCommand = await page.evaluate(() =>
    window.__commands.filter((command) => command.includes("emoji-set")).at(-1),
  );
  check("choosing a source applies it", /emoji-set blobmoji$/.test(emojiSelectCommand || ""), emojiSelectCommand);

  await page.goBack();
  await page.waitForTimeout(600);

  // Regression: no font bytes may ever cross the bridge from the UI itself
  // (a base64 of a 10 MB font froze the WebView before).
  await page.evaluate(() => document.querySelectorAll("section[data-screen='menu'] md-list-item")[1].click());
  await page.waitForTimeout(1200);
  const byteCommands = await page.evaluate(() => window.__commands.filter((command) => command.startsWith("base64 ")));
  check("no font byte transfers when opening a font screen", byteCommands.length === 0, JSON.stringify(byteCommands.slice(0, 2)));

  const chips = await page.evaluate(() => {
    const chip = document.querySelector("section[data-screen='menu'] .status-chip");
    return { text: chip?.textContent.trim(), state: chip?.dataset.state };
  });
  check("connection chip is visible on the menu", Boolean(chips.text) && chips.state === "ok", JSON.stringify(chips));

  // dark scheme uses the documented dark palette when no accent is available
  const darkPage = await browser.newPage({ viewport: { width: 412, height: 892 }, locale: "zh-TW", colorScheme: "dark" });
  const darkErrors = [];
  darkPage.on("pageerror", (error) => darkErrors.push(error.message));
  await darkPage.addInitScript(bridgeInitScript, { fontBase64, status: STATUS, families: FAMILIES });
  await darkPage.goto(`http://127.0.0.1:${port}/index.html`);
  await darkPage.waitForSelector("section[data-screen='menu'] md-list-item");
  await darkPage.waitForTimeout(400);
  const dark = await darkPage.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      mode: document.documentElement.dataset.theme,
      surface: style.getPropertyValue("--md-sys-color-surface").trim(),
      primary: style.getPropertyValue("--md-sys-color-primary").trim(),
      scheme: getComputedStyle(document.querySelector("body")).backgroundColor,
      errors: [],
    };
  });
  check("dark mode follows the system setting", dark.mode === "dark", JSON.stringify(dark));
  check("dark palette uses the documented values", dark.surface === "#141317" && dark.primary === "#d2bcfc", JSON.stringify(dark));
  check("no page errors in dark mode", darkErrors.length === 0, darkErrors.join("; "));
  await darkPage.close();
} finally {
  await browser.close();
  server.close();
}

const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) process.exit(1);
