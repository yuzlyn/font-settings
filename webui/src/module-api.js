/**
 * Device-side font API: status, chain editing, uploads and Emoji handling.
 * All mutations go through the module's `tools/fontctl.sh` as root.
 */

import {
  assertCommand,
  base64ToUtf8,
  bytesToBase64,
  exec,
  parseProperties,
  utf8ToBase64,
} from "./bridge.js";

const MODULE_ID = "font-settings";
const ACTIVE_MODDIR = `/data/adb/modules/${MODULE_ID}`;
const UPDATE_MODDIR = `/data/adb/modules_update/${MODULE_ID}`;

/** Largest chunk whose base64 form stays below execve's 128 KiB arg limit. */
const CHUNK_SIZE = 80 * 1024;
const MAX_FONT_BYTES = 512 * 1024 * 1024;

export const EMOJI_PRESETS = [
  { mode: "default", nameKey: "emojiDefaultName", detailKey: "emojiDefaultDetail", preview: "🙂" },
  { mode: "ios", name: "iOS / Apple", detail: "AppleColorEmoji.ttf", preview: "🍎" },
  { mode: "google", name: "Google / Pixel", detail: "NotoColorEmoji.ttf", preview: "🤖" },
  { mode: "blobmoji", name: "Classic Blobmoji", detail: "Blobmoji.ttf", preview: "🫠" },
  { mode: "facebook", name: "Facebook", detail: "FacebookEmoji.ttf", preview: "💙" },
  { mode: "custom", nameKey: "emojiCustomName", detailKey: "chooseTtfOrOtf", preview: "📁" },
];

let moduleDir = ACTIVE_MODDIR;
let fontctl = `${moduleDir}/tools/fontctl.sh`;
let shellCapabilitiesPromise = null;
let shellGzipAvailable = false;

export function getModuleDir() {
  return moduleDir;
}

/** Resolves the writable module directory (update path wins before reboot). */
export async function resolveModuleDir() {
  const result = (await exec(`[ -d '${UPDATE_MODDIR}' ] && echo '${UPDATE_MODDIR}' || echo '${ACTIVE_MODDIR}'`))
    .split(/\r?\n/)
    .at(-1);
  moduleDir = result === UPDATE_MODDIR ? UPDATE_MODDIR : ACTIVE_MODDIR;
  fontctl = `${moduleDir}/tools/fontctl.sh`;
  return moduleDir;
}

function probeShellCapabilities() {
  if (!shellCapabilitiesPromise) {
    shellCapabilitiesPromise = exec("command -v gzip >/dev/null 2>&1 && echo ok")
      .then((result) => {
        shellGzipAvailable = result === "ok";
      })
      .catch(() => {
        shellGzipAvailable = false;
      });
  }
  return shellCapabilitiesPromise;
}

export function collectChain(role, values) {
  const count = Number(values[`${role}_font_count`]) || 0;
  const chain = [];
  for (let index = 1; index <= count; index += 1) {
    const name = values[`${role}_font_${index}`];
    if (!name) continue;
    chain.push({
      name,
      index,
      size: Number(values[`${role}_font_${index}_size`]) || 0,
      variable: values[`${role}_font_${index}_variable`] === "1",
      displayName: base64ToUtf8(values[`${role}_font_${index}_name_b64`]) || name,
      nameB64: values[`${role}_font_${index}_name_b64`] || utf8ToBase64(name),
    });
  }
  return chain;
}

/** Reads the full module status. */
export async function getStatus() {
  await resolveModuleDir();
  const values = parseProperties(await exec(`${fontctl} status`));
  if (values.module !== "ok") throw new Error("status_failed");
  return {
    values,
    chains: {
      chinese: collectChain("chinese", values),
      western: collectChain("western", values),
    },
    emoji: {
      mode: values.emoji_mode || "default",
      target: values.emoji_target || "",
      customSize: Number(values.emoji_custom_size) || 0,
      customName: base64ToUtf8(values.emoji_name_b64),
      availability: {
        default: true,
        ios: values.emoji_builtin_ios === "1",
        google: values.emoji_builtin_google === "1",
        blobmoji: values.emoji_builtin_blobmoji === "1",
        facebook: values.emoji_builtin_facebook === "1",
        custom: true,
      },
    },
    weight: {
      chinese: normalizeWeight(values.chinese_weight),
      western: normalizeWeight(values.western_weight),
    },
    westernSize: normalizeWesternSize(values.western_scale),
    fallback: values.fallback !== "0",
    pendingReboot: values.pending_reboot === "1",
    conflicts: String(values.conflicts || "").split(",").filter(Boolean),
    targets: {
      western: Number(values.western_targets) || 0,
      chinese: Number(values.chinese_targets) || 0,
    },
  };
}

export function normalizeWeight(value) {
  const weight = Math.round(Number(value) || 400);
  return Math.max(100, Math.min(900, Math.round(weight / 50) * 50));
}

export function normalizeWesternSize(value) {
  const size = Math.round(Number(value) || 100);
  return Math.max(20, Math.min(100, size));
}

