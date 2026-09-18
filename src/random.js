/**
 * Randomness is isolated here and always takes an injectable `rng`, so tests
 * can make "random" choices deterministic instead of retrying until lucky.
 */

/**
 * @param {number} min inclusive
 * @param {number} max inclusive
 * @param {() => number} rng returns a float in [0, 1)
 */
function getRandomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * @template T
 * @param {T[]} items
 * @param {() => number} rng
 * @returns {T}
 */
function pickRandom(items, rng = Math.random) {
  return items[getRandomInt(0, items.length - 1, rng)];
}

module.exports = { getRandomInt, pickRandom };
