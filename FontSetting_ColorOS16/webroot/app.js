const MODULE_ID = "font_setting_coloros16";
const ACTIVE_MODDIR = `/data/adb/modules/${MODULE_ID}`;
const UPDATE_MODDIR = `/data/adb/modules_update/${MODULE_ID}`;
const CHUNK_SIZE = 48 * 1024;
const COLOR_TOKENS = {
  background: "background",
  "on-background": "onBackground",
  surface: "surface",
  "surface-dim": "surfaceDim",
  "surface-bright": "surfaceBright",
  "surface-container-lowest": "surfaceContainerLowest",
  "surface-container-low": "surfaceContainerLow",
  "surface-container": "surfaceContainer",
  "surface-container-high": "surfaceContainerHigh",
  "surface-container-highest": "surfaceContainerHighest",
  "on-surface": "onSurface",
  "surface-variant": "surfaceVariant",
  "on-surface-variant": "onSurfaceVariant",
  "inverse-surface": "inverseSurface",
  "inverse-on-surface": "inverseOnSurface",
  outline: "outline",
  "outline-variant": "outlineVariant",
  shadow: "shadow",
  scrim: "scrim",
  "surface-tint": "surfaceTint",
  "surface-tint-color": "surfaceTint",
  primary: "primary",
  "on-primary": "onPrimary",
  "primary-container": "primaryContainer",
  "on-primary-container": "onPrimaryContainer",
  "inverse-primary": "inversePrimary",
  secondary: "secondary",
  "on-secondary": "onSecondary",
  "secondary-container": "secondaryContainer",
  "on-secondary-container": "onSecondaryContainer",
  tertiary: "tertiary",
  "on-tertiary": "onTertiary",
  "tertiary-container": "tertiaryContainer",
  "on-tertiary-container": "onTertiaryContainer",
  error: "error",
  "on-error": "onError",
  "error-container": "errorContainer",
  "on-error-container": "onErrorContainer",
  "primary-fixed": "primaryFixed",
  "primary-fixed-dim": "primaryFixedDim",
  "on-primary-fixed": "onPrimaryFixed",
  "on-primary-fixed-variant": "onPrimaryFixedVariant",
  "secondary-fixed": "secondaryFixed",
  "secondary-fixed-dim": "secondaryFixedDim",
  "on-secondary-fixed": "onSecondaryFixed",
  "on-secondary-fixed-variant": "onSecondaryFixedVariant",
  "tertiary-fixed": "tertiaryFixed",
  "tertiary-fixed-dim": "tertiaryFixedDim",
  "on-tertiary-fixed": "onTertiaryFixed",
  "on-tertiary-fixed-variant": "onTertiaryFixedVariant",
};
let moduleDir = ACTIVE_MODDIR;
let fontctl = `${moduleDir}/tools/fontctl.sh`;
let callbackSequence = 0;
let monetSeed = "#4f635b";

const roles = {
  chinese: {
    fileInput: document.querySelector("#chinese-file"),
    button: document.querySelector("#chinese-upload"),
    name: document.querySelector("#chinese-name"),
    meta: document.querySelector("#chinese-meta"),
    type: document.querySelector("#chinese-type"),
    progress: document.querySelector("#chinese-progress"),
  },
  western: {
    fileInput: document.querySelector("#western-file"),
    button: document.querySelector("#western-upload"),
    name: document.querySelector("#western-name"),
    meta: document.querySelector("#western-meta"),
    type: document.querySelector("#western-type"),
    progress: document.querySelector("#western-progress"),
  },
};

const bridgeChip = document.querySelector("#bridge-chip");
const bridgeLabel = document.querySelector("#bridge-label");
const rebootChip = document.querySelector("#reboot-chip");
const rebootButton = document.querySelector("#reboot-button");
const rebootDialog = document.querySelector("#reboot-dialog");
const snackbar = document.querySelector("#snackbar");
const monetLabel = document.querySelector("#monet-label");
const pageProgress = document.querySelector("#page-progress");
const topAppBar = document.querySelector("mdui-top-app-bar");
const compactTitle = document.querySelector("#compact-title");
const largeTitle = document.querySelector(".large-title");
const darkMode = window.matchMedia("(prefers-color-scheme: dark)");
let uploadInProgress = false;
let titleAnimationFrame = 0;

