/**
 * End-to-end check against the device's live WebUI server: the page runs the
 * real root bridge (no ksu mock), so the status and font chain data come from
 * the phone, and it asserts that no font bytes cross the bridge (the freeze
 * regression).
 *   node webui/tests/live-check.mjs [http://127.0.0.1:7125]
 */

import path from "node:path";
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
await page.waitForSelector("section[data-screen='menu'] md-list-item", { timeout: 20000 });
await page.waitForFunction(
  () => {
    const rows = [...document.querySelectorAll("section[data-screen='menu'] md-list-item")];
    const text = rows[5]?.querySelector('[slot="supporting-text"]')?.textContent || "";
    return text.includes("已適配") || text.includes("Adapted");
  },
  { timeout: 20000 },
);
await page.waitForTimeout(500);

const menu = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("section[data-screen='menu'] md-list-item")];
  const chip = document.querySelector(".status-chip");
  const icon = document.querySelector("md-icon");
  const iconRect = icon.getBoundingClientRect();
  return {
    statusText: rows[5]?.querySelector('[slot="supporting-text"]')?.textContent.trim(),
    fallbackText: rows[4]?.querySelector('[slot="supporting-text"]')?.textContent.trim(),
    chip: chip?.textContent.trim(),
    chipState: chip?.dataset.state,
    iconFont: document.fonts.check('24px "Material Symbols Rounded"'),
    iconWidth: Math.round(iconRect.width),
    textFont: document.fonts.check('16px "Roboto Flex"'),
  };
});
console.log("menu (real device data):", JSON.stringify(menu, null, 2));

const started = Date.now();
await page.evaluate(() => document.querySelectorAll("section[data-screen='menu'] md-list-item")[1].click());
await page.waitForTimeout(1500);
const elapsed = Date.now() - started;
const chinese = await page.evaluate(() => {
  const screen = document.querySelector("section[data-screen='chinese']");
  return {
    title: screen?.querySelector(".screen-title")?.textContent.trim(),
    rows: [...(screen?.querySelectorAll(".chain-row") ?? [])].map((row) => ({
      name: row.querySelector(".chain-name")?.textContent.trim(),
      meta: row.querySelector(".chain-meta")?.textContent.trim(),
    })),
    weightSlider: String(screen?.querySelector("md-slider")?.value),
    previewOptions: screen?.querySelectorAll(".preview-panel md-select-option").length,
    caption: screen?.querySelector(".preview-caption")?.textContent.trim(),
  };
});
console.log("chinese screen (real device data):", JSON.stringify(chinese, null, 2));
const byteCommands = bridgeCommands.filter((command) => command.startsWith("base64 "));
console.log("bridge commands:", bridgeCommands.length, "| font byte transfers:", byteCommands.length);
console.log("screen render time:", `${elapsed} ms`);
console.log("page errors:", errors.length ? errors.join("; ") : "none");

const ok =
  menu.iconFont === true &&
  menu.textFont === true &&
  menu.iconWidth === 24 &&
  /已適配 \d+ 項西文、\d+ 項中文字族/.test(menu.statusText || "") &&
  menu.chipState === "ok" &&
  chinese.title === "中文字型" &&
  chinese.rows.length > 0 &&
  chinese.rows.every((row) => /^#\d+ · [\d.]+ (B|KB|MB) · (可變字型|靜態字型)$/.test(row.meta)) &&
  chinese.previewOptions === chinese.rows.length + 1 &&
  Boolean(chinese.caption) &&
  byteCommands.length === 0 &&
  elapsed < 4000 &&
  errors.length === 0;

await browser.close();
console.log(ok ? "live check: PASS" : "live check: FAIL");
process.exit(ok ? 0 : 1);

