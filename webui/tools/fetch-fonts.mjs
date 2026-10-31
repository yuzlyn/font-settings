// Regenerates the offline font assets used by the WebUI.
//
//   node webui/tools/fetch-fonts.mjs          # Roboto Flex latin / latin-ext
//   node webui/tools/fetch-fonts.mjs --icons  # Material Symbols Rounded subset
//
// The icon subset must contain every ligature name the UI renders, otherwise a
// missing name falls back to raw text inside the icon box. Update ICON_NAMES
// whenever a screen starts using a new icon.
import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve(import.meta.dirname, "..", "src", "assets", "fonts");
const ICON_NAMES = [
  "account_circle",
  "add",
  "arrow_back",
  "arrow_drop_down",
  "autorenew",
  "bolt",
  "call_split",
  "check",
  "chevron_right",
  "drag_indicator",
  "favorite",
  "folder_open",
  "forum",
  "group_add",
  "info",
  "language",
  "logout",
  "menu_book",
  "monitor_heart",
  "mood",
  "more_vert",
  "power_settings_new",
  "schedule",
  "text_fields",
  "translate",
  "upload_file",
  "warning",
].sort();

async function fetchRobotoFlex() {
  const css = fs.readFileSync(path.join(outDir, "roboto-flex.css"), "utf8");
  const blocks = css.split("@font-face").slice(1);
  const wanted = new Set(["latin", "latin-ext"]);
  const faces = [];

  for (const block of blocks) {
    const label = (css.slice(0, css.indexOf(block)).match(/\/\* ([a-z-]+) \*\/\s*$/m) || [])[1];
    const subset = (block.match(/\/\* ([a-z-]+) \*\//) || [])[1] || label;
    const url = (block.match(/url\((https:[^)]+)\)/) || [])[1];
    const range = (block.match(/unicode-range: ([^;]+);/) || [])[1];
    if (!url || !subset || !wanted.has(subset)) continue;
    const file = `roboto-flex-${subset}.woff2`;
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Chrome/125" } });
    if (!response.ok) throw new Error(`download failed ${subset}: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(path.join(outDir, file), bytes);
    faces.push({ subset, file, range, bytes: bytes.length });
    console.log(`${subset}: ${file} (${bytes.length} bytes)`);
  }

  const sheet = `/* Roboto Flex (variable: opsz 8-144, wght 100-1000) - offline subsets */
${faces
  .map(
    (face) => `@font-face {
  font-family: "Roboto Flex";
  font-style: normal;
  font-weight: 100 1000;
  font-stretch: 100%;
  font-display: swap;
  src: url("${face.file}") format("woff2");
  unicode-range: ${face.range};
}`,
  )
  .join("\n")}
`;
  fs.writeFileSync(path.join(outDir, "roboto-flex-local.css"), sheet);
  console.log("wrote roboto-flex-local.css");
}

async function fetchSymbols() {
  const family = "Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200";
  const url = `https://fonts.googleapis.com/css2?family=${family}&icon_names=${ICON_NAMES.join(",")}&display=block`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Chrome/125" } });
  if (!response.ok) throw new Error(`icon css failed: ${response.status}`);
  const css = await response.text();
  const fontUrl = (css.match(/url\((https:[^)]+)\)/) || [])[1];
  if (!fontUrl) throw new Error("icon font url missing from the stylesheet");

  const font = await fetch(fontUrl, { headers: { "User-Agent": "Mozilla/5.0 Chrome/125" } });
  if (!font.ok) throw new Error(`icon download failed: ${font.status}`);
  const bytes = Buffer.from(await font.arrayBuffer());
  fs.writeFileSync(path.join(outDir, "material-symbols-rounded.woff2"), bytes);

  const sheet = `/* Material Symbols Rounded - offline subset (Google Fonts icon_names API).
   Regenerate with node webui/tools/fetch-fonts.mjs --icons.

   Icons: ${ICON_NAMES.join(" ")} */

@font-face {
  font-family: 'Material Symbols Rounded';
  font-style: normal;
  font-weight: 100 700;
  font-display: block;
  src: url("${fontUrl}") format('woff2');
}
`;
  fs.writeFileSync(path.join(outDir, "material-symbols-rounded.css"), sheet);
  console.log(`icons: material-symbols-rounded.woff2 (${bytes.length} bytes, ${ICON_NAMES.length} names)`);
}

if (process.argv.includes("--icons")) await fetchSymbols();
else await fetchRobotoFlex();