function exec(command, options = {}) {
  return new Promise((resolve, reject) => {
    if (!window.ksu || typeof window.ksu.exec !== "function") {
      reject(new Error("KSU_BRIDGE_UNAVAILABLE"));
      return;
    }

    const callbackName = `font_setting_exec_${Date.now()}_${callbackSequence++}`;
    let settled = false;
    const timeout = window.setTimeout(() => finish(new Error("KSU_BRIDGE_TIMEOUT")), 30000);

    function finish(error, output = "") {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      delete window[callbackName];
      if (error) reject(error);
      else resolve(String(output ?? "").trim());
    }

    window[callbackName] = (errno, stdout, stderr) => {
      const code = Number(errno) || 0;
      if (code !== 0) {
        finish(new Error(String(stderr || stdout || `command_failed_${code}`).trim()));
      } else {
        finish(null, stdout);
      }
    };

    try {
      const legacyResult = window.ksu.exec(command, JSON.stringify(options), callbackName);
      if (legacyResult !== undefined && legacyResult !== null) finish(null, legacyResult);
    } catch (modernError) {
      try {
        const legacyResult = window.ksu.exec(command);
        finish(null, legacyResult);
      } catch {
        finish(modernError);
      }
    }
  });
}

function parseProperties(text) {
  const result = {};
  for (const line of String(text).split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0) {
      result[line.slice(0, separator)] = line.slice(separator + 1);
    }
  }
  return result;
}

function assertCommand(result, expected) {
  const values = parseProperties(result);
  if (values.error) {
    throw new Error(values.error);
  }
  if (expected && values.ok !== expected) {
    throw new Error("unexpected_response");
  }
}

function normalizeSeed(value) {
  const hex = String(value || "").replace(/[^0-9a-f]/gi, "");
  if (hex.length < 6) return null;
  return `#${hex.slice(-6).toLowerCase()}`;
}

function applyColorScheme() {
  document.documentElement.style.setProperty("--monet-seed", monetSeed);
  if (!window.MaterialKolor) {
    mdui.setColorScheme(monetSeed);
    return;
  }

  const {
    Hct,
    MaterialDynamicColors,
    SchemeTonalSpot,
    argbFromHex,
    blueFromArgb,
    greenFromArgb,
    redFromArgb,
  } = window.MaterialKolor;
  const source = Hct.fromInt(argbFromHex(monetSeed));
  const scheme = new SchemeTonalSpot(source, darkMode.matches, 0);
  const root = document.documentElement;

  for (const [token, dynamicName] of Object.entries(COLOR_TOKENS)) {
    const argb = MaterialDynamicColors[dynamicName].getArgb(scheme);
    const rgb = `${redFromArgb(argb)}, ${greenFromArgb(argb)}, ${blueFromArgb(argb)}`;
    root.style.setProperty(`--mdui-color-${token}`, rgb);
  }

  root.dataset.colorSource = "monet";
  monetLabel.textContent = `Monet ${monetSeed.toUpperCase()}`;
}

async function loadMonetSeed() {
  try {
    const output = await exec("settings get secure theme_customization_overlay_packages");
    const start = output.indexOf("{");
    const settings = JSON.parse(start >= 0 ? output.slice(start) : output);
    const seed = normalizeSeed(
      settings["android.theme.customization.system_palette"] ||
        settings["android.theme.customization.accent_color"],
    );
    if (seed) monetSeed = seed;
  } catch {
    // Keep the local fallback seed when the ROM does not expose Monet settings.
  }
  applyColorScheme();
}

async function resolveModuleDir() {
  const result = (await exec(`[ -d '${UPDATE_MODDIR}' ] && echo '${UPDATE_MODDIR}' || echo '${ACTIVE_MODDIR}'`))
    .split(/\r?\n/)
    .at(-1);
  moduleDir = result === UPDATE_MODDIR ? UPDATE_MODDIR : ACTIVE_MODDIR;
  fontctl = `${moduleDir}/tools/fontctl.sh`;
}

function bytesToBase64(bytes) {
  let binary = "";
  const block = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += block) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + block));
  }
  return btoa(binary);
}

function utf8ToBase64(value) {
  return bytesToBase64(new TextEncoder().encode(value));
}

function base64ToUtf8(value) {
  if (!value) return "未知字体";
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "未知字体";
  }
}

function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function showMessage(message) {
  snackbar.textContent = message;
  snackbar.open = true;
}

