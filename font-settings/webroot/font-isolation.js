(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FontRoleIsolation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SFNT_SIGNATURES = new Set([0x00010000, 0x4f54544f, 0x74727565, 0x74797031]);

  // Neutral ASCII stays with the Latin font. CJK punctuation stays with the
  // Chinese font, so a mixed-script font cannot take over the other role.
  const LATIN_RANGES = [
    [0x0000, 0x036f],
    [0x1d00, 0x1dff],
    [0x1e00, 0x1eff],
    [0x2000, 0x218f],
    [0x2c60, 0x2c7f],
    [0xa700, 0xa7ff],
    [0xab30, 0xab6f],
    [0xfb00, 0xfb06],
    [0xfe20, 0xfe2f],
    [0xff01, 0xff5e],
    [0x10780, 0x107bf],
    [0x1d400, 0x1d7ff],
    [0x1df00, 0x1dfff],
  ];

  const CJK_RANGES = [
    [0x2e80, 0x303f],
    [0x3040, 0x33ff],
    [0x3400, 0x4dbf],
    [0x4e00, 0x9fff],
    [0xa960, 0xa97f],
    [0xac00, 0xd7ff],
    [0xf900, 0xfaff],
    [0xfe10, 0xfe1f],
    [0xfe30, 0xfe4f],
    [0xff00, 0xffef],
    [0x16fe0, 0x18dff],
    [0x1aff0, 0x1b2ff],
    [0x1f200, 0x1f2ff],
    [0x20000, 0x323af],
  ];

  function fail(code) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }

  function asBytes(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    fail("font_isolation_failed");
  }

  function inRanges(codePoint, ranges) {
    let low = 0;
    let high = ranges.length - 1;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      const [start, end] = ranges[middle];
      if (codePoint < start) high = middle - 1;
      else if (codePoint > end) low = middle + 1;
      else return true;
    }
    return false;
  }

  function shouldRemove(role, codePoint) {
    if (role === "chinese") return inRanges(codePoint, LATIN_RANGES);
    if (role === "western") return inRanges(codePoint, CJK_RANGES);
    fail("invalid_role");
  }

  function align4(value) {
    return (value + 3) & ~3;
  }

  function readTag(view, offset) {
    return String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
  }

  function writeTag(view, offset, tag) {
    for (let index = 0; index < 4; index += 1) view.setUint8(offset + index, tag.charCodeAt(index));
  }

  function parseSfnt(bytes) {
    if (bytes.byteLength < 12) fail("font_isolation_failed");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (!SFNT_SIGNATURES.has(view.getUint32(0, false))) fail("font_isolation_failed");
    const tableCount = view.getUint16(4, false);
    if (!tableCount || tableCount > 512 || 12 + tableCount * 16 > bytes.byteLength) {
      fail("font_isolation_failed");
    }

    const tables = [];
    for (let index = 0; index < tableCount; index += 1) {
      const recordOffset = 12 + index * 16;
      const offset = view.getUint32(recordOffset + 8, false);
      const length = view.getUint32(recordOffset + 12, false);
      if (offset > bytes.byteLength || length > bytes.byteLength - offset) fail("font_isolation_failed");
      tables.push({
        tag: readTag(view, recordOffset),
        length,
        bytes: bytes.slice(offset, offset + length),
      });
    }
    return { tables };
  }

  function isUnicodeRecord(platform, encoding) {
    return platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
  }

  function splitAllowed(start, end, role) {
    const ranges = role === "chinese" ? LATIN_RANGES : CJK_RANGES;
    const result = [];
    let cursor = start;
    for (const [removedStart, removedEnd] of ranges) {
      if (removedEnd < cursor) continue;
      if (removedStart > end) break;
      if (removedStart > cursor) result.push([cursor, Math.min(end, removedStart - 1)]);
      cursor = Math.max(cursor, removedEnd + 1);
      if (cursor > end) break;
    }
    if (cursor <= end) result.push([cursor, end]);
    return result;
  }

  function format4Glyph(view, positions, segment, codePoint) {
    const start = view.getUint16(positions.start + segment * 2, false);
    const delta = view.getInt16(positions.delta + segment * 2, false);
    const rangeOffsetPosition = positions.range + segment * 2;
    const rangeOffset = view.getUint16(rangeOffsetPosition, false);
    if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
    const glyphPosition = rangeOffsetPosition + rangeOffset + (codePoint - start) * 2;
    if (glyphPosition + 2 > view.byteLength) fail("font_isolation_failed");
    const glyph = view.getUint16(glyphPosition, false);
    return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
  }

  function buildFormat4(pieces, language) {
    const segments = [...pieces, { start: 0xffff, end: 0xffff, delta: 1, glyphs: null }];
    const glyphCount = pieces.reduce((total, piece) => total + (piece.glyphs ? piece.glyphs.length : 0), 0);
    const length = 16 + segments.length * 8 + glyphCount * 2;
    if (length > 0xffff) fail("font_cmap_too_large");

    const bytes = new Uint8Array(length);
    const view = new DataView(bytes.buffer);
    const segmentCount = segments.length;
    let power = 1;
    let selector = 0;
    while (power * 2 <= segmentCount) {
      power *= 2;
      selector += 1;
    }

    view.setUint16(0, 4, false);
    view.setUint16(2, length, false);
    view.setUint16(4, language, false);
    view.setUint16(6, segmentCount * 2, false);
    view.setUint16(8, power * 2, false);
    view.setUint16(10, selector, false);
    view.setUint16(12, segmentCount * 2 - power * 2, false);

    const endPosition = 14;
    const startPosition = endPosition + segmentCount * 2 + 2;
    const deltaPosition = startPosition + segmentCount * 2;
    const rangePosition = deltaPosition + segmentCount * 2;
    const glyphPosition = rangePosition + segmentCount * 2;
    let glyphIndex = 0;

    segments.forEach((segment, index) => {
      view.setUint16(endPosition + index * 2, segment.end, false);
      view.setUint16(startPosition + index * 2, segment.start, false);
      view.setInt16(deltaPosition + index * 2, segment.delta || 0, false);
      if (!segment.glyphs) {
        view.setUint16(rangePosition + index * 2, 0, false);
        return;
      }
      view.setUint16(rangePosition + index * 2, 2 * (segmentCount - index + glyphIndex), false);
      for (const glyph of segment.glyphs) {
        view.setUint16(glyphPosition + glyphIndex * 2, glyph, false);
        glyphIndex += 1;
      }
    });
    return bytes;
  }

  function filterFormat4(source, role) {
    const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
    if (source.byteLength < 16) fail("font_isolation_failed");
    const length = view.getUint16(2, false);
    const segmentCountX2 = view.getUint16(6, false);
    if (!segmentCountX2 || segmentCountX2 % 2 || length > source.byteLength) fail("font_isolation_failed");
    const segmentCount = segmentCountX2 / 2;
    const positions = {
      end: 14,
      start: 16 + segmentCount * 2,
      delta: 16 + segmentCount * 4,
      range: 16 + segmentCount * 6,
    };
    if (positions.range + segmentCount * 2 > length) fail("font_isolation_failed");

    const pieces = [];
    for (let segment = 0; segment < segmentCount; segment += 1) {
      const start = view.getUint16(positions.start + segment * 2, false);
      const end = view.getUint16(positions.end + segment * 2, false);
      if (start > end || (start === 0xffff && end === 0xffff)) continue;
      const delta = view.getInt16(positions.delta + segment * 2, false);
      const rangeOffset = view.getUint16(positions.range + segment * 2, false);
      for (const [pieceStart, pieceEnd] of splitAllowed(start, end, role)) {
        if (rangeOffset === 0) {
          pieces.push({ start: pieceStart, end: pieceEnd, delta, glyphs: null });
        } else {
          const glyphs = [];
          for (let codePoint = pieceStart; codePoint <= pieceEnd; codePoint += 1) {
            glyphs.push(format4Glyph(view, positions, segment, codePoint));
          }
          pieces.push({ start: pieceStart, end: pieceEnd, delta: 0, glyphs });
        }
      }
    }
    return buildFormat4(pieces, view.getUint16(4, false));
  }

  function filterFormat0(source, role) {
    if (source.byteLength < 262) fail("font_isolation_failed");
    const result = source.slice();
    for (let codePoint = 0; codePoint < 256; codePoint += 1) {
      if (shouldRemove(role, codePoint)) result[6 + codePoint] = 0;
    }
    return result;
  }

  function filterFormat6(source, role) {
    const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
    if (source.byteLength < 10) fail("font_isolation_failed");
    const firstCode = view.getUint16(6, false);
    const count = view.getUint16(8, false);
    if (10 + count * 2 > source.byteLength) fail("font_isolation_failed");
    const result = source.slice();
    const resultView = new DataView(result.buffer);
    for (let index = 0; index < count; index += 1) {
      if (shouldRemove(role, firstCode + index)) resultView.setUint16(10 + index * 2, 0, false);
    }
    return result;
  }

  function filterFormat10(source, role) {
    const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
    if (source.byteLength < 20) fail("font_isolation_failed");
    const firstCode = view.getUint32(12, false);
    const count = view.getUint32(16, false);
    if (count > (source.byteLength - 20) / 2) fail("font_isolation_failed");
    const result = source.slice();
    const resultView = new DataView(result.buffer);
    for (let index = 0; index < count; index += 1) {
      if (shouldRemove(role, firstCode + index)) resultView.setUint16(20 + index * 2, 0, false);
    }
    return result;
  }

  function filterGroupedFormat(source, role, format) {
    const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
    if (source.byteLength < 16) fail("font_isolation_failed");
    const groupCount = view.getUint32(12, false);
    if (groupCount > (source.byteLength - 16) / 12) fail("font_isolation_failed");
    const groups = [];
    for (let index = 0; index < groupCount; index += 1) {
      const offset = 16 + index * 12;
      const start = view.getUint32(offset, false);
      const end = view.getUint32(offset + 4, false);
      const startGlyph = view.getUint32(offset + 8, false);
      if (start > end || end > 0x10ffff) fail("font_isolation_failed");
      for (const [pieceStart, pieceEnd] of splitAllowed(start, end, role)) {
        groups.push({
          start: pieceStart,
          end: pieceEnd,
          glyph: format === 12 ? startGlyph + (pieceStart - start) : startGlyph,
        });
      }
    }

    const result = new Uint8Array(16 + groups.length * 12);
    const resultView = new DataView(result.buffer);
    resultView.setUint16(0, format, false);
    resultView.setUint16(2, 0, false);
    resultView.setUint32(4, result.byteLength, false);
    resultView.setUint32(8, view.getUint32(8, false), false);
    resultView.setUint32(12, groups.length, false);
    groups.forEach((group, index) => {
      const offset = 16 + index * 12;
      resultView.setUint32(offset, group.start, false);
      resultView.setUint32(offset + 4, group.end, false);
      resultView.setUint32(offset + 8, group.glyph, false);
    });
    return result;
  }

  function emptyFormat4() {
    return buildFormat4([], 0);
  }

  function subtableLength(cmapView, offset, tableLength, nextOffset) {
    if (offset + 2 > tableLength) fail("font_isolation_failed");
    const format = cmapView.getUint16(offset, false);
    let length;
    if (format === 8 || format === 10 || format === 12 || format === 13) {
      if (offset + 8 > tableLength) fail("font_isolation_failed");
      length = cmapView.getUint32(offset + 4, false);
    } else if (format === 14) {
      if (offset + 6 > tableLength) fail("font_isolation_failed");
      length = cmapView.getUint32(offset + 2, false);
    } else {
      if (offset + 4 > tableLength) fail("font_isolation_failed");
      length = cmapView.getUint16(offset + 2, false);
    }
    const bound = Math.min(tableLength, nextOffset || tableLength);
    if (!length || length > bound - offset) fail("font_isolation_failed");
    return { format, length };
  }

  function transformSubtable(source, format, role) {
    if (format === 0) return filterFormat0(source, role);
    if (format === 4) return filterFormat4(source, role);
    if (format === 6) return filterFormat6(source, role);
    if (format === 10) return filterFormat10(source, role);
    if (format === 12 || format === 13) return filterGroupedFormat(source, role, format);
    if (format === 14) return source.slice();
    return emptyFormat4();
  }

  function rebuildCmap(source, role) {
    if (source.byteLength < 4) fail("font_cmap_missing");
    const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
    const recordCount = view.getUint16(2, false);
    if (!recordCount || 4 + recordCount * 8 > source.byteLength) fail("font_cmap_missing");

    const records = [];
    const offsets = [];
    for (let index = 0; index < recordCount; index += 1) {
      const offset = 4 + index * 8;
      const subtableOffset = view.getUint32(offset + 4, false);
      if (subtableOffset >= source.byteLength) fail("font_isolation_failed");
      records.push({
        platform: view.getUint16(offset, false),
        encoding: view.getUint16(offset + 2, false),
        originalOffset: subtableOffset,
      });
      offsets.push(subtableOffset);
    }
    const sortedOffsets = [...new Set(offsets)].sort((a, b) => a - b);

    let supportedUnicode = 0;
    const variants = new Map();
    for (const record of records) {
      const unicode = isUnicodeRecord(record.platform, record.encoding);
      const key = `${record.originalOffset}:${unicode ? role : "original"}`;
      record.variantKey = key;
      if (variants.has(key)) continue;
      const position = sortedOffsets.indexOf(record.originalOffset);
      const nextOffset = sortedOffsets[position + 1];
      const { format, length } = subtableLength(view, record.originalOffset, source.byteLength, nextOffset);
      const original = source.slice(record.originalOffset, record.originalOffset + length);
      let bytes = original;
      if (unicode) {
        bytes = transformSubtable(original, format, role);
        if ([0, 4, 6, 10, 12, 13].includes(format)) supportedUnicode += 1;
      }
      variants.set(key, { bytes, offset: 0 });
    }
    if (!supportedUnicode) fail("font_cmap_unsupported");

    let length = 4 + recordCount * 8;
    for (const variant of variants.values()) {
      length = align4(length);
      variant.offset = length;
      length += variant.bytes.byteLength;
    }
    const result = new Uint8Array(length);
    const resultView = new DataView(result.buffer);
    resultView.setUint16(0, view.getUint16(0, false), false);
    resultView.setUint16(2, recordCount, false);
    records.forEach((record, index) => {
      const offset = 4 + index * 8;
      resultView.setUint16(offset, record.platform, false);
      resultView.setUint16(offset + 2, record.encoding, false);
      resultView.setUint32(offset + 4, variants.get(record.variantKey).offset, false);
    });
    for (const variant of variants.values()) result.set(variant.bytes, variant.offset);
    return result;
  }

  function checksum(bytes) {
    const padded = align4(bytes.byteLength);
    const buffer = new Uint8Array(padded);
    buffer.set(bytes);
    const view = new DataView(buffer.buffer);
    let sum = 0;
    for (let offset = 0; offset < padded; offset += 4) sum = (sum + view.getUint32(offset, false)) >>> 0;
    return sum;
  }

  function scaleFont(input, fromPercent, toPercent) {
    const source = asBytes(input);
    const output = source.slice();
    const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
    if (output.byteLength < 12 || !SFNT_SIGNATURES.has(view.getUint32(0, false))) fail("font_isolation_failed");
    const tableCount = view.getUint16(4, false);
    if (!tableCount || tableCount > 512 || 12 + tableCount * 16 > output.byteLength) fail("font_isolation_failed");

    let headOffset = -1;
    let headLength = 0;
    let headRecord = -1;
    for (let index = 0; index < tableCount; index += 1) {
      const recordOffset = 12 + index * 16;
      const offset = view.getUint32(recordOffset + 8, false);
      const length = view.getUint32(recordOffset + 12, false);
      if (offset > output.byteLength || length > output.byteLength - offset) fail("font_isolation_failed");
      if (readTag(view, recordOffset) === "head") {
        headOffset = offset;
        headLength = length;
        headRecord = recordOffset;
      }
    }
    if (headOffset < 0 || headLength < 20) fail("font_isolation_failed");

    const from = Math.max(1, Number(fromPercent) || 100);
    const to = Math.max(1, Number(toPercent) || 100);
    const currentUnits = view.getUint16(headOffset + 18, false);
    const originalUnits = Math.max(16, Math.round((currentUnits * from) / 100));
    const nextUnits = Math.max(16, Math.min(16384, Math.round((originalUnits * 100) / to)));
    view.setUint32(headOffset + 8, 0, false);
    view.setUint16(headOffset + 18, nextUnits, false);
    view.setUint32(headRecord + 4, checksum(output.slice(headOffset, headOffset + headLength)), false);
    view.setUint32(headOffset + 8, (0xb1b0afba - checksum(output)) >>> 0, false);
    return output;
  }

  function rebuildSfnt(source, role) {
    const { tables } = parseSfnt(source);
    const cmap = tables.find((table) => table.tag === "cmap");
    const head = tables.find((table) => table.tag === "head");
    if (!cmap) fail("font_cmap_missing");
    if (!head || head.length < 12) fail("font_isolation_failed");
    cmap.bytes = rebuildCmap(cmap.bytes, role);
    cmap.length = cmap.bytes.byteLength;

    head.bytes = head.bytes.slice();
    new DataView(head.bytes.buffer).setUint32(8, 0, false);

    let outputLength = align4(12 + tables.length * 16);
    for (const table of tables) {
      table.outputOffset = outputLength;
      outputLength = align4(outputLength + table.bytes.byteLength);
    }

    const output = new Uint8Array(outputLength);
    output.set(source.subarray(0, 12), 0);
    const outputView = new DataView(output.buffer);
    tables.forEach((table, index) => {
      const recordOffset = 12 + index * 16;
      writeTag(outputView, recordOffset, table.tag);
      outputView.setUint32(recordOffset + 4, checksum(table.bytes), false);
      outputView.setUint32(recordOffset + 8, table.outputOffset, false);
      outputView.setUint32(recordOffset + 12, table.bytes.byteLength, false);
      output.set(table.bytes, table.outputOffset);
    });

    const headOutput = tables.find((table) => table.tag === "head").outputOffset;
    outputView.setUint32(headOutput + 8, (0xb1b0afba - checksum(output)) >>> 0, false);
    return output;
  }

  function isolateFont(input, role) {
    if (role !== "chinese" && role !== "western") fail("invalid_role");
    return rebuildSfnt(asBytes(input), role);
  }

  return { CJK_RANGES, LATIN_RANGES, isolateFont, scaleFont, shouldRemove };
});
