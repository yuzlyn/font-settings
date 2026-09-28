/**
 * Verifies the built WebUI as served by the device's own busybox httpd
 * (the browser path). Requires `adb forward tcp:7131 tcp:7131` and a running
 * server; the bridge is mocked so no root exec reaches the device.
 *   node webui/tests/device-check.mjs [http://127.0.0.1:7131]
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "../../.fontsetting-build/node_modules/playwright-core/index.mjs";

const baseUrl = process.argv[2] || "http://127.0.0.1:7131";
const workspace = path.resolve(import.meta.dirname, "..", "..");
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const fontBase64 = fs.readFileSync(path.join(workspace, "FontSettingWestern-current.ttf")).toString("base64");

const STATUS = [
  "module=ok",
  "chinese_font_count=1",
  "chinese_font_1=FontSettingChinese.ttf",
  "chinese_font_1_size=54604100",
  "chinese_font_1_variable=1",
  "chinese_font_1_name_b64=UGluZ1JvdW5kU0NWRi50dGY=",
  "western_font_count=0",
  "emoji_mode=blobmoji",
  "emoji_target=NotoColorEmoji.ttf",
  "emoji_custom_size=0",
  "emoji_builtin_ios=1",
  "emoji_builtin_google=1",
  "emoji_builtin_blobmoji=1",
  "emoji_builtin_facebook=1",
  "western_targets=8",
  "chinese_targets=10",
  "western_scale=90",
  "chinese_weight=400",
  "western_weight=400",
  "fallback=1",
  "pending_reboot=0",
  "conflicts=",
].join("\n");

const browser = await chromium.launch({ executablePath: edge, headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 892 }, locale: "zh-TW" });
const errors = [];
const failedRequests = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("requestfailed", (request) => failedRequests.push(`${request.url()} ${request.failure()?.errorText}`));
page.on("response", (response) => {
  if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
});

await page.addInitScript(({ base64, status }) => {
  window.ksu = {
    exec(command, options, callbackName) {
      let output = "ok";
      if (command.includes("modules_update")) output = "/data/adb/modules/font-settings";
      if (command.includes("module.prop")) output = "version=v2.4.0";
      if (command.endsWith(" status")) output = status;
      if (command.includes("<family")) output = '<family name="sans-serif" lang="zh-Hans">\n<family name="NotoSansTC" lang="zh-Hant">';
      if (command.startsWith("base64 ")) output = base64;
      setTimeout(() => window[callbackName](0, output, ""), 0);
    },
  };
}, { base64: fontBase64, status: STATUS });

await page.goto(`${baseUrl}/index.html`, { waitUntil: "networkidle" });
await page.waitForSelector("section[data-screen='menu'] md-list-item", { timeout: 20000 });
await page.waitForTimeout(1200);

const report = await page.evaluate(() => ({
  title: document.querySelector(".screen-title")?.textContent.trim(),
  rows: document.querySelectorAll("section[data-screen='menu'] md-list-item").length,
  robotoFlex: document.fonts.check('16px "Roboto Flex"'),
  symbols: document.fonts.check('24px "Material Symbols Rounded"'),
  iconGlyph: (() => {
    const icon = document.querySelector("md-icon");
    const rect = icon.getBoundingClientRect();
    return { text: icon.textContent.trim(), width: Math.round(rect.width) };
  })(),
  fabRadius: (() => {
    const part = document.querySelector(".screen-stack md-fab")?.shadowRoot?.querySelector(".fab");
    return part ? parseFloat(getComputedStyle(part).borderTopLeftRadius) : 0;
  })(),
  // The menu has no FAB at all; secondary screens put theirs in the shared layer.
  menuFabs: document.querySelectorAll(".screen-stack md-fab, [data-fab-layer] md-fab").length,
  fabLayer: Boolean(document.querySelector("[data-fab-layer]")),
  theme: document.documentElement.dataset.theme,
  overflowX: document.documentElement.scrollWidth - window.innerWidth,
}));

console.log("device-served UI:", JSON.stringify(report, null, 2));
console.log("page errors:", errors.length ? errors.join("; ") : "none");
console.log("failed requests:", failedRequests.length ? failedRequests.join("; ") : "none");

const ok =
  report.title === "字型設定" &&
  report.rows === 10 &&
  report.robotoFlex &&
  report.symbols &&
  report.iconGlyph.width <= 40 &&
  report.menuFabs === 0 &&
  report.fabLayer &&
  report.overflowX <= 0 &&
  errors.length === 0;

await browser.close();
console.log(ok ? "device check: PASS" : "device check: FAIL");
process.exit(ok ? 0 : 1);
