const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const isolation = require("../font-settings/webroot/font-isolation.js");

function tag(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function table(bytes, expectedTag) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(4, false);
  for (let index = 0; index < count; index += 1) {
    const record = 12 + index * 16;
    if (tag(view, record) !== expectedTag) continue;
    const offset = view.getUint32(record + 8, false);
    const length = view.getUint32(record + 12, false);
    return bytes.subarray(offset, offset + length);
  }
  return null;
}

function format4Glyph(view, codePoint) {
  const count = view.getUint16(6, false) / 2;
  const endPosition = 14;
  const startPosition = 16 + count * 2;
  const deltaPosition = 16 + count * 4;
  const rangePosition = 16 + count * 6;
  for (let index = 0; index < count; index += 1) {
    const end = view.getUint16(endPosition + index * 2, false);
    const start = view.getUint16(startPosition + index * 2, false);
    if (codePoint < start || codePoint > end) continue;
    const delta = view.getInt16(deltaPosition + index * 2, false);
    const rangeWord = rangePosition + index * 2;
    const range = view.getUint16(rangeWord, false);
    if (!range) return (codePoint + delta) & 0xffff;
    const glyph = view.getUint16(rangeWord + range + (codePoint - start) * 2, false);
    return glyph ? (glyph + delta) & 0xffff : 0;
  }
  return 0;
}

function subtableGlyph(bytes, offset, codePoint) {
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.byteLength - offset);
  const format = view.getUint16(0, false);
  if (format === 0 && codePoint <= 0xff) return view.getUint8(6 + codePoint);
  if (format === 4 && codePoint <= 0xffff) return format4Glyph(view, codePoint);
  if (format === 6) {
    const first = view.getUint16(6, false);
    const count = view.getUint16(8, false);
    return codePoint >= first && codePoint < first + count
      ? view.getUint16(10 + (codePoint - first) * 2, false)
      : 0;
  }
  if (format === 10) {
    const first = view.getUint32(12, false);
    const count = view.getUint32(16, false);
    return codePoint >= first && codePoint < first + count
      ? view.getUint16(20 + (codePoint - first) * 2, false)
      : 0;
  }
  if (format === 12 || format === 13) {
    const count = view.getUint32(12, false);
    for (let index = 0; index < count; index += 1) {
      const group = 16 + index * 12;
      const start = view.getUint32(group, false);
      const end = view.getUint32(group + 4, false);
      if (codePoint < start || codePoint > end) continue;
      const glyph = view.getUint32(group + 8, false);
      return format === 12 ? glyph + codePoint - start : glyph;
    }
  }
  return 0;
}

function maps(bytes, codePoint) {
  const cmap = table(bytes, "cmap");
  assert(cmap, "font must contain cmap");
  const view = new DataView(cmap.buffer, cmap.byteOffset, cmap.byteLength);
  const count = view.getUint16(2, false);
  for (let index = 0; index < count; index += 1) {
    const record = 4 + index * 8;
    const platform = view.getUint16(record, false);
    const encoding = view.getUint16(record + 2, false);
    if (platform !== 0 && !(platform === 3 && (encoding === 1 || encoding === 10))) continue;
    if (subtableGlyph(cmap, view.getUint32(record + 4, false), codePoint)) return true;
  }
  return false;
}

