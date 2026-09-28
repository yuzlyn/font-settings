// Downloads the Roboto Flex woff2 subsets used by the WebUI and rewrites the
// Google Fonts CSS into a local, offline @font-face stylesheet.
import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve("webui/src/assets/fonts");
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
