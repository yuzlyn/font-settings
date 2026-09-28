/**
 * End-to-end check against the device's live WebUI server: the page runs the
 * real HTTP bridge (no ksu mock), so the status/chain data comes from the
 * phone. Font byte transfers are aborted to keep the run quick.
 *   node webui/tests/live-check.mjs [http://127.0.0.1:7125]
 */

import path from "node:path";
import { chromium } from "../../.fontsetting-build/node_modules/playwright-core/index.mjs";

const baseUrl = process.argv[2] || "http://127.0.0.1:7125";
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const browser = await chromium.launch({ executablePath: edge, headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 892 }, locale: "zh-TW" });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

// Skip the (potentially huge) font byte transfers used by the preview panel.
await page.route("**/cgi-bin/exec", async (route) => {
  const body = route.request().postData() || "";
  if (body.startsWith("base64 ")) {
    await route.fulfill({ status: 200, contentType: "text/plain", body: "1\nskipped for the live check\n" });
    return;
  }
  await route.continue();
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
  return {
    statusText: rows[5]?.querySelector('[slot="supporting-text"]')?.textContent.trim(),
    fallbackText: rows[4]?.querySelector('[slot="supporting-text"]')?.textContent.trim(),
  };
});
console.log("menu (real device data):", JSON.stringify(menu, null, 2));

await page.evaluate(() => document.querySelectorAll("section[data-screen='menu'] md-list-item")[1].click());
await page.waitForTimeout(1500);
const chinese = await page.evaluate(() => {
  const screen = document.querySelector("section[data-screen='chinese']");
  return {
    title: screen?.querySelector(".screen-title")?.textContent.trim(),
    rows: [...(screen?.querySelectorAll(".chain-row") ?? [])].map((row) => ({
      name: row.querySelector(".chain-name")?.textContent.trim(),
      meta: row.querySelector(".chain-meta")?.textContent.trim(),
    })),
    weightSlider: screen?.querySelector("md-slider")?.value,
    previewOptions: screen?.querySelectorAll(".preview-panel md-select-option").length,
  };
});
console.log("chinese screen (real device data):", JSON.stringify(chinese, null, 2));
console.log("page errors:", errors.length ? errors.join("; ") : "none");

const ok =
  /已適配 \d+ 項西文、\d+ 項中文字族/.test(menu.statusText || "") &&
  chinese.title === "中文字型" &&
  chinese.rows.length > 0 &&
  chinese.rows.every((row) => /^#\d+ · [\d.]+ (B|KB|MB) · (可變字型|靜態字型)$/.test(row.meta)) &&
  chinese.previewOptions >= chinese.rows.length &&
  errors.length === 0;

await browser.close();
console.log(ok ? "live check: PASS" : "live check: FAIL");
process.exit(ok ? 0 : 1);