function mappedCodePoints(bytes) {
  const cmap = table(bytes, "cmap");
  assert(cmap, "font must contain cmap");
  const cmapView = new DataView(cmap.buffer, cmap.byteOffset, cmap.byteLength);
  const result = new Set();
  const recordCount = cmapView.getUint16(2, false);
  for (let recordIndex = 0; recordIndex < recordCount; recordIndex += 1) {
    const record = 4 + recordIndex * 8;
    const platform = cmapView.getUint16(record, false);
    const encoding = cmapView.getUint16(record + 2, false);
    if (platform !== 0 && !(platform === 3 && (encoding === 1 || encoding === 10))) continue;
    const offset = cmapView.getUint32(record + 4, false);
    const view = new DataView(cmap.buffer, cmap.byteOffset + offset, cmap.byteLength - offset);
    const format = view.getUint16(0, false);
    if (format === 0) {
      for (let codePoint = 0; codePoint <= 0xff; codePoint += 1) {
        if (view.getUint8(6 + codePoint)) result.add(codePoint);
      }
    } else if (format === 4) {
      const segmentCount = view.getUint16(6, false) / 2;
      const endPosition = 14;
      const startPosition = 16 + segmentCount * 2;
      for (let index = 0; index < segmentCount; index += 1) {
        const start = view.getUint16(startPosition + index * 2, false);
        const end = view.getUint16(endPosition + index * 2, false);
        for (let codePoint = start; codePoint <= end && codePoint !== 0xffff; codePoint += 1) {
          if (format4Glyph(view, codePoint)) result.add(codePoint);
        }
      }
    } else if (format === 6 || format === 10) {
      const wide = format === 10;
      const first = wide ? view.getUint32(12, false) : view.getUint16(6, false);
      const count = wide ? view.getUint32(16, false) : view.getUint16(8, false);
      const glyphOffset = wide ? 20 : 10;
      for (let index = 0; index < count; index += 1) {
        if (view.getUint16(glyphOffset + index * 2, false)) result.add(first + index);
      }
    } else if (format === 12 || format === 13) {
      const count = view.getUint32(12, false);
      for (let index = 0; index < count; index += 1) {
        const group = 16 + index * 12;
        const start = view.getUint32(group, false);
        const end = view.getUint32(group + 4, false);
        const firstGlyph = view.getUint32(group + 8, false);
        for (let codePoint = start; codePoint <= end; codePoint += 1) {
          const glyph = format === 12 ? firstGlyph + codePoint - start : firstGlyph;
          if (glyph) result.add(codePoint);
        }
      }
    }
  }
  return result;
}

function checksum(bytes) {
  const padded = (bytes.byteLength + 3) & ~3;
  const copy = new Uint8Array(padded);
  copy.set(bytes);
  const view = new DataView(copy.buffer);
  let sum = 0;
  for (let offset = 0; offset < padded; offset += 4) sum = (sum + view.getUint32(offset, false)) >>> 0;
  return sum;
}

function verify(sourcePath, requireMixedCoverage = false) {
  const label = path.basename(sourcePath);
  const source = new Uint8Array(fs.readFileSync(sourcePath));
  const hasLatin = maps(source, 0x41);
  const hasChinese = maps(source, 0x4e2d);
  const originalMappings = mappedCodePoints(source);
  if (requireMixedCoverage) {
    assert(hasLatin, `${label} must map Latin A`);
    assert(hasChinese, `${label} must map Chinese 中`);
  }

  const chinese = isolation.isolateFont(source, "chinese");
  assert(!maps(chinese, 0x41), `${label}: Chinese import must not map Latin A`);
  assert(!maps(chinese, 0x30), `${label}: Chinese import must not map Western digits`);
  if (hasChinese) assert(maps(chinese, 0x4e2d), `${label}: Chinese import must retain Chinese 中`);
  if (table(source, "fvar")) assert(table(chinese, "fvar"), `${label}: variable-font tables must be retained`);
  assert.equal(checksum(chinese), 0xb1b0afba, `${label}: Chinese output must have a valid SFNT checksum`);
  const chineseMappings = mappedCodePoints(chinese);
  for (const codePoint of originalMappings) {
    assert.equal(
      chineseMappings.has(codePoint),
      !isolation.shouldRemove("chinese", codePoint),
      `${label}: unexpected Chinese mapping at U+${codePoint.toString(16).toUpperCase()}`,
    );
  }

  const western = isolation.isolateFont(source, "western");
  if (hasLatin) assert(maps(western, 0x41), `${label}: Western import must retain Latin A`);
  assert(!maps(western, 0x4e2d), `${label}: Western import must not map Chinese 中`);
  assert(!maps(western, 0x3002), `${label}: Western import must not map CJK punctuation`);
  assert.equal(checksum(western), 0xb1b0afba, `${label}: Western output must have a valid SFNT checksum`);
  const westernMappings = mappedCodePoints(western);
  for (const codePoint of originalMappings) {
    assert.equal(
      westernMappings.has(codePoint),
      !isolation.shouldRemove("western", codePoint),
      `${label}: unexpected Western mapping at U+${codePoint.toString(16).toUpperCase()}`,
    );
  }
}

const sourcePath = path.join(__dirname, "..", "font-settings", "system", "fonts", "FontSettingChinese.ttf");
verify(sourcePath, true);
for (const extraPath of process.argv.slice(2)) verify(path.resolve(extraPath));

console.log("font role isolation: passed");
