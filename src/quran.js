const fs = require("fs");
const path = require("path");

const { HEADER_BYTES, parseHeader, unpackBlock } = require("./qdb");

/**
 * Reads verses out of the bundled `.qdb` translations in `data/quran`.
 *
 * Replaces the old Açık Kuran HTTP client and keeps its shape, so `passage.js`
 * cannot tell the difference: `fetchVerse` still takes
 * `(surahId, verseId, editionId)` and still resolves to `{ text, footnotes }`.
 *
 * Nothing is loaded up front. The first verse of a surah costs one 920-byte
 * header read (once per translation) plus one ~3 KB block read; every other
 * verse of that surah is then served from the block cache, which is what turns
 * the old one-HTTP-request-per-verse loop into a single disk read.
 *
 * Reads are synchronous on purpose: a few KB off local disk takes far less time
 * than the event-loop hop that awaiting it would cost, and the bot handles
 * roughly one request a minute.
 */

const DEFAULT_DATA_DIR = path.join(__dirname, "..", "data", "quran");

/** Plenty for one passage, and bounded so a long-lived lambda cannot grow. */
const DEFAULT_CACHE_SIZE = 32;

/** An edition id becomes a filename, so it may only ever look like a slug. */
const EDITION_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * @param {object} [deps]
 * @param {string} [deps.dataDir] directory holding the `.qdb` files.
 * @param {number} [deps.cacheSize] how many decoded surahs to keep.
 */
function createLocalQuranClient({
  dataDir = DEFAULT_DATA_DIR,
  cacheSize = DEFAULT_CACHE_SIZE,
} = {}) {
  /** @type {Map<string, { fd: number, index: {offset: number, length: number}[] }>} */
  const open = new Map();
  /** @type {Map<string, string[]>} insertion-ordered, oldest first. */
  const surahCache = new Map();

  /**
   * Opens a translation once and keeps its descriptor and index around.
   */
  function openEdition(editionId) {
    const cached = open.get(editionId);
    if (cached) {
      return cached;
    }

    if (typeof editionId !== "string" || !EDITION_ID.test(editionId)) {
      throw new Error(`quran: invalid edition id ${JSON.stringify(editionId)}`);
    }

    const file = path.join(dataDir, `${editionId}.qdb`);
    let fd;
    try {
      fd = fs.openSync(file, "r");
    } catch (err) {
      if (err.code === "ENOENT") {
        throw new Error(`quran: no bundled translation "${editionId}"`);
      }
      throw err;
    }

    let entry;
    try {
      const header = Buffer.alloc(HEADER_BYTES);
      const read = fs.readSync(fd, header, 0, HEADER_BYTES, 0);
      if (read !== HEADER_BYTES) {
        throw new Error(`quran: ${editionId}.qdb is truncated`);
      }
      entry = { fd, index: parseHeader(header) };
    } catch (err) {
      fs.closeSync(fd);
      throw err;
    }

    open.set(editionId, entry);
    return entry;
  }

  /**
   * @param {number} surahId
   * @param {string} editionId
   * @returns {string[]} every verse of the surah, in order.
   */
  function readSurah(surahId, editionId) {
    const { fd, index } = openEdition(editionId);

    if (!Number.isInteger(surahId) || surahId < 1 || surahId > index.length) {
      throw new Error(`quran: surah ${surahId} is out of range (1-${index.length})`);
    }

    const key = `${editionId}:${surahId}`;
    const hit = surahCache.get(key);
    if (hit) {
      // Re-insert so the most recently used entry sorts last.
      surahCache.delete(key);
      surahCache.set(key, hit);
      return hit;
    }

    const { offset, length } = index[surahId - 1];
    const block = Buffer.alloc(length);
    const read = fs.readSync(fd, block, 0, length, offset);
    if (read !== length) {
      throw new Error(`quran: short read for surah ${surahId} of ${editionId}`);
    }

    const verses = unpackBlock(block);
    surahCache.set(key, verses);
    if (surahCache.size > cacheSize) {
      surahCache.delete(surahCache.keys().next().value);
    }
    return verses;
  }

  /**
   * @returns {Promise<string[]>}
   */
  async function fetchSurah(surahId, editionId) {
    return readSurah(surahId, editionId);
  }

  /**
   * `footnotes` is always "" - the bundled texts carry no footnote bodies. It
   * is kept so the returned shape still matches what `passage.js` expects.
   *
   * @returns {Promise<{ text: string, footnotes: string }>}
   */
  async function fetchVerse(surahId, verseId, editionId) {
    const verses = readSurah(surahId, editionId);

    if (!Number.isInteger(verseId) || verseId < 1 || verseId > verses.length) {
      throw new Error(
        `quran: verse ${surahId}/${verseId} is out of range (1-${verses.length})`
      );
    }

    return { text: verses[verseId - 1], footnotes: "" };
  }

  /** Releases the cached file descriptors. Mainly so tests exit cleanly. */
  function close() {
    for (const { fd } of open.values()) {
      fs.closeSync(fd);
    }
    open.clear();
    surahCache.clear();
  }

  return { fetchSurah, fetchVerse, close };
}

module.exports = { createLocalQuranClient, DEFAULT_DATA_DIR };
