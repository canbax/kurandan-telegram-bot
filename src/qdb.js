const zlib = require("zlib");

/**
 * The `.qdb` container: one file per translation, holding all 114 surahs as
 * independently compressed blocks.
 *
 *   offset 0    magic "QDB1"                                      4 bytes
 *   offset 4    uint32LE surah count (always 114)                 4 bytes
 *   offset 8    114 x { uint32LE blockOffset, uint32LE length }   912 bytes
 *   offset 920  the 114 raw-deflate blocks, back to back
 *
 * Each block inflates to that surah's verses joined by "\n", so verse `n` is
 * line `n - 1`. Blocks are compressed separately on purpose: reading one verse
 * costs a single seek plus a ~3 KB inflate instead of decompressing the whole
 * translation. Measured against one gzip per file, that seekability costs about
 * 15% in size, which is what buys the lazy reads in `quran.js`.
 *
 * Everything here is pure, so the format can be tested without touching disk.
 */

const MAGIC = "QDB1";
const SURAH_COUNT = 114;
const INDEX_ENTRY_BYTES = 8;
const HEADER_BYTES = 8 + SURAH_COUNT * INDEX_ENTRY_BYTES; // 920

/**
 * Packs 114 surahs into a `.qdb` buffer.
 *
 * @param {string[][]} surahs 114 entries, each the verses of one surah in order.
 * @returns {Buffer}
 */
function pack(surahs) {
  if (!Array.isArray(surahs) || surahs.length !== SURAH_COUNT) {
    throw new Error(
      `qdb: expected ${SURAH_COUNT} surahs, got ${
        Array.isArray(surahs) ? surahs.length : typeof surahs
      }`
    );
  }

  const blocks = surahs.map((verses, i) => {
    if (!Array.isArray(verses) || verses.length === 0) {
      throw new Error(`qdb: surah ${i + 1} has no verses`);
    }

    verses.forEach((verse, j) => {
      if (typeof verse !== "string") {
        throw new Error(`qdb: verse ${i + 1}/${j + 1} is not a string`);
      }
      // "\n" is the record separator inside a block, so a verse may not hold one.
      if (verse.includes("\n")) {
        throw new Error(`qdb: verse ${i + 1}/${j + 1} contains a newline`);
      }
    });

    return zlib.deflateRawSync(Buffer.from(verses.join("\n"), "utf8"), {
      level: zlib.constants.Z_BEST_COMPRESSION,
    });
  });

  const header = Buffer.alloc(HEADER_BYTES);
  header.write(MAGIC, 0, "ascii");
  header.writeUInt32LE(SURAH_COUNT, 4);

  let offset = HEADER_BYTES;
  blocks.forEach((block, i) => {
    header.writeUInt32LE(offset, 8 + i * INDEX_ENTRY_BYTES);
    header.writeUInt32LE(block.length, 8 + i * INDEX_ENTRY_BYTES + 4);
    offset += block.length;
  });

  return Buffer.concat([header, ...blocks], offset);
}

/**
 * Reads the index out of the first `HEADER_BYTES` bytes of a `.qdb` file.
 *
 * @param {Buffer} buf at least `HEADER_BYTES` long.
 * @returns {{ offset: number, length: number }[]} one entry per surah, in order.
 */
function parseHeader(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < HEADER_BYTES) {
    throw new Error("qdb: header is too short to be a .qdb file");
  }
  if (buf.toString("ascii", 0, 4) !== MAGIC) {
    throw new Error("qdb: bad magic, not a .qdb file");
  }

  const count = buf.readUInt32LE(4);
  if (count !== SURAH_COUNT) {
    throw new Error(`qdb: expected ${SURAH_COUNT} surahs in index, got ${count}`);
  }

  const index = [];
  for (let i = 0; i < count; i++) {
    index.push({
      offset: buf.readUInt32LE(8 + i * INDEX_ENTRY_BYTES),
      length: buf.readUInt32LE(8 + i * INDEX_ENTRY_BYTES + 4),
    });
  }
  return index;
}

/**
 * Inflates one surah block back into its verses.
 *
 * @param {Buffer} block exactly the bytes the index pointed at.
 * @returns {string[]}
 */
function unpackBlock(block) {
  return zlib.inflateRawSync(block).toString("utf8").split("\n");
}

module.exports = {
  HEADER_BYTES,
  MAGIC,
  SURAH_COUNT,
  pack,
  parseHeader,
  unpackBlock,
};
