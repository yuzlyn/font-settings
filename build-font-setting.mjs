import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const workspace = process.cwd();
const moduleDir = path.join(workspace, "FontSetting_ColorOS16");
const mduiDir = path.join(workspace, ".fontsetting-build", "node_modules", "mdui");
const materialColorDir = path.join(workspace, ".fontsetting-build", "node_modules", "@material", "material-color-utilities");
const esbuildBin = path.join(workspace, ".fontsetting-build", "node_modules", "esbuild", "bin", "esbuild");
const sourceFonts = path.join(workspace, "TPTQ_Ping_Round_SC_Caesium_VF", "system", "fonts");

function ensureFile(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing build input: ${file}`);
}

function hasTable(file, expectedTag) {
  const buffer = fs.readFileSync(file);
  const tableCount = buffer.readUInt16BE(4);
  for (let index = 0; index < tableCount; index += 1) {
    const offset = 12 + index * 16;
    if (buffer.toString("ascii", offset, offset + 4) === expectedTag) return true;
  }
  return false;
}

const inputs = [
  path.join(mduiDir, "mdui.css"),
  path.join(mduiDir, "mdui.global.js"),
  path.join(mduiDir, "LICENSE"),
  path.join(materialColorDir, "LICENSE"),
  esbuildBin,
  path.join(sourceFonts, "PingRoundSCVF.ttf"),
  path.join(sourceFonts, "CaesiumVF-Upright.ttf"),
];
inputs.forEach(ensureFile);

const chineseSource = path.join(sourceFonts, "PingRoundSCVF.ttf");
const westernSource = path.join(sourceFonts, "CaesiumVF-Upright.ttf");
if (!hasTable(chineseSource, "fvar") || !hasTable(westernSource, "fvar")) {
  throw new Error("Bundled default fonts must contain an fvar table");
}

fs.copyFileSync(chineseSource, path.join(moduleDir, "system", "fonts", "FontSettingChinese.ttf"));
fs.copyFileSync(westernSource, path.join(moduleDir, "system", "fonts", "FontSettingWestern.ttf"));
fs.writeFileSync(path.join(moduleDir, "data", "chinese.name.b64"), Buffer.from("PingRoundSCVF.ttf").toString("base64") + "\n");
fs.writeFileSync(path.join(moduleDir, "data", "western.name.b64"), Buffer.from("CaesiumVF-Upright.ttf").toString("base64") + "\n");
fs.writeFileSync(path.join(moduleDir, "data", "chinese.variable"), "1\n");
fs.writeFileSync(path.join(moduleDir, "data", "western.variable"), "1\n");

fs.copyFileSync(path.join(mduiDir, "mdui.css"), path.join(moduleDir, "webroot", "vendor", "mdui.css"));
fs.copyFileSync(path.join(mduiDir, "mdui.global.js"), path.join(moduleDir, "webroot", "vendor", "mdui.global.js"));
fs.copyFileSync(path.join(mduiDir, "LICENSE"), path.join(moduleDir, "webroot", "vendor", "MDUI-LICENSE.txt"));
fs.copyFileSync(
  path.join(materialColorDir, "LICENSE"),
  path.join(moduleDir, "webroot", "vendor", "MaterialColorUtilities-LICENSE.txt"),
);
execFileSync(
  process.execPath,
  [
    esbuildBin,
    path.join(workspace, "material-kolor-entry.js"),
    "--bundle",
    "--format=iife",
    "--global-name=MaterialKolor",
    "--minify",
    `--outfile=${path.join(moduleDir, "webroot", "vendor", "material-kolor.js")}`,
  ],
  { stdio: "inherit" },
);

console.log("Generated bundled fonts, MaterialKolor palette, and offline assets.");
