const got = require("got");
const { ACIK_KURAN_BASE_URL } = require("./config");

/**
 * Client for the Açık Kuran API (https://github.com/ziegfiroyt/acikkuran-api).
 */

/**
 * Renders the API's footnote objects into the parenthesised block that gets
 * appended to a verse. Pure, so it is tested directly.
 *
 * @param {{ text: string }[] | null | undefined} footnotes
 * @returns {string} "" when there is nothing to render.
 */
function formatFootnotes(footnotes) {
  if (!footnotes || footnotes.length === 0) {
    return "";
  }

  const body = footnotes.map((note, i) => `[${i + 1}] ${note.text}`).join(" ");
  return `\n(${body})`;
}

/**
 * @param {object} [deps]
 * @param {(url: string) => Promise<unknown>} [deps.fetchJson] swapped out in tests
 * @param {string} [deps.baseUrl]
 */
function createAcikKuranClient({
  fetchJson = defaultFetchJson,
  baseUrl = ACIK_KURAN_BASE_URL,
} = {}) {
  /**
   * @returns {Promise<{ text: string, footnotes: string }>}
   */
  async function fetchVerse(surahId, verseId, authorId) {
    const url = `${baseUrl}/surah/${surahId}/verse/${verseId}?author=${authorId}`;
    const payload = await fetchJson(url);
    const translation = payload.data.translation;

    return {
      text: translation.text,
      footnotes: formatFootnotes(translation.footnotes),
    };
  }

  return { fetchVerse };
}

async function defaultFetchJson(url) {
  const { body } = await got(url);
  return JSON.parse(body);
}

module.exports = { createAcikKuranClient, formatFootnotes };
