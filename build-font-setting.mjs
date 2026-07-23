import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const workspace = process.cwd();
const moduleDir = path.join(workspace, "FontSetting_ColorOS16");
const sourceXml = path.join(workspace, "PixelFonts_ColorOS16", "system", "etc", "fonts.xml");
const mduiDir = path.join(workspace, ".fontsetting-build", "node_modules", "mdui");
const materialColorDir = path.join(workspace, ".fontsetting-build", "node_modules", "@material", "material-color-utilities");
const esbuildBin = path.join(workspace, ".fontsetting-build", "node_modules", "esbuild", "bin", "esbuild");
const sourceFonts = path.join(workspace, "TPTQ_Ping_Round_SC_Caesium_VF", "system", "fonts");
const weights = [100, 200, 300, 400, 500, 600, 700, 800, 900];

function ensureFile(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing build input: ${file}`);
}

function westernFamily(variable) {
  const fonts = weights.map((weight) => {
    if (!variable) {
      return `        <font weight="${weight}" style="normal">FontSettingWestern.ttf</font>`;
    }
    return [
      `        <font weight="${weight}" style="normal">FontSettingWestern.ttf`,
      `            <axis tag="wght" stylevalue="${weight}"/>`,
      "        </font>",
    ].join("\n");
  });
  return `    <family name="sans-serif">\n${fonts.join("\n")}\n    </family>`;
}

function normalizeCustomFontBlocks(xml, westernVariable, chineseVariable) {
  return xml.replace(/<font\b[\s\S]*?<\/font>/g, (block) => {
    let variable;
    if (block.includes("FontSettingWestern.ttf")) variable = westernVariable;
    if (block.includes("FontSettingChinese.ttf")) variable = chineseVariable;
    if (variable === undefined) return block;

    let result = block.replace(/\s+postScriptName="[^"]*"/g, "");
    result = result.replace(/\s*<axis\s+tag="(?!wght")[^"]+"[^>]*\/>/g, "");
    if (!variable) result = result.replace(/\s*<axis\b[^>]*\/>/g, "");
    return result;
  });
}

function buildConfig(source, westernVariable, chineseVariable) {
  let xml = source.replace(
    /    <family name="sans-serif">[\s\S]*?    <\/family>/,
    westernFamily(westernVariable),
  );

  xml = xml
    .replaceAll("SysSans-En-Regular.ttf", "FontSettingWestern.ttf")
    .replaceAll("OPSans-En-Regular.ttf", "FontSettingWestern.ttf")
    .replaceAll("SysSans-Hans-Regular.ttf", "FontSettingChinese.ttf")
    .replaceAll("SysSans-Hant-Regular.ttf", "FontSettingChinese.ttf");

  return normalizeCustomFontBlocks(xml, westernVariable, chineseVariable);
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
  sourceXml,
  path.join(mduiDir, "mdui.css"),
  path.join(mduiDir, "mdui.global.js"),
  path.join(mduiDir, "LICENSE"),
  path.join(materialColorDir, "LICENSE"),
  esbuildBin,
  path.join(sourceFonts, "PingRoundSCVF.ttf"),
  path.join(sourceFonts, "CaesiumVF-Upright.ttf"),
];
inputs.forEach(ensureFile);

const xml = fs.readFileSync(sourceXml, "utf8");
for (const westernVariable of [0, 1]) {
  for (const chineseVariable of [0, 1]) {
    const output = buildConfig(xml, Boolean(westernVariable), Boolean(chineseVariable));
    fs.writeFileSync(
      path.join(moduleDir, "config", `fonts-w${westernVariable}-c${chineseVariable}.xml`),
      output,
      "utf8",
    );
  }
}

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

const activeConfig = path.join(moduleDir, "config", "fonts-w1-c1.xml");
fs.copyFileSync(activeConfig, path.join(moduleDir, "system", "etc", "fonts.xml"));
fs.copyFileSync(activeConfig, path.join(moduleDir, "system", "system_ext", "etc", "fonts_base.xml"));
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

console.log("Generated font configurations, MaterialKolor palette, and offline assets.");
