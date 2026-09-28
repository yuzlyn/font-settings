/**
 * Root shell bridge.
 *
 * Inside a KernelSU/KsuWebUI/MMRL WebView the page talks to `window.ksu`.
 * Everywhere else (a browser on the module's own localhost WebUI server) the
 * same commands are executed through the module's `POST /cgi-bin/exec`
 * endpoint, which runs them as root on the device.
 */

export const HTTP_BRIDGE_PORT = 7125;
export const hasKsuBridge = Boolean(globalThis.ksu && typeof globalThis.ksu.exec === "function");

let callbackSequence = 0;

function execHttp(command, options) {
  const timeoutMs = Math.max(1000, Number(options.timeout) || 30000);
  return fetch(`http://127.0.0.1:${HTTP_BRIDGE_PORT}/cgi-bin/exec`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: command,
    signal: AbortSignal.timeout(timeoutMs),
  })
    .then(async (response) => {
      const text = await response.text();
      const newline = text.indexOf("\n");
      if (newline < 0) throw new Error("http_bridge_bad_response");
      const code = Number(text.slice(0, newline).trim()) || 0;
      const output = text.slice(newline + 1);
      if (code !== 0) throw new Error(String(output || `command_failed_${code}`).trim());
      return output.trim();
    })
    .catch((error) => {
      if (error && error.name === "TimeoutError") throw new Error("bridge_timeout");
      throw error;
    });
}

function execKsu(command, options) {
  return new Promise((resolve, reject) => {
    const callbackName = `font_setting_exec_${Date.now()}_${callbackSequence++}`;
    let settled = false;
    const timeoutMs = Math.max(1000, Number(options.timeout) || 30000);
    const timeout = window.setTimeout(() => finish(new Error("bridge_timeout")), timeoutMs);

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
      if (code !== 0) finish(new Error(String(stderr || stdout || `command_failed_${code}`).trim()));
      else finish(null, stdout);
    };

    try {
      const legacyResult = window.ksu.exec(command, JSON.stringify(options), callbackName);
      if (legacyResult !== undefined && legacyResult !== null) finish(null, legacyResult);
    } catch (modernError) {
      try {
        finish(null, window.ksu.exec(command));
      } catch {
        finish(modernError);
      }
    }
  });
}

/** Runs a shell command as root and resolves with its trimmed stdout. */
export function exec(command, options = {}) {
  if (!hasKsuBridge) return execHttp(command, options);
  return execKsu(command, options);
}

/**
 * Reads a device file in bounded chunks.
 *
 * A single `base64 <file>` for a 10 MB font returns ~14 MB of stdout, which the
 * WebView bridge turns into one enormous JavaScript string and freezes the UI.
 * Reading in small pieces keeps every bridge call cheap and reports progress.
 */
export async function readDeviceFile(path, { chunkSize = 512 * 1024, onProgress, timeout = 20000 } = {}) {
  const quoted = shellQuote(path);
  const sizeText = await exec(
    `if [ -f ${quoted} ]; then stat -c %s ${quoted}; else echo missing; fi`,
    { timeout },
  );
  if (sizeText === "missing" || !/^\d+$/.test(sizeText)) throw new Error("pathNotFound");
  const size = Number(sizeText);
  const parts = [];
  for (let offset = 0; offset < size; offset += chunkSize) {
    const chunk = await exec(
      `dd if=${quoted} bs=${chunkSize} skip=${Math.floor(offset / chunkSize)} count=1 2>/dev/null | base64`,
      { timeout: 60000 },
    );
    parts.push(base64ToBytes(chunk));
    onProgress?.(Math.min(1, (offset + chunkSize) / size));
  }
  const bytes = new Uint8Array(size);
  let cursor = 0;
  for (const part of parts) {
    bytes.set(part.subarray(0, Math.min(part.length, size - cursor)), cursor);
    cursor += part.length;
  }
  if (cursor !== size) throw new Error("pathNotFound");
  return bytes;
}

/** POSIX single-quote escaping for values interpolated into shell commands. */
export function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

export function bytesToBase64(bytes) {
  let binary = "";
  const block = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += block) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + block));
  }
  return btoa(binary);
}

export function base64ToBytes(value) {
  const binary = atob(String(value || "").replace(/\s+/g, ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function utf8ToBase64(value) {
  return bytesToBase64(new TextEncoder().encode(value));
}

export function base64ToUtf8(value) {
  if (!value) return "";
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

export function parseProperties(text) {
  const result = {};
  for (const line of String(text).split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0) result[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return result;
}

export function assertCommand(result, expected) {
  const values = parseProperties(result);
  if (values.error) throw new Error(values.error);
  if (expected && values.ok !== expected) throw new Error("unexpected_response");
}
