/**
 * Renders the built WebUI against the mock bridge and writes screenshots for
 * design review (light + dark, every screen).
 *   node webui/tests/screenshots.mjs [outputDir]
 */

import fs from "node:fs";
import path from "node:path";
import { createServer, launch, openPage, workspace } from "./harness.mjs";

const outDir = path.resolve(process.argv[2] || path.join(workspace, "webui", ".screenshots"));
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await createServer();
const browser = await launch();

for (const scheme of ["light", "dark"]) {
  const page = await openPage(browser, port, { scheme });
  const shoot = async (name) => {
    await page.screenshot({ path: path.join(outDir, `${scheme}-${name}.png`) });
    console.log(`wrote ${scheme}-${name}.png`);
  };

  await shoot("1-menu");

  await page.evaluate(() => {
    document.querySelector("section[data-screen='menu']").scrollTop = 320;
  });
  await page.waitForTimeout(400);
  await shoot("2-menu-scrolled");

  await page.evaluate(() => {
    document.querySelector("section[data-screen='menu']").scrollTop = 0;
  });
  await page.click("section[data-screen='menu'] .list-item:nth-child(1)");
  await page.waitForTimeout(700);
  await shoot("3-chinese");

  await page.click("section[data-screen='chinese'] .app-bar [data-back]");
  await page.waitForTimeout(700);
  await page.click("section[data-screen='menu'] .list-item:nth-child(2)");
  await page.waitForTimeout(700);
  await shoot("4-latin");

  await page.click("section[data-screen='western'] .app-bar [data-back]");
  await page.waitForTimeout(700);
  await page.click("section[data-screen='menu'] .list-item:nth-child(3)");
  await page.waitForTimeout(700);
  await shoot("5-emoji");

  await page.click("section[data-screen='emoji'] [data-source]");
  await page.waitForTimeout(500);
  await shoot("6-emoji-sheet");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(350);
  await page.click("section[data-screen='emoji'] .app-bar [data-back]");
  await page.waitForTimeout(700);

  await page.click(".nav-item[data-nav='readme']");
  await page.waitForTimeout(700);
  await shoot("7-readme");

  await page.click(".nav-item[data-nav='about']");
  await page.waitForTimeout(700);
  await shoot("8-about");

  await page.click("section[data-screen='about'] .list-item:nth-child(1)");
  await page.waitForTimeout(500);
  await shoot("9-status-dialog");

  await page.close();
}

await browser.close();
server.close();
console.log(`screenshots in ${outDir}`);
