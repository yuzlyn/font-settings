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
  //    Everything is inlined as data: URIs so the icons and text render in any
  //    host (KernelSU manager, KsuWebUI, MMRL, plain browser) regardless of how
  //    it maps MIME types for .woff2 - unknown extensions there fall back to
  //    text/plain, which kills font loading in some WebViews.
  const fontDir = path.join(srcDir, "assets", "fonts");
  const fontOutDir = path.join(outDir, "assets", "fonts");
  fs.rmSync(fontOutDir, { recursive: true, force: true });
  fs.mkdirSync(fontOutDir, { recursive: true });

  const inline = (css, fileNames) => {
    let output = css;
    for (const name of fileNames) {
      const file = path.join(fontDir, name);
      if (!fs.existsSync(file)) continue;
      const base64 = fs.readFileSync(file).toString("base64");
      output = output.replaceAll(`url("${name}")`, `url("data:font/woff2;base64,${base64}")`);
      output = output.replaceAll(`url(${name})`, `url("data:font/woff2;base64,${base64}")`);
    }
    return output;
  };

  const robotoCss = fs.existsSync(path.join(fontDir, "roboto-flex-local.css"))
    ? inline(fs.readFileSync(path.join(fontDir, "roboto-flex-local.css"), "utf8"), [
        "roboto-flex-latin.woff2",
        "roboto-flex-latin-ext.woff2",
      ])
    : "";
  const iconCss = fs.existsSync(path.join(fontDir, "material-symbols-rounded.css"))
    ? inline(
        fs.readFileSync(path.join(fontDir, "material-symbols-rounded.css"), "utf8").replace(
          /url\(https:[^)]+\)/,
          'url("material-symbols-rounded.woff2")',
        ),
        ["material-symbols-rounded.woff2"],
      )
    : "";
  const fontsCss = `${robotoCss.trim()}\n${iconCss.trim()}\n`;
  fs.writeFileSync(path.join(fontOutDir, "fonts.css"), fontsCss);
  // Keep a copy of the raw files for reference/debugging (not referenced by CSS).
  for (const entry of fs.readdirSync(fontDir)) {
    if (entry.endsWith(".woff2")) copy(path.join(fontDir, entry), path.join(fontOutDir, entry));
  }

  const stats = {
    version,
    app: fs.statSync(path.join(outDir, "app.js")).size,
    styles: fs.statSync(path.join(outDir, "styles.css")).size,
    html: fs.statSync(path.join(outDir, "index.html")).size,
    fontsCss: fs.statSync(path.join(fontOutDir, "fonts.css")).size,
  };
  return stats;
}

const stats = build();
console.log("production build complete:");
console.log(`  version   ${stats.version}`);
console.log(`  app.js    ${(stats.app / 1024).toFixed(1)} KiB`);
console.log(`  styles    ${(stats.styles / 1024).toFixed(1)} KiB`);
console.log(`  index     ${stats.html} bytes`);
console.log(`  fonts.css ${(stats.fontsCss / 1024).toFixed(1)} KiB (fonts inlined as data URIs)`);
