const staticData = require("./data");
const { CHAR_LIMIT } = require("./config");
const { getRandomInt, pickRandom } = require("./random");

const ELLIPSIS = "...";

/**
 * Builds the message that gets posted: one or more consecutive verses of a
 * surah, trimmed to fit a character budget, followed by an attribution footer.
 *
 * Everything the builder needs from the outside world (which verse to start
 * from, how to fetch a verse) is passed in, which keeps it deterministic.
 */

/**
 * Accumulates text while tracking how much room is left.
 * @param {number} limit
 */
function createBudget(limit) {
  return { parts: [], remaining: limit };
}

/**
 * Appends `chunk`, truncating it with an ellipsis if it does not fit.
 * @returns {boolean} true when the whole chunk fit, false when it was cut off.
 */
function appendToBudget(budget, chunk) {
  if (chunk.length <= budget.remaining) {
    budget.parts.push(chunk);
    budget.remaining -= chunk.length;
    return true;
  }

  // `substring` clamps a negative end to 0, which is what we want when there
  // is less room left than the ellipsis itself takes.
  budget.parts.push(
    chunk.substring(0, budget.remaining - ELLIPSIS.length) + ELLIPSIS
  );
  budget.remaining = 0;
  return false;
}

/**
 * @param {object} args
 * @param {number} args.surahId
 * @param {number} args.firstVerseId verse the passage starts at
 * @param {number} args.verseCount total verses in the surah
 * @param {string} args.surahName
 * @param {{ id: number, name: string }} args.author
 * @param {(surahId: number, verseId: number, authorId: number) =>
 *   Promise<{ text: string, footnotes: string }>} args.fetchVerse
 * @param {number} [args.charLimit]
 * @returns {Promise<string>}
 */
async function buildPassage({
  surahId,
  firstVerseId,
  verseCount,
  surahName,
  author,
  fetchVerse,
  charLimit = CHAR_LIMIT,
}) {
  // The footer is reserved up front so the verses never crowd it out. Note it
  // is measured before the "-lastVerse" range suffix exists, so a multi-verse
  // passage can end up a few characters over `charLimit`.
  let footer = `\n${author.name} meali, ${surahName} ${surahId}/${firstVerseId}`;
  const budget = createBudget(charLimit - footer.length);

  let verseId = firstVerseId;
  let verse = await fetchVerse(surahId, verseId, author.id);

  while (budget.remaining > 0) {
    if (!appendToBudget(budget, verse.text)) {
      break;
    }
    if (verse.footnotes && !appendToBudget(budget, verse.footnotes)) {
      break;
    }
    if (verseId === verseCount) {
      break; // last verse of the surah, do not spill into the next one
    }

    verseId++;
    const next = await fetchVerse(surahId, verseId, author.id);
    verse = { text: " " + next.text, footnotes: next.footnotes };
  }

  if (verseId !== firstVerseId) {
    footer += "-" + verseId;
  }

  return budget.parts.join("") + footer;
}

/**
 * Rolls a random surah / starting verse / translator out of the static data.
 * @param {() => number} [rng]
 */
function pickRandomPassageStart(rng = Math.random) {
  const surahId = getRandomInt(1, 114, rng);
  const verseCount = staticData.surah2verseCount[surahId];

  return {
    surahId,
    firstVerseId: getRandomInt(1, verseCount, rng),
    verseCount,
    surahName: staticData.surahs[surahId - 1].name,
    author: pickRandom(staticData.authors, rng),
  };
}

/**
 * Convenience composition of the two functions above.
 * @param {object} deps
 * @param {(surahId: number, verseId: number, authorId: number) => Promise<object>} deps.fetchVerse
 * @param {() => number} [deps.rng]
 * @param {number} [deps.charLimit]
 */
async function getRandomPassage({ fetchVerse, rng = Math.random, charLimit }) {
  return buildPassage({
    ...pickRandomPassageStart(rng),
    fetchVerse,
    charLimit,
  });
}

module.exports = {
  appendToBudget,
  buildPassage,
  createBudget,
  getRandomPassage,
  pickRandomPassageStart,
};