async function compressChunk(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function appendChunk(role, bytes, compressed) {
  const payload = compressed ? await compressChunk(bytes) : bytes;
  const encoded = bytesToBase64(payload);
  const temporaryPath = `${moduleDir}/data/.${role}.upload`;
  const decompress = compressed ? " | gzip -dc" : "";
  const command = `printf '%s' '${encoded}' | base64 -d${decompress} >> '${temporaryPath}' && echo ok`;
  if ((await exec(command)).split(/\r?\n/).at(-1) !== "ok") throw new Error("write_failed");
}

async function uploadBytes(role, bytes, variable, name, slotName, onProgress) {
  const clientCompress = typeof CompressionStream === "function";
  if (clientCompress) await probeShellCapabilities();
  const compressed = clientCompress && shellGzipAvailable;
  assertCommand(await exec(`${fontctl} begin ${role} ${bytes.byteLength}`), "begin");
  for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_SIZE) {
    const end = Math.min(offset + CHUNK_SIZE, bytes.byteLength);
    await appendChunk(role, bytes.subarray(offset, end), compressed);
    onProgress?.(end / bytes.byteLength);
  }
  const finish = slotName
    ? `${fontctl} replace ${role} ${slotName} ${bytes.byteLength} ${variable} ${name}`
    : `${fontctl} commit ${role} ${bytes.byteLength} ${variable} ${name}`;
  assertCommand(await exec(finish), slotName ? "replace" : "commit");
}

/** Minimal File-like wrapper so in-memory bytes reuse the file pipeline. */
export function memoryFile(name, bytes) {
  return {
    name,
    size: bytes.byteLength,
    slice(start = 0, end = bytes.byteLength) {
      const part = bytes.subarray(start, end).slice();
      return { arrayBuffer: async () => part.buffer };
    },
    arrayBuffer: async () => bytes.slice().buffer,
  };
}

function readTag(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

/** Validates an SFNT font and reports whether it carries a `wght` axis. */
export async function inspectFont(file, { allowOpenType = false } = {}) {
  const lowerName = String(file.name || "").toLowerCase();
  const validExtension = lowerName.endsWith(".ttf") || (allowOpenType && lowerName.endsWith(".otf"));
  if (!validExtension) throw new Error(allowOpenType ? "chooseTtfOrOtfError" : "chooseTtfError");
  if (file.size <= 0 || file.size > MAX_FONT_BYTES) throw new Error("fontSizeError");

  const headerBuffer = await file.slice(0, Math.min(file.size, 256 * 1024)).arrayBuffer();
  const view = new DataView(headerBuffer);
  if (view.byteLength < 12) throw new Error("fontHeaderIncomplete");

  const signature = view.getUint32(0, false);
  const accepted = new Set([0x00010000, 0x4f54544f, 0x74727565, 0x74797031]);
  if (!accepted.has(signature)) throw new Error("invalidSfnt");

  const tableCount = view.getUint16(4, false);
  const directorySize = 12 + tableCount * 16;
  if (tableCount === 0 || tableCount > 512 || directorySize > view.byteLength) {
    throw new Error("invalidTableDirectory");
  }

  let fvar = null;
  for (let index = 0; index < tableCount; index += 1) {
    const offset = 12 + index * 16;
    if (readTag(view, offset) === "fvar") {
      fvar = { offset: view.getUint32(offset + 8, false), length: view.getUint32(offset + 12, false) };
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

/** Uploads a font file for a role, isolating its glyph coverage first. */
export async function uploadRoleFont(role, file, { onProgress, slotName } = {}) {
  const info = await inspectFont(file, { allowOpenType: role === "emoji" });
  const isolation = globalThis.FontRoleIsolation;
  let bytes = new Uint8Array(await file.arrayBuffer());
  if (role === "emoji") {
    await uploadBytes("emoji", bytes, 0, utf8ToBase64(file.name), null, onProgress);
    return { variable: false };
  }
  if (!isolation) throw new Error("fontIsolationFailed");
  bytes = isolation.isolateFont(bytes, role);
  await uploadBytes(role, bytes, info.variableWeight ? 1 : 0, utf8ToBase64(file.name), slotName, onProgress);
  return { variable: info.variableWeight };
}

/** Uploads raw bytes that were read from the device filesystem. */
export async function uploadRoleBytes(role, name, bytes, { onProgress, slotName } = {}) {
  const file = memoryFile(name, bytes);
  const info = await inspectFont(file, { allowOpenType: role === "emoji" });
  const isolation = globalThis.FontRoleIsolation;
  if (role === "emoji") {
    await uploadBytes("emoji", bytes, 0, utf8ToBase64(name), null, onProgress);
    return { variable: false };
  }
  if (!isolation) throw new Error("fontIsolationFailed");
  const isolated = isolation.isolateFont(bytes, role);
  await uploadBytes(role, isolated, info.variableWeight ? 1 : 0, utf8ToBase64(name), slotName, onProgress);
  return { variable: info.variableWeight };
}

export async function abortUpload(role) {
  await exec(`${fontctl} abort ${role}`);
}

export async function removeFont(role, name) {
  assertCommand(await exec(`${fontctl} remove ${role} ${name}`), "remove");
}

export async function reorderFonts(role, names) {
  assertCommand(await exec(`${fontctl} reorder ${role} ${names.join(" ")}`), "reorder");
}

export async function setWeight(role, weight) {
  assertCommand(await exec(`${fontctl} weight-set ${role} ${normalizeWeight(weight)}`), "weight");
}

export async function setWesternSize(size) {
  assertCommand(await exec(`${fontctl} western-size ${normalizeWesternSize(size)}`), "western-size");
}

export async function setFallback(enabled) {
  assertCommand(await exec(`${fontctl} fallback-set ${enabled ? 1 : 0}`), "fallback");
}

export async function setEmojiMode(mode) {
  assertCommand(await exec(`${fontctl} emoji-set ${mode}`), "emoji");
}

export async function rebootDevice() {
  await exec("svc power reboot");
}

export function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  if (size < 1024) return `${formatter.format(size)} B`;
  if (size < 1024 * 1024) return `${formatter.format(size / 1024)} KB`;
  return `${formatter.format(size / (1024 * 1024))} MB`;
}
