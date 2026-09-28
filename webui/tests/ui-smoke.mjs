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
  "chinese_weight=650",
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
      setTimeout(() => window[callbackName](0, output, ""), 0);
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
    const fab = screen.querySelector("md-fab");
    const fabPart = fab?.shadowRoot?.querySelector(".fab");
    const rows = items.map((item) => item.querySelector('[slot="headline"]')?.textContent.trim());
    return {
      title: title?.textContent.trim(),
      titleFontSize: title ? getComputedStyle(title).fontSize : "",
      rowCount: items.length,
      rows,
      fabIcon: fab?.textContent.trim(),
      fabSize: fab?.getAttribute("size"),
      fabRadius: fabPart ? parseFloat(getComputedStyle(fabPart).borderTopLeftRadius) : 0,
      fabColor: fabPart ? getComputedStyle(fabPart).backgroundColor : "",
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
  check("menu title is 字型設定 at 28sp", menu.title === "字型設定" && menu.titleFontSize === "28px", JSON.stringify(menu));
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
    "reboot FAB is a medium power_settings_new FAB with 16dp corners",
    menu.fabIcon === "power_settings_new" && menu.fabSize === "medium" && menu.fabRadius === 16 && menu.fabColor === "rgb(234, 221, 255)",
    JSON.stringify({ icon: menu.fabIcon, size: menu.fabSize, radius: menu.fabRadius, color: menu.fabColor }),
  );
  check("list items are separated by 3dp", menu.groupGap === "3px", menu.groupGap);
  check("fallback palette active without accent", menu.themeSource === "fallback", menu.themeSource);

  // 中文字型 -> slides in from the right
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll("section[data-screen='menu'] md-list-item")];
    rows[1].click();
  });
  await page.waitForTimeout(700);
  const chinese = await page.evaluate(() => {
    const screen = document.querySelector("section[data-screen='chinese']");
    return {
      exists: Boolean(screen),
      hidden: screen?.hidden,
      title: screen?.querySelector(".screen-title")?.textContent.trim(),
      enterClass: screen?.className,
      chainRows: screen?.querySelectorAll(".chain-row").length,
      previewPanel: Boolean(screen?.querySelector(".preview-panel")),
      previewSelect: Boolean(screen?.querySelector(".preview-panel md-filled-select")),
      previewOptions: screen?.querySelectorAll(".preview-panel md-select-option").length,
      sampleFont: screen?.querySelector("[data-sample]")?.style.fontFamily.slice(0, 40),
      sliders: [...(screen?.querySelectorAll("md-slider") ?? [])].map((slider) => String(slider.value)),
      hash: location.hash,
    };
  });
  check("chinese screen exists and is visible", chinese.exists && !chinese.hidden, JSON.stringify(chinese));
  check("chinese screen titled 中文字型", chinese.title === "中文字型", chinese.title);
  check("chinese screen lists the chain", chinese.chainRows === 2, `rows=${chinese.chainRows}`);
  check("preview panel with exposed dropdown", chinese.previewPanel && chinese.previewSelect && chinese.previewOptions === 3, JSON.stringify(chinese));
  check("weight slider reflects module value 650", chinese.sliders.includes("650"), JSON.stringify(chinese.sliders));
  check("hash reflects the screen", chinese.hash === "#chinese", chinese.hash);

  const slug = await page.evaluate(() => {
    const screen = document.querySelector("section[data-screen='chinese']");
    return screen.querySelector(".preview-caption")?.textContent.trim();
  });
  check("preview caption names the family", Boolean(slug), slug);

  const material = await page.evaluate(() => {
    const screen = document.querySelector("section[data-screen='chinese']");
    const canvas = screen.querySelector(".preview-canvas");
    const canvasRect = canvas.getBoundingClientRect();
    const select = screen.querySelector(".preview-panel md-filled-select");
    const selectRect = select.getBoundingClientRect();
    const icon = screen.querySelector("md-icon");
    const iconRect = icon.getBoundingClientRect();
    const iconButton = screen.querySelector("md-icon-button");
    const buttonRect = iconButton.getBoundingClientRect();
    const title = screen.querySelector(".screen-title");
    const chainRow = screen.querySelector(".chain-row");
    return {
      robotoFlex: document.fonts.check('16px "Roboto Flex"'),
      symbols: document.fonts.check('24px "Material Symbols Rounded"'),
      iconFont: getComputedStyle(icon).fontFamily,
      iconWidth: iconRect.width,
      iconIsLigature: icon.textContent.trim().length > 1 && iconRect.width <= 40,
      canvasHeight: canvasRect.height,
      canvasRadius: parseFloat(getComputedStyle(canvas).borderTopLeftRadius),
      canvasColor: getComputedStyle(canvas).backgroundColor,
      selectOverlapsCanvas: selectRect.top < canvasRect.bottom && selectRect.bottom > canvasRect.bottom,
      selectHeight: selectRect.height,
      iconButtonSize: [buttonRect.width, buttonRect.height],
      iconButtonRadius: parseFloat(getComputedStyle(iconButton).borderTopLeftRadius),
      titleVariation: getComputedStyle(title).fontVariationSettings,
      titleWeight: getComputedStyle(title).fontWeight,
      chainRowHeight: chainRow ? chainRow.getBoundingClientRect().height : 0,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  check("Roboto Flex and Material Symbols load offline", material.robotoFlex && material.symbols, JSON.stringify(material));
  check(
    "icons render as ligature glyphs, not text",
    material.iconFont.includes("Material Symbols Rounded") && material.iconIsLigature,
    JSON.stringify({ font: material.iconFont, width: material.iconWidth }),
  );
  check(
    "title uses the emphasized weight",
    /700/.test(String(material.titleVariation)) || material.titleWeight === "700",
    JSON.stringify({ variation: material.titleVariation, weight: material.titleWeight }),
  );
  check(
    "preview canvas is 220dp tall surfaceContainerHigh with 28dp corners",
    Math.round(material.canvasHeight) === 220 &&
      material.canvasRadius === 28 &&
      material.canvasColor === "rgb(236, 230, 240)",
    JSON.stringify({ h: material.canvasHeight, r: material.canvasRadius, c: material.canvasColor }),
  );
  check(
    "dropdown overlaps the container and is 56dp tall",
    material.selectOverlapsCanvas && Math.round(material.selectHeight) === 56,
    JSON.stringify({ overlap: material.selectOverlapsCanvas, height: material.selectHeight }),
  );
  check(
    "icon button is a 56dp circle",
    material.iconButtonSize.every((size) => Math.round(size) === 56) && String(material.iconButtonRadius) === "50%" || material.iconButtonRadius >= 28,
    JSON.stringify({ size: material.iconButtonSize, radius: material.iconButtonRadius }),
  );
  check("no horizontal overflow at 412dp", material.overflowX <= 0, String(material.overflowX));

  // back via the system/history gesture
  await page.goBack();
  await page.waitForTimeout(700);
  const afterBack = await page.evaluate(() => ({
    menuHidden: document.querySelector("section[data-screen='menu']")?.hidden,
    chineseHidden: document.querySelector("section[data-screen='chinese']")?.hidden,
  }));
  check("back returns to the menu", afterBack.menuHidden === false, JSON.stringify(afterBack));

  // 西文字型 -> slides in from the left, empty state
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll("section[data-screen='menu'] md-list-item")];
    rows[2].click();
  });
  await page.waitForTimeout(700);
    const latin = await page.evaluate(() => {
    const screen = document.querySelector("section[data-screen='western']");
    return {
      title: screen?.querySelector(".screen-title")?.textContent.trim(),
      emptyTitle: screen?.querySelector(".empty-state .typescale-title-medium-emphasized")?.textContent.trim(),
      fab: Boolean(screen?.querySelector("md-fab")),
      sliders: [...(screen?.querySelectorAll("md-slider") ?? [])].map((slider) => String(slider.value)),
    };
  });
  check("latin screen titled 西文字型", latin.title === "西文字型", latin.title);
  check("latin empty state shown", latin.emptyTitle === "尚未上傳字型", JSON.stringify(latin));
  check("latin screen has the add FAB", latin.fab, JSON.stringify(latin));
  check("latin size slider reflects 90", latin.sliders.includes("90"), JSON.stringify(latin.sliders));
  check("latin screen hides the weight slider (static chain)", latin.sliders.length === 1, JSON.stringify(latin.sliders));

  // add-font dialog from the FAB
  await page.evaluate(() => document.querySelector("section[data-screen='western'] md-fab").click());
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

  // dismiss the dialog and use the inline fallback switch on the menu
  await page.evaluate(() => {
    const dialog = [...document.querySelectorAll("md-dialog")].find((item) => item.open);
    dialog.close?.();
    dialog.open = false;
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
