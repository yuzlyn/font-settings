// Verifies the WebUI upload transfer pipeline used by webroot/app.js:
// - CHUNK_SIZE chunks stay below the 128 KiB execve argument limit
//   (MAX_ARG_STRLEN) after base64 encoding, even when gzip grows the chunk.
// - The base64 | gzip -dc round trip restores the original chunk bytes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");

const CHUNK_SIZE = 80 * 1024;
const MAX_ARG_STRLEN = 131072;

// Mirrors bytesToBase64 in webroot/app.js.
function bytesToBase64(bytes) {
  let binary = "";
  const block = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += block) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + block));
  }
  return btoa(binary);
}

// Mirrors appendChunk in webroot/app.js.
function buildCommand(encoded, compressed) {
  const temporaryPath = "/data/adb/modules/font-settings/data/.chinese.upload";
  const decompress = compressed ? " | gzip -dc" : "";
  return `printf '%s' '${encoded}' | base64 -d${decompress} >> '${temporaryPath}' && echo ok`;
}

function roundTrip(chunk, compressed) {
  const payload = compressed ? new Uint8Array(zlib.gzipSync(chunk)) : chunk;
  const encoded = bytesToBase64(payload);
  const command = buildCommand(encoded, compressed);
  assert.ok(
    command.length < MAX_ARG_STRLEN,
    `command exceeds execve arg limit: ${command.length} >= ${MAX_ARG_STRLEN}`,
  );
  const restored = compressed
    ? zlib.gunzipSync(Buffer.from(encoded, "base64"))
    : Buffer.from(encoded, "base64");
  assert.ok(
    Buffer.from(restored).equals(Buffer.from(chunk)),
    "restored bytes differ from original chunk",
  );
  return { commandLength: command.length, payloadLength: payload.length };
}

// Real font round trip through the compressed pipeline.
const fontPath = path.join(__dirname, "..", "FontSettingWestern-current.ttf");
assert.ok(fs.existsSync(fontPath), "test font missing");
const font = fs.readFileSync(fontPath);
let totalPayload = 0;
let maxCommand = 0;
let chunks = 0;
for (let offset = 0; offset < font.length; offset += CHUNK_SIZE) {
  const chunk = font.subarray(offset, Math.min(offset + CHUNK_SIZE, font.length));
  const { commandLength, payloadLength } = roundTrip(chunk, true);
  totalPayload += payloadLength;
  maxCommand = Math.max(maxCommand, commandLength);
  chunks += 1;
}
console.log(
  `font ${font.length} bytes -> ${chunks} chunks, gzip payload ${totalPayload} bytes ` +
    `(${Math.round((totalPayload / font.length) * 100)}%), max command ${maxCommand} chars`,
);

// Worst case: incompressible random chunk through both pipelines.
const random = new Uint8Array(crypto.randomBytes(CHUNK_SIZE));
for (const compressed of [false, true]) {
  const { commandLength, payloadLength } = roundTrip(random, compressed);
  console.log(
    `random chunk compressed=${compressed}: payload ${payloadLength} bytes, command ${commandLength} chars`,
  );
}

console.log("upload-transfer-test: ok");
