/**
 * Production build for the Font Settings WebUI.
 *
 * - bundles the ES module sources (app + Material Web) into a single app.js
 * - copies the token stylesheet, the shell HTML and the offline fonts
 * - writes everything into font-settings/webroot, which is what the module and
 *   the local busybox WebUI server ship
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const workspace = path.resolve(import.meta.dirname, "..");
const srcDir = path.join(workspace, "webui", "src");
const moduleDir = path.join(workspace, "font-settings");
const outDir = path.join(moduleDir, "webroot");
const esbuildBin = path.join(workspace, ".fontsetting-build", "node_modules", "esbuild", "bin", "esbuild");

const moduleProp = fs.readFileSync(path.join(moduleDir, "module.prop"), "utf8");
const version = (moduleProp.match(/^version=(.+)$/m) || [])[1]?.trim() || "v0.0.0";

function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function build() {
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Bundle the application (Material Web included) into one module.
  //    Dependencies live in the dedicated build prefix, so expose it through
  //    NODE_PATH for esbuild's resolver.
  execFileSync(
    process.execPath,
    [
      esbuildBin,
      path.join(srcDir, "app.js"),
      "--bundle",
      "--format=esm",
      "--target=chrome100",
      "--minify",
      "--legal-comments=none",
      `--outfile=${path.join(outDir, "app.js")}`,
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_PATH: path.join(workspace, ".fontsetting-build", "node_modules"),
      },
    },
  );

  // 2. Stylesheet + shell.
  copy(path.join(srcDir, "styles.css"), path.join(outDir, "styles.css"));
  const html = fs
    .readFileSync(path.join(srcDir, "index.html"), "utf8")
    .replaceAll("__VERSION__", version.replace(/^v/, ""));
  fs.writeFileSync(path.join(outDir, "index.html"), html);

  // 3. Offline fonts: Roboto Flex subsets + Material Symbols Rounded subset.
  const fontDir = path.join(srcDir, "assets", "fonts");
  fs.mkdirSync(path.join(outDir, "assets", "fonts"), { recursive: true });
  const sheets = [];
  for (const sheet of ["roboto-flex-local.css", "material-symbols-rounded.css"]) {
    const file = path.join(fontDir, sheet);
    if (fs.existsSync(file)) sheets.push(fs.readFileSync(file, "utf8").trim());
  }
  for (const entry of fs.readdirSync(fontDir)) {
    if (entry.endsWith(".woff2")) copy(path.join(fontDir, entry), path.join(outDir, "assets", "fonts", entry));
  }
  const iconCss = fs.existsSync(path.join(fontDir, "material-symbols-rounded.css"))
    ? fs
        .readFileSync(path.join(fontDir, "material-symbols-rounded.css"), "utf8")
        .replace(/url\(https:[^)]+\)/, 'url("material-symbols-rounded.woff2")')
    : "";
  const robotoCss = fs.existsSync(path.join(fontDir, "roboto-flex-local.css"))
    ? fs.readFileSync(path.join(fontDir, "roboto-flex-local.css"), "utf8")
    : "";
  fs.writeFileSync(
    path.join(outDir, "assets", "fonts", "fonts.css"),
    `${robotoCss}\n${iconCss}\n`,
  );

  const stats = {
    version,
    app: fs.statSync(path.join(outDir, "app.js")).size,
    styles: fs.statSync(path.join(outDir, "styles.css")).size,
    html: fs.statSync(path.join(outDir, "index.html")).size,
    fonts: fs
      .readdirSync(path.join(outDir, "assets", "fonts"))
      .map((name) => `${name} ${fs.statSync(path.join(outDir, "assets", "fonts", name)).size}`),
  };
  return stats;
}

const stats = build();
console.log("production build complete:");
console.log(`  version   ${stats.version}`);
console.log(`  app.js    ${(stats.app / 1024).toFixed(1)} KiB`);
console.log(`  styles    ${(stats.styles / 1024).toFixed(1)} KiB`);
console.log(`  index     ${stats.html} bytes`);
for (const font of stats.fonts) console.log(`  font      ${font}`);
