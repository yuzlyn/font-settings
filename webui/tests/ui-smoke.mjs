/**
 * Headless smoke test for the built WebUI.
 *
 * Serves font-settings/webroot over HTTP (the bundle cannot run from file://)
 * and drives it with the mock bridge from harness.mjs: icon rendering, layout,
 * navigation, the fallback switch, the control cards, dialogs, the Emoji sheet
 * and the responsive/touch rules.
 *
 *   node webui/tests/ui-smoke.mjs
 */

import { createServer, launch, openPage } from "./harness.mjs";

const checks = [];
function check(name, condition, detail = "") {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition || !detail ? "" : `\n      ${detail}`}`);
}

const { server, port } = await createServer();
const browser = await launch();
const page = await openPage(browser, port);

/* ------------------------------------------------------------------- boot */

check("no uncaught page errors", page.__errors.length === 0, page.__errors.join(" | "));
check("boot error panel stays hidden", await page.locator("#boot-error").isHidden());
check("menu screen is the initial route", await page.locator("section[data-screen='menu']").isVisible());
check("app bar title is revealed only after scrolling", await page.evaluate(() => {
  const bar = document.querySelector("section[data-screen='menu'] .app-bar");
  return bar?.dataset.scrolled === "false";
}));

/* ------------------------------------------------------------------ fonts */

const fonts = await page.evaluate(() => {
  const icons = [...document.querySelectorAll(".icon")];
  const widths = icons.map((icon) => Math.round(icon.getBoundingClientRect().width));
  const css = [...document.styleSheets]
    .flatMap((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText);
      } catch {
        return [];
      }
    })
    .join("\n");
  return {
    roboto: document.fonts.check('16px "Roboto Flex"'),
    symbols: document.fonts.check('24px "Material Symbols Rounded"'),
    iconCount: icons.length,
    maxIcon: Math.max(...widths),
    inlined: css.includes("data:font/woff2"),
  };
});

check("Roboto Flex loads offline", fonts.roboto);
check("Material Symbols loads offline", fonts.symbols);
check("fonts are inlined as data URIs", fonts.inlined);
check(
  "every icon renders as a ligature glyph",
  fonts.iconCount > 10 && fonts.maxIcon <= 32,
  `icons=${fonts.iconCount} maxWidth=${fonts.maxIcon}`,
);

/* ------------------------------------------------------------- menu shell */

const menu = await page.evaluate(() => ({
  hero: document.querySelector("section[data-screen='menu'] .hero-title")?.textContent.trim(),
  rows: document.querySelectorAll("section[data-screen='menu'] .list-item").length,
  nav: document.querySelectorAll(".nav-bar .nav-item").length,
  navCurrent: document.querySelector(".nav-bar .nav-item[aria-current='page']")?.dataset.nav,
  sample: document.querySelector(".preview-sample")?.textContent.trim(),
  bridge: document.querySelector("[data-bridge]")?.textContent.trim(),
  chinese: document.querySelector("[data-chinese]")?.textContent.trim(),
}));

check("hero shows the page title", menu.hero === "字型設定", menu.hero);
check("four editing rows are listed", menu.rows === 4, String(menu.rows));
check("bottom navigation has three tabs", menu.nav === 3, String(menu.nav));
check("fonts tab is marked as current", menu.navCurrent === "menu", String(menu.navCurrent));
check("preview shows a real sample", menu.sample === "永字八法 Aa 0123", String(menu.sample));
check("connection chip reports KernelSU", menu.bridge?.includes("KernelSU"), String(menu.bridge));
check("preview names the first Chinese font", menu.chinese === "PingRoundSCVF.ttf", String(menu.chinese));

check("scrolling tones the app bar and reveals its title", await page.evaluate(async () => {
  const screen = document.querySelector("section[data-screen='menu']");
  screen.scrollTop = 220;
  await new Promise((resolve) => setTimeout(resolve, 400));
  const bar = screen.querySelector(".app-bar");
  const revealed = bar?.dataset.scrolled === "true" && getComputedStyle(bar.querySelector(".app-bar-title")).opacity === "1";
  screen.scrollTop = 0;
  return revealed;
}));

/* -------------------------------------------------------- fallback switch */

const switchEl = page.locator("section[data-screen='menu'] .switch");
check("fallback switch mirrors the module state", (await switchEl.getAttribute("aria-checked")) === "true");
await switchEl.click();
await page.waitForTimeout(250);
const switchCommands = await page.evaluate(() => window.__commands.filter((command) => command.includes("fallback-set")));
check("toggling the switch calls fallback-set", switchCommands.some((command) => command.endsWith("0")), switchCommands.join(" | "));

/* -------------------------------------------------------------- theme/a11y */

const theme = await page.evaluate(() => {
  const root = getComputedStyle(document.documentElement);
  const buttons = [...document.querySelectorAll(".icon-btn")].map((button) => {
    const rect = button.getBoundingClientRect();
    return Math.min(rect.width, rect.height);
  });
  return {
    primary: root.getPropertyValue("--md-sys-color-primary").trim(),
    surface: root.getPropertyValue("--md-sys-color-surface").trim(),
    tokenCount: [...document.styleSheets]
      .flatMap((sheet) => {
        try {
          return [...sheet.cssRules].map((rule) => rule.cssText);
        } catch {
          return [];
        }
      })
      .join("\n")
      .match(/--md-sys-color-[\w-]+/g)?.length ?? 0,
    minIconButton: Math.min(...buttons),
  };
});
check("M3 colour roles are defined", theme.primary && theme.surface && theme.tokenCount > 30, JSON.stringify(theme));
check("icon buttons meet the 48dp touch target", theme.minIconButton >= 44, String(theme.minIconButton));

/* ------------------------------------------------------------ navigation */

await page.click(".nav-item[data-nav='about']");
await page.waitForTimeout(600);
check("about tab opens", await page.locator("section[data-screen='about']").isVisible());
check("about tab is marked current", (await page.getAttribute(".nav-item[data-nav='about']", "aria-current")) === "page");
check(
  "status row summarises the targets",
  (await page.locator("section[data-screen='about'] .list-supporting").first().textContent()).includes("10"),
);


await page.click("section[data-screen='about'] .list-item:nth-child(1)");
await page.waitForTimeout(400);
const statusDialog = page.locator(".scrim .dialog");
check("status dialog opens", await statusDialog.isVisible());
check("status dialog actions stack", (await page.getAttribute(".scrim .dialog-actions", "data-stacked")) === "true");
check("status dialog lists the chains", (await statusDialog.textContent()).includes("漢字 2 · 拉丁文 1"));
await page.keyboard.press("Escape");
await page.waitForTimeout(350);
check("Escape closes the dialog", await page.locator(".scrim").count() === 0);

/* -------------------------------------------- interrupted tab transition */

// Tapping a tab and immediately coming back used to let the fade-out timer
// hide the screen that had just become active again.
await page.click(".nav-item[data-nav='about']");
await page.waitForTimeout(120);
await page.click(".nav-item[data-nav='menu']");
await page.waitForTimeout(700);
check(
  "fast tab round-trip leaves the screen visible",
  await page.evaluate(() => {
    const menu = document.querySelector("section[data-screen='menu']");
    const icon = menu?.querySelector(".list-leading .icon");
    return Boolean(
      menu &&
        !menu.hidden &&
        menu.classList.contains("screen-active") &&
        icon &&
        icon.getBoundingClientRect().width > 0,
    );
  }),
);

/* ----------------------------------------------------------- role screen */

await page.click("section[data-screen='menu'] .list-item:nth-child(1)");
await page.waitForTimeout(650);

const role = await page.evaluate(() => ({
  visible: !!document.querySelector("section[data-screen='chinese']")?.classList.contains("screen-active"),
  rows: document.querySelectorAll("section[data-screen='chinese'] .chain-row").length,
  handles: document.querySelectorAll("section[data-screen='chinese'] .chain-handle").length,
  indicies: [...document.querySelectorAll("section[data-screen='chinese'] .chain-index")].map((node) => node.textContent.trim()),
  count: document.querySelector("section[data-screen='chinese'] [data-count]")?.textContent.trim(),
  weight: document.querySelector("section[data-screen='chinese'] .value-text")?.textContent.trim(),
  fab: document.querySelector(".fab[data-fab-owner='chinese']")?.dataset.active,
  navHidden: document.querySelector(".nav-bar")?.dataset.visible,
}));
check("Chinese screen enters", role.visible);
check("chain renders every font", role.rows === 2, String(role.rows));
check("each row exposes a drag handle", role.handles === 2, String(role.handles));
check("chain rows are numbered", role.indicies.join(",") === "1,2", role.indicies.join(","));
check("count chip matches the chain", role.count === "2 個字型", String(role.count));
check("variable font shows the weight control", role.weight === "650", String(role.weight));
check("add FAB is pinned for this screen", role.fab === "true", String(role.fab));
check("nav bar hides on a secondary screen", role.navHidden === "false", String(role.navHidden));

await page.evaluate(() => {
  const slider = document.querySelector("section[data-screen='chinese'] .slider");
  slider.value = "700";
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  slider.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(250);
const weightCommand = await page.evaluate(() =>
  window.__commands.find((command) => command.includes("weight-set")),
);
check("weight slider calls weight-set", weightCommand?.includes("chinese 700"), String(weightCommand));

await page.click("section[data-screen='chinese'] .chain-row [data-detail]");
await page.waitForTimeout(400);
check("font detail dialog opens", await page.locator(".scrim .dialog").isVisible());
check("font detail offers replace and remove", await page.locator(".scrim [data-action='replace']").isVisible() && await page.locator(".scrim [data-action='remove']").isVisible());
await page.keyboard.press("Escape");
await page.waitForTimeout(350);

await page.click(".fab[data-fab-owner='chinese']");
await page.waitForTimeout(400);
check("add FAB opens the source dialog", (await page.locator(".scrim .dialog-title").textContent()) === "新增字型");
await page.fill(".scrim .field-input", "relative/path.ttf");
await page.click(".scrim [data-action='path']");
await page.waitForTimeout(200);
check("invalid paths are rejected in place", await page.locator(".scrim .field-error").isVisible());
check("dialog stays open after a validation error", await page.locator(".scrim .dialog").isVisible());
await page.keyboard.press("Escape");
await page.waitForTimeout(350);
check("add dialog dismisses", (await page.locator(".scrim").count()) === 0);

/* --------------------------------------------------------------- back nav */

await page.click("section[data-screen='chinese'] .app-bar [data-back]");
await page.waitForTimeout(700);
check("back returns to the fonts tab", await page.locator("section[data-screen='menu']").isVisible());
check("nav bar returns with the tab", (await page.getAttribute(".nav-bar", "data-visible")) === "true");

/* ------------------------------------------------------------ emoji screen */

await page.click("section[data-screen='menu'] .list-item:nth-child(3)");
await page.waitForTimeout(650);
const emoji = await page.evaluate(() => ({
  switch: document.querySelector("section[data-screen='emoji'] .switch")?.getAttribute("aria-checked"),
  source: document.querySelector("section[data-screen='emoji'] [data-source-name]")?.textContent.trim(),
  target: document.querySelector("section[data-screen='emoji'] [data-target]")?.textContent.trim(),
}));
check("emoji switch follows the active mode", emoji.switch === "true", String(emoji.switch));
check("emoji source shows the preset", emoji.source === "Classic Blobmoji", String(emoji.source));
check("emoji target line names the file", emoji.target?.includes("NotoColorEmoji.ttf"), String(emoji.target));

await page.click("section[data-screen='emoji'] [data-source]");
await page.waitForTimeout(400);
const sheet = await page.evaluate(() => ({
  open: !!document.querySelector(".scrim .sheet"),
  rows: document.querySelectorAll(".scrim .option-row").length,
  selected: document.querySelector(".scrim .option-row[aria-selected='true'] .option-label")?.textContent.trim(),
}));
check("source sheet opens", sheet.open);
check("sheet lists every preset", sheet.rows === 6, String(sheet.rows));
check("sheet marks the active preset", sheet.selected === "Classic Blobmoji", String(sheet.selected));
await page.click(".scrim .option-row[data-value='default']");
await page.waitForTimeout(300);
const emojiCommand = await page.evaluate(() => window.__commands.find((command) => command.includes("emoji-set")));
check("choosing a preset calls emoji-set", emojiCommand?.endsWith("default"), String(emojiCommand));

/* ------------------------------------------------------------- responsive */

const narrow = await openPage(browser, port, { width: 360, height: 780, locale: "en-US" });
const overflow = await narrow.evaluate(() => {
  const root = document.documentElement;
  const screens = [...document.querySelectorAll(".screen")].map((screen) => screen.scrollWidth - screen.clientWidth);
  return {
    page: root.scrollWidth - root.clientWidth,
    screens: Math.max(...screens),
    hero: document.querySelector(".hero-title")?.textContent.trim(),
    language: document.documentElement.lang,
  };
});
check("narrow viewport has no horizontal overflow", overflow.page <= 0 && overflow.screens <= 0, JSON.stringify(overflow));
check("English locale renders the localised title", overflow.hero === "Font settings" || overflow.hero === "Font Settings", String(overflow.hero));
await narrow.close();

/* ------------------------------------------------------------ dark tokens */

const dark = await openPage(browser, port, { scheme: "dark" });
const darkTheme = await dark.evaluate(() => ({
  mode: document.documentElement.dataset.theme,
  surface: getComputedStyle(document.documentElement).getPropertyValue("--md-sys-color-surface").trim(),
  body: getComputedStyle(document.body).backgroundColor,
}));
check("dark scheme applies dark surface tokens", darkTheme.mode === "dark" && darkTheme.surface.toLowerCase() === "#141317", JSON.stringify(darkTheme));
await dark.close();

const reduced = await openPage(browser, port);
await reduced.emulateMedia({ reducedMotion: "reduce" });
const reducedDuration = await reduced.evaluate(() => getComputedStyle(document.querySelector(".screen-active")).transitionDuration);
check("reduced motion shortens screen transitions", reducedDuration.split(",")[0].trim() === "0.001s", reducedDuration);
await reduced.close();

/* ------------------------------------------------------------------ done */

await browser.close();
server.close();

const failed = checks.filter((entry) => !entry.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) process.exitCode = 1;
