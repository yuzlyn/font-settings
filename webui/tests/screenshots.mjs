/**
 * Renders the built WebUI against a mocked bridge and writes screenshots for
 * design review (light + dark, every screen).
 *   node webui/tests/screenshots.mjs [outputDir]
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "../../.fontsetting-build/node_modules/playwright-core/index.mjs";

const workspace = path.resolve(import.meta.dirname, "..", "..");
const webroot = path.join(workspace, "font-settings", "webroot");
const outDir = path.resolve(process.argv[2] || path.join(workspace, "webui", ".screenshots"));
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
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
  "western_font_count=1",
  "western_font_1=FontSettingWestern.ttf",
  "western_font_1_size=344296",
  "western_font_1_variable=0",
  "western_font_1_name_b64=Q2Flc2l1bVZGLVVwcmlnaHQudHRm",
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
  "chinese_weight=650",
  "western_weight=400",
  "fallback=1",
  "pending_reboot=1",
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

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg" };

function serve() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const filePath = path.join(webroot, url.pathname === "/" ? "/index.html" : url.pathname);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return response.writeHead(404).end("nf");
    response.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

fs.mkdirSync(outDir, { recursive: true });
const { server, port } = await serve();
const browser = await chromium.launch({ executablePath: edge, headless: true });

for (const scheme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width: 412, height: 892 }, locale: "zh-TW", colorScheme: scheme, deviceScaleFactor: 2 });
  await page.addInitScript(
    ({ fontBase64: base64, status, families }) => {
      window.ksu = {
        exec(command, options, callbackName) {
          let output = "ok";
          if (command.includes("modules_update")) output = "/data/adb/modules/font-settings";
          if (command.includes("module.prop")) output = "version=v2.3.7";
          if (command.endsWith(" status")) output = status;
          if (command.includes("<family")) output = families;
          if (command.startsWith("base64 ")) output = base64;
          setTimeout(() => window[callbackName](0, output, ""), 0);
        },
      };
    },
    { fontBase64, status: STATUS, families: FAMILIES },
  );
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForSelector("section[data-screen='menu'] md-list-item");
  await page.waitForTimeout(1200);

  const shoot = async (name) => {
    await page.screenshot({ path: path.join(outDir, `${scheme}-${name}.png`) });
    console.log(`wrote ${scheme}-${name}.png`);
  };

  await shoot("1-menu");

  await page.evaluate(() => document.querySelectorAll("section[data-screen='menu'] md-list-item")[1].click());
  await page.waitForTimeout(900);
  await shoot("2-chinese");

  await page.goBack();
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelectorAll("section[data-screen='menu'] md-list-item")[2].click());
  await page.waitForTimeout(900);
  await shoot("3-latin");

  await page.goBack();
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelectorAll("section[data-screen='menu'] md-list-item")[3].click());
  await page.waitForTimeout(900);
  await shoot("4-emoji");

  await page.goBack();
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelectorAll("section[data-screen='menu'] md-list-item")[4].click());
  await page.waitForTimeout(900);
  await shoot("5-fallback");

  await page.goBack();
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelectorAll("section[data-screen='menu'] md-list-item")[5].click());
  await page.waitForTimeout(700);
  await shoot("6-status-dialog");

  await page.close();
}

await browser.close();
server.close();
console.log(`screenshots in ${outDir}`);
