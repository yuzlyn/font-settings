/**
 * Shared harness for the headless WebUI checks: a static server over the built
 * `font-settings/webroot`, a mock KernelSU bridge and the status fixture.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "../../.fontsetting-build/node_modules/playwright-core/index.mjs";

export const workspace = path.resolve(import.meta.dirname, "..", "..");
export const webroot = path.join(workspace, "font-settings", "webroot");
export const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ttf": "font/ttf",
};

/** Status fixture: two Chinese fonts (one variable), one Latin font, Blobmoji. */
export const STATUS = [
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

export function createServer() {
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

/**
 * Mock bridge installed before the app bundle runs. It mirrors all three
 * KernelSU call signatures and keeps every command in `window.__commands`
 * so the tests can assert what the UI asked the module to do.
 */
export function bridgeMock() {
  // The function is serialised into the page, so it receives the fixture as an
  // argument instead of closing over module scope.
  return ({ status }) => {
    window.__commands = [];
    window.ksu = {
      exec(command, first, second) {
        window.__commands.push(command);
        let output = "ok";
        if (command.includes("modules_update")) output = "/data/adb/modules/font-settings";
        if (command.includes("theme_customization_overlay_packages")) output = "{}";
        if (command.includes("module.prop")) output = "version=v2.5.1";
        if (command.endsWith(" status")) output = status;
        if (command.includes("<family")) output = '<family name="sans-serif" lang="zh-Hans">';
        if (command.includes("fallback-set")) output = "ok=fallback";
        if (command.includes("weight-set")) output = "ok=weight";
        if (command.includes("western-size")) output = "ok=western-size";
        if (command.includes("emoji-set")) output = "ok=emoji";
        if (command.includes("reorder")) output = "ok=reorder";
        if (command.includes("remove")) output = "ok=remove";

        const callbackName =
          typeof second === "string"
            ? second
            : typeof first === "string" && !first.startsWith("{")
              ? first
              : null;
        if (callbackName) {
          setTimeout(() => window[callbackName]?.(0, output, ""), 0);
          return undefined;
        }
        if (typeof first === "string" && first.startsWith("{")) return output;
        return callbackName ? undefined : output;
      },
    };
  };
}

export async function launch() {
  return chromium.launch({ executablePath: EDGE, headless: true });
}

export async function openPage(browser, port, { scheme = "light", locale = "zh-TW", width = 412, height = 892 } = {}) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: scheme,
    locale,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.__errors = errors;

  await page.addInitScript(bridgeMock(), { status: STATUS });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForSelector("section[data-screen='menu'] .list-item");
  // The offline fonts are large data URIs; the icon boxes only measure 1em
  // once the symbol font is parsed, so wait for it before asserting layout.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  return page;
}
