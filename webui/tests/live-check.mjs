/**
 * End-to-end check against the device's live WebUI server: the page runs the
 * real root bridge (no ksu mock), so status and font chain data come from the
 * phone, and it asserts that no font bytes cross the bridge (the freeze
 * regression).
 *   node webui/tests/live-check.mjs [http://127.0.0.1:7125]
 */

import { chromium } from "../../.fontsetting-build/node_modules/playwright-core/index.mjs";

const baseUrl = process.argv[2] || "http://127.0.0.1:7125";
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const browser = await chromium.launch({ executablePath: edge, headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 892 }, locale: "zh-TW" });
const errors = [];
const bridgeCommands = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (request.url().includes("/cgi-bin/exec")) bridgeCommands.push(request.postData() || "");
});

await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("section[data-screen='menu'] .list-item", { timeout: 20000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);

// The status is read on the About tab; wait until the module answered.
await page.click(".nav-item[data-nav='about']");
await page.waitForFunction(
  () => {
    const text = document.querySelector("section[data-screen='about'] .list-supporting")?.textContent || "";
    return text.includes("已適配") || text.includes("Adapted");
  },
  { timeout: 20000 },
);
await page.waitForTimeout(400);

const about = await page.evaluate(() => ({
  status: document.querySelector("section[data-screen='about'] .list-supporting")?.textContent.trim(),
}));
console.log("about (real device data):", JSON.stringify(about, null, 2));

await page.click(".nav-item[data-nav='menu']");
await page.waitForTimeout(500);
const menu = await page.evaluate(() => {
  const icon = document.querySelector("section[data-screen='menu'] .list-leading .icon");
  return {
    hero: document.querySelector(".hero-title")?.textContent.trim(),
    chinese: document.querySelector("[data-chinese]")?.textContent.trim(),
    western: document.querySelector("[data-western]")?.textContent.trim(),
    count: document.querySelector("[data-count]")?.textContent.trim(),
    bridgeChip: document.querySelector("[data-bridge]")?.textContent.trim(),
    iconFont: document.fonts.check('24px "Material Symbols Rounded"'),
    iconWidth: Math.round(icon.getBoundingClientRect().width),
    textFont: document.fonts.check('16px "Roboto Flex"'),
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
  };
});
console.log("menu (real device data):", JSON.stringify(menu, null, 2));

const started = Date.now();
await page.click("section[data-screen='menu'] .list-item:nth-child(1)");
await page.waitForTimeout(1500);
const elapsed = Date.now() - started;

const chinese = await page.evaluate(() => {
  const screen = document.querySelector("section[data-screen='chinese']");
  return {
    title: screen?.querySelector(".app-bar-title")?.textContent.trim(),
    hero: screen?.querySelector(".hero-title")?.textContent.trim(),
    rows: [...(screen?.querySelectorAll(".chain-row") ?? [])].map((row) => ({
      name: row.querySelector(".chain-name")?.textContent.trim(),
      meta: row.querySelector(".chain-meta")?.textContent.trim(),
    })),
    weight: screen?.querySelector(".slider")?.value ?? null,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
  };
});
console.log("chinese screen (real device data):", JSON.stringify(chinese, null, 2));

// The back arrow must return to the menu (secondary screens used to be dead
// ends when the app restored them as the root screen).
const backToMenu = await page.evaluate(async () => {
  document.querySelector("section[data-screen='chinese'] [data-back]").click();
  await new Promise((resolve) => setTimeout(resolve, 800));
  return {
    menuVisible: document.querySelector("section[data-screen='menu']")?.hidden === false,
    hash: location.hash,
  };
});
console.log("back arrow:", JSON.stringify(backToMenu));

const byteCommands = bridgeCommands.filter((command) => command.startsWith("base64 "));
console.log("bridge commands:", bridgeCommands.length, "| font byte transfers:", byteCommands.length);
console.log("screen render time:", `${elapsed} ms`);
console.log("page errors:", errors.length ? errors.join("; ") : "none");

const ok =
  /已適配 \d+ 項漢字、\d+ 項拉丁文/.test(about.status || "") &&
  menu.hero === "字型設定" &&
  menu.iconFont === true &&
  menu.textFont === true &&
  menu.iconWidth > 16 &&
  menu.iconWidth <= 32 &&
  /字型/.test(menu.count || "") &&
  Boolean(menu.bridgeChip) &&
  chinese.title === "漢字字型" &&
  chinese.rows.length > 0 &&
  chinese.rows.every((row) => /^#\d+ · [\d.]+ (B|KB|MB) · (可變字型|靜態字型)$/.test(row.meta)) &&
  (chinese.weight === null || Number(chinese.weight) >= 100) &&
  chinese.overflowX <= 0 &&
  menu.overflowX <= 0 &&
  backToMenu.menuVisible === true &&
  byteCommands.length === 0 &&
  elapsed < 4000 &&
  errors.length === 0;

await browser.close();
console.log(ok ? "live check: PASS" : "live check: FAIL");
process.exit(ok ? 0 : 1);