function setWavyProgress(element, value) {
  const number = Math.max(0, Math.min(1, Number(value) || 0));
  const percent = Math.round(number * 100);
  element.classList.remove("indeterminate");
  element.querySelector(".wave-value").style.strokeDasharray = `${percent} ${100 - percent}`;
  element.setAttribute("aria-valuenow", String(percent));
}

function setIndeterminate(element, active) {
  element.classList.toggle("hidden", !active);
  element.classList.toggle("indeterminate", active);
  if (active) element.removeAttribute("aria-valuenow");
}

function updateTopBarTitle() {
  if (titleAnimationFrame) return;
  titleAnimationFrame = window.requestAnimationFrame(() => {
    titleAnimationFrame = 0;
    const barBottom = topAppBar.getBoundingClientRect().bottom;
    const titleSubmerged = largeTitle.getBoundingClientRect().bottom <= barBottom + 1;
    compactTitle.classList.toggle("title-visible", titleSubmerged);
    compactTitle.setAttribute("aria-hidden", String(!titleSubmerged));
  });
}

function readTag(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

async function inspectFont(file) {
  if (!file.name.toLowerCase().endsWith(".ttf")) {
    throw new Error("请选择扩展名为 .ttf 的字体文件");
  }
  if (file.size <= 0 || file.size > 512 * 1024 * 1024) {
    throw new Error("字体文件大小必须在 512 MB 以内");
  }

  const headerBuffer = await file.slice(0, Math.min(file.size, 256 * 1024)).arrayBuffer();
  const view = new DataView(headerBuffer);
  if (view.byteLength < 12) throw new Error("字体文件头不完整");

  const signature = view.getUint32(0, false);
  const accepted = new Set([0x00010000, 0x4f54544f, 0x74727565, 0x74797031]);
  if (!accepted.has(signature)) throw new Error("文件不是有效的 SFNT/TrueType 字体");

  const tableCount = view.getUint16(4, false);
  const directorySize = 12 + tableCount * 16;
  if (tableCount === 0 || tableCount > 512 || directorySize > view.byteLength) {
    throw new Error("字体表目录无效");
  }

  let fvar = null;
  for (let index = 0; index < tableCount; index += 1) {
    const offset = 12 + index * 16;
    if (readTag(view, offset) === "fvar") {
      fvar = {
        offset: view.getUint32(offset + 8, false),
        length: view.getUint32(offset + 12, false),
      };
      break;
    }
  }

  const axes = [];
  if (fvar && fvar.offset + fvar.length <= file.size && fvar.length >= 16) {
    const fvarBuffer = await file.slice(fvar.offset, fvar.offset + Math.min(fvar.length, 64 * 1024)).arrayBuffer();
    const fvarView = new DataView(fvarBuffer);
    const axesOffset = fvarView.getUint16(4, false);
    const axisCount = fvarView.getUint16(8, false);
    const axisSize = fvarView.getUint16(10, false);
    if (axisSize >= 20 && axisCount <= 64) {
      for (let index = 0; index < axisCount; index += 1) {
        const offset = axesOffset + index * axisSize;
        if (offset + 4 <= fvarView.byteLength) axes.push(readTag(fvarView, offset));
      }
    }
  }

  return { variableWeight: axes.includes("wght") };
}

function setBusy(role, busy) {
  const current = roles[role];
  current.button.disabled = busy;
  current.fileInput.disabled = busy;
  current.progress.classList.toggle("hidden", !busy);
  if (busy) setWavyProgress(current.progress, 0);
  document.querySelector("#refresh-button").disabled = busy;
  rebootButton.disabled = busy || rebootChip.classList.contains("hidden");
}

async function appendChunk(role, bytes) {
  const encoded = bytesToBase64(bytes);
  const temporaryPath = `${moduleDir}/data/.${role}.upload`;
  const command = `printf '%s' '${encoded}' | base64 -d >> '${temporaryPath}' && echo ok`;
  if ((await exec(command)).split(/\r?\n/).at(-1) !== "ok") {
    throw new Error("write_failed");
  }
}

async function uploadFont(role, file) {
  if (uploadInProgress) return;
  uploadInProgress = true;
  const current = roles[role];
  setBusy(role, true);
  setWavyProgress(current.progress, 0);

  try {
    const info = await inspectFont(file);
    assertCommand(await exec(`${fontctl} begin ${role} ${file.size}`), "begin");

    for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
      const end = Math.min(offset + CHUNK_SIZE, file.size);
      const bytes = new Uint8Array(await file.slice(offset, end).arrayBuffer());
      await appendChunk(role, bytes);
      setWavyProgress(current.progress, end / file.size);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const variable = info.variableWeight ? 1 : 0;
    const name = utf8ToBase64(file.name);
    assertCommand(await exec(`${fontctl} commit ${role} ${file.size} ${variable} ${name}`), "commit");
    showMessage(`${role === "chinese" ? "中文" : "西文"}字体已保存`);
    await refreshStatus();
  } catch (error) {
    try {
      await exec(`${fontctl} abort ${role}`);
    } catch {
      // The bridge can be unavailable before an upload starts.
    }
    showMessage(error.message || "上传失败");
  } finally {
    current.fileInput.value = "";
    setBusy(role, false);
    uploadInProgress = false;
  }
}

function renderRole(role, values) {
  const current = roles[role];
  const size = Number(values[`${role}_size`]) || 0;
  const variable = values[`${role}_variable`] === "1";
  current.name.textContent = base64ToUtf8(values[`${role}_name_b64`]);
  current.meta.textContent = size > 0 ? formatBytes(size) : "字体文件缺失";
  current.type.textContent = variable ? "可变字体" : "静态字体";
}

async function refreshStatus() {
  setIndeterminate(pageProgress, true);
  try {
    await resolveModuleDir();
    const values = parseProperties(await exec(`${fontctl} status`));
    if (values.module !== "ok") throw new Error("status_failed");

    bridgeLabel.textContent = "KernelSU 已连接";
    bridgeChip.classList.add("connected");
    bridgeChip.classList.remove("connection-error");
    renderRole("chinese", values);
    renderRole("western", values);

    const pending = values.pending_reboot === "1";
    rebootChip.classList.toggle("hidden", !pending);
    rebootButton.disabled = !pending || uploadInProgress;
    document.querySelector("#system-status").textContent = pending
      ? "字体已写入模块，重启后生效"
      : "字体配置已在本次启动中加载";

    const conflicts = (values.conflicts || "").split(",").filter(Boolean);
    const conflictCard = document.querySelector("#conflict-card");
    conflictCard.classList.toggle("hidden", conflicts.length === 0);
    document.querySelector("#conflict-text").textContent = conflicts.length
      ? `请在 KernelSU 中停用：${conflicts.join("、")}`
      : "";
  } catch (error) {
    bridgeLabel.textContent = "KernelSU 连接失败";
    bridgeChip.classList.remove("connected");
    bridgeChip.classList.add("connection-error");
    document.querySelector("#system-status").textContent = "请从 KernelSU 模块页面打开 WebUI";
    rebootButton.disabled = true;
  } finally {
    setIndeterminate(pageProgress, false);
  }
}

function initialize() {
  applyColorScheme();

  darkMode.addEventListener("change", applyColorScheme);
  window.addEventListener("scroll", updateTopBarTitle, { passive: true });
  window.addEventListener("resize", updateTopBarTitle, { passive: true });
  updateTopBarTitle();

  for (const [role, current] of Object.entries(roles)) {
    current.button.addEventListener("click", () => current.fileInput.click());
    current.fileInput.addEventListener("change", () => {
      const [file] = current.fileInput.files;
      if (file) uploadFont(role, file);
    });
  }

  document.querySelector("#back-button").addEventListener("click", () => {
    if (window.history.length > 1) window.history.back();
    else window.close();
  });

  document.querySelector("#refresh-button").addEventListener("click", async () => {
    document.querySelector("#refresh-button").disabled = true;
    await Promise.all([loadMonetSeed(), refreshStatus()]);
    document.querySelector("#refresh-button").disabled = uploadInProgress;
  });
  rebootButton.addEventListener("click", () => {
    rebootDialog.open = true;
  });
  document.querySelector("#cancel-reboot").addEventListener("click", () => {
    rebootDialog.open = false;
  });
  document.querySelector("#confirm-reboot").addEventListener("click", async () => {
    rebootDialog.open = false;
    try {
      await exec("svc power reboot");
    } catch (error) {
      showMessage(error.message || "重启失败");
    }
  });

  loadMonetSeed();
  refreshStatus();
}

window.addEventListener("DOMContentLoaded", initialize);
