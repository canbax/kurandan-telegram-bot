const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { surah2verseCount } = require("../src/data");
const { editions } = require("../src/editions");
const { SURAH_COUNT } = require("../src/qdb");
const { createLocalQuranClient, DEFAULT_DATA_DIR } = require("../src/quran");

/**
 * Checks the committed data rather than the code: a bad `npm run build:data`
 * must not be able to ship a half-empty or mangled translation.
 */

const TOTAL_VERSES = 6236;

test("the data directory holds exactly the editions the manifest lists", () => {
  const onDisk = fs
    .readdirSync(DEFAULT_DATA_DIR)
    .filter((name) => name.endsWith(".qdb"))
    .map((name) => name.slice(0, -".qdb".length))
    .sort();

  assert.deepEqual(
    onDisk,
    editions.map((e) => e.id).sort(),
    "src/editions.js and data/quran/ have drifted apart"
  );
});

test("edition ids and display names are unique", () => {
  assert.equal(new Set(editions.map((e) => e.id)).size, editions.length);
  assert.equal(
    new Set(editions.map((e) => e.name)).size,
    editions.length,
    "two translations share a footer name, so passages would be ambiguous"
  );
});

test("every translation is a complete Qur'an", async () => {
  const quran = createLocalQuranClient({ cacheSize: 1 });

  try {
    for (const { id } of editions) {
      let seen = 0;

      for (let surahId = 1; surahId <= SURAH_COUNT; surahId++) {
        const verses = await quran.fetchSurah(surahId, id);

        assert.equal(
          verses.length,
          surah2verseCount[surahId],
          `${id}: surah ${surahId} has ${verses.length} verses`
        );
        verses.forEach((text, i) => {
          assert.ok(
            text.trim().length > 0,
            `${id}: verse ${surahId}/${i + 1} is empty`
          );
        });

        seen += verses.length;
      }

      assert.equal(seen, TOTAL_VERSES, `${id} does not hold ${TOTAL_VERSES} verses`);
    }
  } finally {
    quran.close();
  }
});

test("the build stripped the stray footnote markers", async () => {
  const quran = createLocalQuranClient({ cacheSize: 1 });

  try {
    for (const { id } of editions) {
      for (let surahId = 1; surahId <= SURAH_COUNT; surahId++) {
        for (const text of await quran.fetchSurah(surahId, id)) {
          // Upstream leaves bare "*" markers with no footnote body to point at.
          assert.ok(!text.includes("*"), `${id}: surah ${surahId} still has a "*"`);
        }
      }
    }
  } finally {
    quran.close();
  }
});

test("the Turkish letters survived the build", async () => {
  const quran = createLocalQuranClient({ cacheSize: 1 });

  try {
    for (const { id } of editions) {
      // Bakara is long enough that a genuinely Turkish text cannot avoid these.
      const sample = (await quran.fetchSurah(2, id)).join(" ");

      for (const letter of ["ş", "ğ", "ı", "ç", "ö", "ü"]) {
        assert.ok(
          sample.includes(letter),
          `${id}: no "${letter}" in Bakara, looks ASCII-folded`
        );
      }
    }
  } finally {
    quran.close();
  }
});
